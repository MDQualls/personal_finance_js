# RECURRING.md — Recurring Transactions

This document covers the full implementation of the Recurring Transactions feature. It is written against the existing codebase as of Phase 1/2 completion.

---

## What Already Exists

Before building anything, understand what is already in place:

**`RecurringRule` model** — already in `prisma/schema.prisma`. Stores the rule definition: name, amount, frequency, account, category, next scheduled date, and whether it is income or expense.

**`lib/projection.ts`** — already consumes `RecurringRule` entries to project forward balances. This engine is complete and tested. The Recurring Transactions feature must feed data into this engine — do not duplicate or replace it.

**`app/api/reports/cashflow/route.ts`** — already queries `RecurringRule` and passes it to `projectBalance`. Any new recurring rules created through the UI will automatically appear in cash flow projections with zero additional work.

**`lib/dates.ts` — `addFrequency()`** — already handles advancing dates by any `Frequency` enum value. Use this everywhere. Do not write custom date math.

**`lib/money.ts` — `monthlyEquivalent()` and `annualEquivalent()`** — already handle frequency-normalized amounts. Use these for display.

**What does NOT exist yet:**
- API routes for `RecurringRule` CRUD
- Auto-posting engine (creating transactions from rules on their due date)
- `/recurring` UI page
- `RecurringRule` factory in `__tests__/factories/`
- `isActive` and `autoPost` flags on the model (need migration)
- `notes` field on the model (need migration)

---

## Distinction from Subscriptions

This is important — do not blur these two concepts in the UI or the data model.

| | Subscription | Recurring Transaction |
|---|---|---|
| Purpose | Track a service you pay for | Auto-post a transaction on a schedule |
| Creates transactions? | No | Yes (when `autoPost = true`) |
| Examples | Netflix, Spotify, SaaS | Paycheck, rent, loan payment, insurance |
| Direction | Expense only | Income or expense |
| Account | Not linked | Linked to a specific account |
| Cash flow projection | Yes (as passive input) | Yes (as primary input) |

Subscriptions live at `/subscriptions`. Recurring transactions live at `/recurring`. They share the calendar and cash flow views but are separate features with separate data models.

---

## Schema Changes

Two fields need to be added to `RecurringRule`. Add them to `prisma/schema.prisma` and run `npx prisma migrate dev --name add_recurring_rule_fields`.

```prisma
model RecurringRule {
  id         String        @id @default(cuid())
  name       String
  amount     Int           // cents; positive = income, negative = expense
  frequency  Frequency
  accountId  String
  categoryId String
  nextDate   DateTime
  type       RecurringType
  isActive   Boolean       @default(true)   // ADD THIS
  autoPost   Boolean       @default(true)   // ADD THIS
  notes      String?                        // ADD THIS
  lastPostedAt DateTime?                    // ADD THIS
  createdAt  DateTime      @default(now())
  updatedAt  DateTime      @updatedAt

  account  Account  @relation(fields: [accountId], references: [id])
  category Category @relation(fields: [categoryId], references: [id])
}
```

Also add the `RecurringRule` type to `types/index.ts`:

```typescript
export type RecurringRule = {
  id: string
  name: string
  amount: number        // cents
  frequency: Frequency
  accountId: string
  categoryId: string
  nextDate: Date
  type: RecurringType
  isActive: boolean
  autoPost: boolean
  notes: string | null
  lastPostedAt: Date | null
  createdAt: Date
  updatedAt: Date
  account?: Account
  category?: Category
}
```

---

## Amount Sign Convention

The `RecurringRule.amount` field uses the same convention as `Transaction.amount`:

- **Positive cents** = money coming in (income: paycheck, rent received, transfer in)
- **Negative cents** = money going out (expense: loan payment, insurance, utility)

The `type` field (`INCOME` | `EXPENSE`) is kept for filtering and display purposes, but the sign of `amount` is the source of truth for math. They must always be consistent — income rules have positive amounts, expense rules have negative amounts. Validate this in the Zod schema.

```typescript
// Zod refinement — add to CreateRecurringRuleSchema
.refine(
  (data) => data.type === 'INCOME' ? data.amount > 0 : data.amount < 0,
  { message: 'Amount sign must match type: income = positive, expense = negative' }
)
```

---

## Auto-Posting Engine

### What It Does

On a schedule (or on demand), the engine checks for `RecurringRule` entries where:
- `isActive = true`
- `autoPost = true`
- `nextDate <= today`

For each matching rule, it:
1. Creates a `Transaction` record linked to the rule's account and category
2. Advances `nextDate` to the next occurrence using `addFrequency()`
3. Sets `lastPostedAt` to now

### Implementation

```typescript
// lib/recurringEngine.ts
import { prisma } from './prisma'
import { addFrequency } from './dates'

export async function postDueRecurringRules(): Promise<{
  posted: number
  skipped: number
  errors: string[]
}> {
  const now = new Date()
  now.setHours(23, 59, 59, 999) // include anything due today

  const dueRules = await prisma.recurringRule.findMany({
    where: {
      isActive: true,
      autoPost: true,
      nextDate: { lte: now },
      account: { plaidManaged: false },   // NEVER post to Plaid-managed accounts
    },
  })

  let posted = 0
  let skipped = 0
  const errors: string[] = []

  for (const rule of dueRules) {
    try {
      await prisma.$transaction(async (tx) => {
        // Create the transaction
        await tx.transaction.create({
          data: {
            accountId: rule.accountId,
            categoryId: rule.categoryId,
            amount: rule.amount,
            date: rule.nextDate,
            description: rule.name,
            notes: rule.notes ?? null,
          },
        })

        // Advance nextDate and record lastPostedAt
        await tx.recurringRule.update({
          where: { id: rule.id },
          data: {
            nextDate: addFrequency(rule.nextDate, rule.frequency),
            lastPostedAt: new Date(),
          },
        })
      })

      posted++
    } catch (err) {
      console.error(`[recurringEngine] Failed to post rule ${rule.id}:`, err)
      errors.push(`Rule "${rule.name}" (${rule.id}): ${err instanceof Error ? err.message : 'Unknown error'}`)
      skipped++
    }
  }

  return { posted, skipped, errors }
}
```

### Prisma Transaction

The `prisma.$transaction()` wrapper is critical — the transaction creation and the `nextDate` advancement must succeed or fail together. If the transaction row is created but `nextDate` is not advanced, the engine will post a duplicate on the next run. If `nextDate` is advanced but the transaction fails, the posting is silently lost. Neither is acceptable.

### Catch-up Handling

If the app is offline for several days, a monthly rule with `nextDate` in the past should only post **once**, then advance `nextDate` forward. The engine as written does this correctly — it processes each rule once per engine run, then advances. If catch-up posting of missed dates is ever desired, that is a separate explicit feature, not the default behavior.

---

## API Routes

### GET /api/recurring

List all recurring rules, with optional filter by type.

```typescript
// app/api/recurring/route.ts
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') // 'INCOME' | 'EXPENSE' | null

  try {
    const rules = await prisma.recurringRule.findMany({
      where: {
        isActive: true,
        ...(type ? { type: type as RecurringType } : {}),
      },
      include: { account: true, category: true },
      orderBy: { nextDate: 'asc' },
    })
    return apiSuccess(rules)
  } catch (err) {
    console.error('[recurring:GET]', err)
    return apiError('Failed to fetch recurring rules', 500)
  }
}
```

### POST /api/recurring

Create a new recurring rule.

```typescript
const CreateRecurringRuleSchema = z.object({
  name: z.string().min(1).max(255),
  amount: z.number().int().nonzero(),       // cents — sign must match type
  frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
  accountId: z.string().cuid(),
  categoryId: z.string().cuid(),
  nextDate: z.string().datetime(),
  type: z.enum(['INCOME', 'EXPENSE']),
  autoPost: z.boolean().default(true),
  notes: z.string().max(1000).optional(),
}).refine(
  (data) => data.type === 'INCOME' ? data.amount > 0 : data.amount < 0,
  { message: 'Amount sign must match type' }
)

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body = CreateRecurringRuleSchema.safeParse(await req.json())
  if (!body.success) return apiError(body.error.format(), 400)

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body = CreateRecurringRuleSchema.safeParse(await req.json())
  if (!body.success) return apiError(body.error.format(), 400)

  // Prevent auto-post on Plaid-managed accounts — would create duplicate transactions
  if (body.data.autoPost) {
    const account = await prisma.account.findUnique({ where: { id: body.data.accountId } })
    if (account?.plaidManaged) {
      return apiError(
        'Auto-post is not allowed on Plaid-managed accounts. This rule will still project in cash flow. Set autoPost to false.',
        422
      )
    }
  }

  try {
    const rule = await prisma.recurringRule.create({
      data: { ...body.data, nextDate: new Date(body.data.nextDate) },
      include: { account: true, category: true },
    })
    return apiSuccess(rule, {}, 201)
  } catch (err) {
    console.error('[recurring:POST]', err)
    return apiError('Failed to create recurring rule', 500)
  }
}
```

### PATCH /api/recurring/[id]

Update a recurring rule. Changing `nextDate` effectively reschedules it.

```typescript
// app/api/recurring/[id]/route.ts
const UpdateRecurringRuleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  amount: z.number().int().nonzero().optional(),
  frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
  accountId: z.string().cuid().optional(),
  categoryId: z.string().cuid().optional(),
  nextDate: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
  autoPost: z.boolean().optional(),
  notes: z.string().max(1000).nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body = UpdateRecurringRuleSchema.safeParse(await req.json())
  if (!body.success) return apiError(body.error.format(), 400)

  try {
    const rule = await prisma.recurringRule.update({
      where: { id: params.id },
      data: {
        ...body.data,
        ...(body.data.nextDate ? { nextDate: new Date(body.data.nextDate) } : {}),
      },
      include: { account: true, category: true },
    })
    return apiSuccess(rule)
  } catch (err) {
    console.error('[recurring:PATCH]', err)
    return apiError('Failed to update recurring rule', 500)
  }
}
```

### DELETE /api/recurring/[id]

Soft-deactivate by setting `isActive = false`. Never hard-delete — the rule's history (via `lastPostedAt`) and its generated transactions should remain intact.

```typescript
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    await prisma.recurringRule.update({
      where: { id: params.id },
      data: { isActive: false },
    })
    return apiSuccess({ deactivated: true })
  } catch (err) {
    console.error('[recurring:DELETE]', err)
    return apiError('Failed to deactivate recurring rule', 500)
  }
}
```

### POST /api/recurring/post-due

Manually trigger the auto-posting engine. Used by the "Post Due Now" button in the UI and by the automated daily trigger.

```typescript
// app/api/recurring/post-due/route.ts
import { postDueRecurringRules } from '@/lib/recurringEngine'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    const result = await postDueRecurringRules()
    return apiSuccess(result)
  } catch (err) {
    console.error('[recurring:post-due]', err)
    return apiError('Engine failed', 500)
  }
}
```

### POST /api/recurring/[id]/post-now

Manually post a single rule immediately, regardless of its `nextDate`. Used for the "Post Now" button on an individual rule.

```typescript
// app/api/recurring/[id]/post-now/route.ts
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    const rule = await prisma.recurringRule.findUnique({ where: { id: params.id } })
    if (!rule) return apiError('Rule not found', 404)

    await prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          accountId: rule.accountId,
          categoryId: rule.categoryId,
          amount: rule.amount,
          date: new Date(),
          description: rule.name,
          notes: rule.notes ?? null,
        },
      })
      await tx.recurringRule.update({
        where: { id: rule.id },
        data: {
          nextDate: addFrequency(rule.nextDate, rule.frequency),
          lastPostedAt: new Date(),
        },
      })
    })

    return apiSuccess({ posted: true })
  } catch (err) {
    console.error('[recurring:post-now]', err)
    return apiError('Failed to post rule', 500)
  }
}
```

---

## Triggering the Engine Daily

For a local Dockerized app, a simple approach is a Next.js cron route triggered by a lightweight OS-level scheduler.

### Option A — cURL from crontab (recommended for local use)

Add to your Mac's crontab (`crontab -e`):

```
0 6 * * * curl -s -X POST http://localhost:3000/api/recurring/post-due \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" > /dev/null
```

This fires at 6am daily. Not elegant, but zero dependencies and works reliably for personal use.

### Option B — Docker Compose sidecar

Add a lightweight cron container to `docker-compose.yml` that calls the endpoint:

```yaml
services:
  scheduler:
    image: alpine
    depends_on: [app]
    command: >
      sh -c "while true; do
        sleep 86400;
        wget -qO- --post-data='' http://app:3000/api/recurring/post-due;
      done"
    restart: unless-stopped
```

### Option C — Next.js Route with `waitUntil` (future)

When deployed to a platform supporting edge functions (Vercel, etc.), use a scheduled cron route. Not applicable for the current local Docker setup.

**For now, Option A is sufficient.** Add a "Post Due Now" button in the UI as a manual fallback — this is the most important safety valve.

---

## UI

### Route: /recurring

Add to the dashboard route group: `app/(dashboard)/recurring/page.tsx`

**Page layout:**

```
Header: "Recurring Transactions"  [+ Add Recurring] button right

[Income section]
  Rule card row: name | frequency | next date | account | amount (green) | [Post Now] [Edit] [Deactivate]

[Expenses section]
  Rule card row: name | frequency | next date | account | amount (red) | [Post Now] [Edit] [Deactivate]

[Summary footer]
  Monthly income total | Monthly expense total | Monthly net
```

**Rule card row details:**
- Name and notes (if present) left-aligned
- Frequency badge (pill): Weekly / Biweekly / Monthly / Quarterly / Yearly
- Next due date — highlight in amber if due within 3 days, red if overdue
- Account name
- Amount right-aligned: positive in `--color-success`, negative in `--color-danger`
- `autoPost` toggle inline — toggle off to track without auto-posting
- "Post Now" button — ghost style, posts immediately regardless of schedule
- Last posted date shown in muted text below the rule name

### Form: Add / Edit Recurring Rule

Fields (use existing form components):
- Name (text input)
- Type (segmented control: Income / Expense)
- Amount (number input — user enters positive dollar amount; sign applied based on type)
- Frequency (select: Weekly / Biweekly / Monthly / Quarterly / Yearly)
- Account (select from active accounts)
- Category (select — filter by isIncome matching the type selection)
- Next Due Date (date input)
- Auto-post (checkbox — default checked)
- Notes (textarea, optional)

**Important:** The user always enters a positive dollar amount in the form. The form applies the correct sign (`amount * -1` for expenses) before submitting to the API. Never ask the user to enter a negative number.

**Plaid-managed accounts:** When the selected account has `plaidManaged = true`, the auto-post checkbox must be forcibly unchecked and disabled, with an inline warning:

```
⚠ This account is managed by Plaid. Auto-post has been disabled to prevent
duplicate transactions. This rule will still appear in cash flow projections.
```

### Sidebar Nav

Add "Recurring" to `components/layout/Sidebar.tsx` between Subscriptions and Calendar:

```tsx
{ href: '/recurring', icon: RefreshCw, label: 'Recurring' }
```

Use `RefreshCw` from Lucide React (size 20, strokeWidth 1.5 — matching existing nav icons).

---

## Alerts Integration

Extend `lib/alerts.ts` to surface overdue recurring rules. Add a new alert type:

```typescript
// types/index.ts — add to Alert union
export type OverdueRecurringAlert = {
  type: 'recurring_overdue'
  ruleId: string
  name: string
  amount: number  // cents
  nextDate: Date
  daysOverdue: number
}

export type Alert = BudgetAlert | SubscriptionAlert | LargeTransactionAlert | OverdueRecurringAlert
```

```typescript
// lib/alerts.ts — add function
export function getOverdueRecurringAlerts(
  rules: Array<{ id: string; name: string; amount: number; nextDate: Date; isActive: boolean; autoPost: boolean }>
): OverdueRecurringAlert[] {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  return rules
    .filter((r) => r.isActive && !r.autoPost && isBefore(r.nextDate, now))
    .map((r) => ({
      type: 'recurring_overdue' as const,
      ruleId: r.id,
      name: r.name,
      amount: r.amount,
      nextDate: r.nextDate,
      daysOverdue: differenceInDays(now, r.nextDate),
    }))
}
```

Note: rules with `autoPost = true` should never appear overdue because the engine posts them automatically. This alert is for manual rules (`autoPost = false`) that the user needs to handle themselves.

---

## Testing

Add `__tests__/factories/recurringRule.ts`:

```typescript
// __tests__/factories/recurringRule.ts
import type { RecurringRule } from '@/types'

export const mockRecurringRule = (overrides = {}): RecurringRule => ({
  id: 'cuid_rule_1',
  name: 'Monthly Paycheck',
  amount: 350000,               // $3,500.00
  frequency: 'MONTHLY',
  accountId: 'cuid_account_1',
  categoryId: 'cuid_category_income',
  nextDate: new Date('2026-05-01T00:00:00Z'),
  type: 'INCOME',
  isActive: true,
  autoPost: true,
  notes: null,
  lastPostedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})
```

### Engine Tests: `lib/recurringEngine.test.ts`

```typescript
describe('postDueRecurringRules', () => {
  it('creates a transaction for a due rule', async () => { ... })
  it('advances nextDate by one frequency period after posting', async () => { ... })
  it('skips rules where isActive = false', async () => { ... })
  it('skips rules where autoPost = false', async () => { ... })
  it('skips rules where nextDate is in the future', async () => { ... })
  it('skips rules linked to a Plaid-managed account', async () => { ... })
  it('rolls back transaction creation if nextDate update fails', async () => { ... })
  it('reports errors without stopping other rules from posting', async () => { ... })
  it('returns correct posted and skipped counts', async () => { ... })
})
```

### API Route Tests: `app/api/recurring/route.test.ts`

```typescript
describe('GET /api/recurring', () => {
  it('returns 401 when unauthenticated', ...)
  it('returns only active rules by default', ...)
  it('filters by type when query param provided', ...)
})

describe('POST /api/recurring', () => {
  it('returns 401 when unauthenticated', ...)
  it('creates rule with valid data', ...)
  it('rejects income rule with negative amount', ...)
  it('rejects expense rule with positive amount', ...)
  it('rejects missing required fields', ...)
  it('rejects autoPost = true on a Plaid-managed account with 422', ...)
  it('allows autoPost = false on a Plaid-managed account', ...)
})

describe('DELETE /api/recurring/[id]', () => {
  it('sets isActive = false, does not hard delete', ...)
})
```

---

## Integration with Existing Features

**Cash flow projection** — no changes needed. `lib/projection.ts` and `app/api/reports/cashflow/route.ts` already query `RecurringRule` and project them forward. New rules appear automatically.

**Calendar page** — extend `app/(dashboard)/calendar/page.tsx` to include `RecurringRule.nextDate` entries alongside subscription due dates. Use a different icon/color to distinguish them visually.

**Dashboard** — add an "Upcoming Recurring" widget showing the next 3 recurring transactions due, alongside the existing upcoming bills widget.

**Transaction list** — transactions auto-posted by the engine are regular `Transaction` records. They appear in the transaction list with the rule's name as `description` and the rule's category. No special treatment needed.

---

## Summary of Files to Create / Modify

| Action | File |
|---|---|
| Modify | `prisma/schema.prisma` — add `isActive`, `autoPost`, `notes`, `lastPostedAt` to `RecurringRule` |
| Migrate | `npx prisma migrate dev --name add_recurring_rule_fields` |
| Modify | `types/index.ts` — update `RecurringRule` type, add `OverdueRecurringAlert` |
| Create | `lib/recurringEngine.ts` |
| Create | `lib/recurringEngine.test.ts` |
| Create | `app/api/recurring/route.ts` — GET + POST |
| Create | `app/api/recurring/[id]/route.ts` — PATCH + DELETE |
| Create | `app/api/recurring/post-due/route.ts` — POST |
| Create | `app/api/recurring/[id]/post-now/route.ts` — POST |
| Create | `app/(dashboard)/recurring/page.tsx` |
| Create | `components/forms/RecurringRuleForm.tsx` |
| Create | `__tests__/factories/recurringRule.ts` |
| Modify | `lib/alerts.ts` — add `getOverdueRecurringAlerts()` |
| Modify | `components/layout/Sidebar.tsx` — add Recurring nav item |
| Modify | `app/(dashboard)/calendar/page.tsx` — include recurring rule dates |

---

*Recurring Transactions Spec — v1.1 | Personal Finance Tracker*
