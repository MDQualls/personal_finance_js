# CLAUDE.md — Personal Finance Tracker

This file is the authoritative guide for Claude Code working in this repository. Read it fully before making any changes.

**Also read at the start of every session:**
- `BACKLOG.md` — known bugs, missing features, and tech debt in priority order
- `RECURRING.md` — full spec for recurring transactions (required for P2-1)

**Read only when instructed (future phases):**
- `PLAID.md` — Plaid bank integration spec — do not read until P4-1 is explicitly started

---

## Project Overview

A personal-use, fullstack Next.js finance tracker. Single user. No multi-tenancy. Dockerized with a Postgres database. AI-powered insights via the Anthropic API.

---

## Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript (strict mode — no `any`)
- **Database**: PostgreSQL via Docker
- **ORM**: Prisma
- **Auth**: NextAuth.js (Credentials provider, JWT sessions)
- **Styling**: Tailwind CSS (no CSS modules, no styled-components)
- **Charts**: Recharts
- **AI**: Anthropic Claude API (`claude-sonnet-4-20250514`)
- **Runtime**: Node.js 20

---

## Commands

```bash
# Development
docker compose up           # Start app + db containers
docker compose up -d db     # Start only the database

# Database
npx prisma migrate dev      # Run migrations in development
npx prisma migrate deploy   # Apply migrations in production
npx prisma db seed          # Seed system categories and defaults
npx prisma studio           # Open Prisma Studio GUI

# Type checking & linting
npx tsc --noEmit            # Type check without emitting
npx eslint .                # Lint entire project

# Testing
npx jest                         # Run all tests
npx jest --watch                 # Watch mode
npx jest path/to/file            # Run single test file
npx jest --coverage              # Run with coverage report
npx jest --testPathPattern=api   # Run only API route tests

# Security
npm audit                        # Check for known vulnerabilities
npm audit --audit-level=high     # Fail on high/critical only
```

---

## Project Structure

```
finance-tracker/
  ├── app/
  │   ├── (dashboard)/          # Protected route group — requires session
  │   │   ├── layout.tsx        # Session guard lives here
  │   │   ├── dashboard/
  │   │   ├── accounts/
  │   │   ├── transactions/
  │   │   ├── budgets/
  │   │   ├── subscriptions/
  │   │   ├── calendar/
  │   │   ├── reports/
  │   │   ├── cashflow/
  │   │   └── settings/
  │   ├── api/                  # All API route handlers
  │   │   ├── accounts/
  │   │   ├── transactions/
  │   │   ├── budgets/
  │   │   ├── subscriptions/
  │   │   ├── reports/
  │   │   ├── insights/
  │   │   ├── categories/
  │   │   ├── tags/
  │   │   └── rules/
  │   └── auth/                 # NextAuth pages
  ├── components/
  │   ├── ui/                   # Primitive components (Button, Input, Modal, etc.)
  │   ├── charts/               # Recharts wrappers
  │   ├── forms/                # Form components per domain
  │   └── layout/               # Shell, Sidebar, Header
  ├── lib/
  │   ├── prisma.ts             # Prisma singleton client
  │   ├── anthropic.ts          # Anthropic client singleton
  │   ├── auth.ts               # NextAuth config
  │   ├── money.ts              # Currency formatting and cents utilities (toCents/formatCurrency/annualEquivalent)
  │   ├── dates.ts              # Date helpers — always use date-fns via these wrappers
  │   ├── api.ts                # Shared API response helpers (apiSuccess / apiError)
  │   ├── alerts.ts             # In-app alert generators (budget thresholds, due dates, large transactions)
  │   ├── normalize.ts          # Merchant name normalization (pattern → display name)
  │   ├── projection.ts         # Projected balance engine (recurring rules + subscriptions → daily balances)
  │   ├── rateLimit.ts          # In-memory rate limiting for auth and insights endpoints
  │   └── reports.ts            # Aggregation query helpers for spending, trends, and net worth reports
  ├── prisma/
  │   ├── schema.prisma
  │   ├── migrations/
  │   └── seed.ts
  ├── types/
  │   └── index.ts              # Shared TypeScript types and interfaces
  ├── docker-compose.yml
  └── Dockerfile
```

---

## Architecture Conventions

### API Route Handlers

All API logic lives in Next.js App Router route handlers (`app/api/**/route.ts`). No separate Express server.

Every handler follows this structure:

```typescript
// app/api/accounts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    const accounts = await prisma.account.findMany({ where: { isActive: true } })
    return apiSuccess(accounts)
  } catch (err) {
    return apiError('Failed to fetch accounts', 500)
  }
}
```

**Response envelope** — always use the helpers in `lib/api.ts`:

```typescript
// Success: { data: T, meta?: object }
// Error:   { error: string, code?: string }
```

Never return raw Prisma objects — shape the response explicitly.

### Money / Currency

**All monetary amounts are stored as integers (cents).** This is non-negotiable — never store dollars as floats.

```typescript
// lib/money.ts — always use these helpers
export const toCents = (dollars: number) => Math.round(dollars * 100)
export const toDollars = (cents: number) => cents / 100
export const formatCurrency = (cents: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100)
```

Never do math on raw cent integers and display them directly. Always go through `formatCurrency`.

### Database Access

Use Prisma for all database access. No raw SQL unless there is a documented performance reason, and even then it must use `prisma.$queryRaw` with tagged template literals (never string interpolation).

```typescript
// Good
const transactions = await prisma.transaction.findMany({
  where: { accountId, deletedAt: null },
  include: { category: true, tags: true },
  orderBy: { date: 'desc' },
})

// Never do this
const results = await prisma.$queryRawUnsafe(`SELECT * FROM transactions WHERE id = ${id}`)
```

Soft deletes: transactions use a `deletedAt` timestamp. Always filter `where: { deletedAt: null }` in queries unless explicitly fetching deleted records.

### TypeScript

- Strict mode is on. No `any`. Use `unknown` and narrow it.
- Prefer `type` over `interface` for data shapes. Use `interface` only for things that may be extended.
- Never cast with `as` unless you have verified the type and added a comment explaining why.
- Zod is used for runtime validation at API boundaries. Every POST/PATCH handler validates its request body with a Zod schema before touching the database.

```typescript
import { z } from 'zod'

const CreateTransactionSchema = z.object({
  accountId: z.string().cuid(),
  amount: z.number().int().positive(),   // cents
  date: z.string().datetime(),
  categoryId: z.string().cuid(),
  description: z.string().min(1).max(255),
  notes: z.string().max(1000).optional(),
  tagIds: z.array(z.string().cuid()).optional(),
})
```

### React & Components

- Server Components by default. Only add `'use client'` when the component needs browser APIs, state, or event handlers.
- Data fetching happens in Server Components or route handlers — not in client components via `useEffect`.
- Forms use `react-hook-form`. No uncontrolled inputs scattered through components.
- No prop drilling beyond two levels. Use composition or React Context for shared UI state.

### Dates

Always use `date-fns` for date manipulation. Never use `new Date()` arithmetic directly. Store all dates as UTC in the database; format for display in the UI layer using the user's locale.

```typescript
import { format, startOfMonth, endOfMonth, addDays } from 'date-fns'
```

---

## Authentication

NextAuth is configured in `lib/auth.ts`. The single Credentials provider validates against env vars (`AUTH_USERNAME` / `AUTH_PASSWORD_HASH`). Sessions are JWT-based.

The `(dashboard)` route group layout checks for a session and redirects to `/auth/signin` if missing. API routes check the session with `getServerSession(authOptions)` and return 401 if absent.

**Never skip the session check in an API route.** Even for GET endpoints.

---

## AI Insights

The Claude integration lives in `lib/anthropic.ts` and is only called from `app/api/insights/generate/route.ts`.

Rules for the AI integration:

- **Never send raw transactions to the API.** Aggregate data server-side first — totals by category, budget utilization percentages, subscription costs — then send the summary.
- The prompt instructs Claude to return a strict JSON structure. Parse with `JSON.parse` inside a try/catch.
- Cache results in the `AIInsight` table keyed by `period` (e.g. `"2026-04"`). On a generate request, check the cache first. Regenerate only if the record is older than 24 hours or doesn't exist.
- Use model `claude-sonnet-4-20250514`. Do not change the model without testing.
- The `ANTHROPIC_API_KEY` env var must never be exposed to the client. The generate endpoint is server-only.

```typescript
// Expected response shape from Claude
type InsightResponse = {
  summary: string
  overspendCategories: { name: string; budgeted: number; actual: number }[]
  subscriptionAudit: { name: string; flag: string }[]
  momDelta: { category: string; change: number; note: string }[]
  projection: { estimatedBalance: number; note: string }
  recommendations: string[]
}
```

---

## Environment Variables

Required in `.env.local` (never committed):

```
DATABASE_URL=postgresql://user:password@db:5432/finance
NEXTAUTH_SECRET=<random 32+ char string>
NEXTAUTH_URL=http://localhost:3000
ANTHROPIC_API_KEY=sk-ant-...
AUTH_USERNAME=your_username
AUTH_PASSWORD_HASH=<bcrypt hash>
POSTGRES_USER=user
POSTGRES_PASSWORD=password
POSTGRES_DB=finance
```

---

## Data Integrity Rules

These are invariants. Do not write code that violates them.

- **Amounts are always cents (integers).** No floats in the database or in business logic.
- **Transactions are soft-deleted.** Set `deletedAt`, never `DELETE FROM`.
- **Categories referenced by transactions cannot be hard-deleted.** Set `isActive: false` instead.
- **System categories** (`isSystem: true`) cannot be modified or deleted by any API route.
- **Budget amounts must be positive integers.** Validate at the Zod layer.
- **Duplicate detection on CSV import** uses a hash of `date + amount + description`. If a match exists, skip the row and include it in the import summary response.

---

## Testing

### Philosophy

Every piece of logic that touches money, budgets, or financial projections must have unit tests. API routes must have integration tests. UI components need tests only when they contain non-trivial logic. Personal use does not lower the bar — financial bugs are silent and expensive to find after the fact.

### Stack

- **Jest** — test runner
- **@testing-library/react** — component testing
- **@testing-library/user-event** — user interaction simulation
- **jest-mock-extended** — Prisma client mocking
- **msw** (Mock Service Worker) — API mocking in component tests
- **Supertest** — HTTP-level integration tests for route handlers

### Test File Location

Co-locate tests with the code they test:

```
lib/money.ts
lib/money.test.ts

lib/dates.ts
lib/dates.test.ts

app/api/transactions/route.ts
app/api/transactions/route.test.ts

components/ui/BudgetProgress.tsx
components/ui/BudgetProgress.test.tsx
```

End-to-end and cross-cutting tests live in `__tests__/` at the project root.

### What to Test

**Always test (no exceptions):**
- All functions in `lib/money.ts` — every edge case, rounding behavior, negative values
- All functions in `lib/dates.ts` — boundary dates, month edges, DST
- Budget calculation logic — period totals, rollover math, threshold detection
- Projected balance engine — recurring rule application, subscription scheduling
- Duplicate detection logic for CSV import
- Zod validation schemas — valid input passes, invalid input returns correct error shape
- AI insight cache logic — hit, miss, stale (>24h)
- All API route handlers — auth guard, happy path, validation failure, DB error

**Test where logic exists:**
- React components that compute derived values (budget progress percentage, net worth delta)
- Any utility that transforms data before rendering

**Skip or keep minimal:**
- Pure presentational components with no logic
- Recharts wrappers (they just pass props)
- Tailwind class combinations

### Test Structure

Follow Arrange / Act / Assert with a blank line between each phase. Describe blocks mirror the module structure.

```typescript
// lib/money.test.ts
describe('toCents', () => {
  it('converts whole dollar amounts correctly', () => {
    expect(toCents(10)).toBe(1000)
  })

  it('rounds half-cent values consistently', () => {
    expect(toCents(1.005)).toBe(101)
  })

  it('handles negative amounts', () => {
    expect(toCents(-5.50)).toBe(-550)
  })

  it('handles zero', () => {
    expect(toCents(0)).toBe(0)
  })
})
```

### API Route Handler Tests

Use a mock Prisma client and mock `getServerSession`. Test the full request/response cycle.

```typescript
// app/api/transactions/route.test.ts
import { GET, POST } from './route'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { mockSession, noSession } from '@/lib/__mocks__/auth'

describe('GET /api/transactions', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()
    const req = new Request('http://localhost/api/transactions')
    const res = await GET(req as any)

    expect(res.status).toBe(401)
  })

  it('returns transactions for authenticated user', async () => {
    mockSession()
    prismaMock.transaction.findMany.mockResolvedValue([mockTransaction()])

    const req = new Request('http://localhost/api/transactions')
    const res = await GET(req as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
  })

  it('excludes soft-deleted transactions', async () => {
    mockSession()
    prismaMock.transaction.findMany.mockResolvedValue([])

    await GET(new Request('http://localhost/api/transactions') as any)

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) })
    )
  })
})
```

### Prisma Mock Setup

```typescript
// lib/__mocks__/prisma.ts
import { PrismaClient } from '@prisma/client'
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended'
import { prisma } from '../prisma'

jest.mock('../prisma', () => ({ prisma: mockDeep<PrismaClient>() }))

beforeEach(() => { mockReset(prismaMock) })

export const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>
```

### Coverage Requirements

Run coverage with `npx jest --coverage`. Maintain these minimums — CI should fail below them:

| Area | Minimum Coverage |
|---|---|
| `lib/money.ts` | 100% |
| `lib/dates.ts` | 100% |
| Budget calculation logic | 100% |
| Projected balance engine | 95% |
| API route handlers | 90% |
| Zod schemas | 90% |
| Overall project | 80% |

### Test Data Factories

Use factory functions for test fixtures, not raw object literals scattered across test files. Keep factories in `__tests__/factories/`.

```typescript
// __tests__/factories/transaction.ts
export const mockTransaction = (overrides = {}): Transaction => ({
  id: 'cuid_test_1',
  accountId: 'cuid_account_1',
  amount: -4500,          // -$45.00
  date: new Date('2026-04-01T00:00:00Z'),
  categoryId: 'cuid_category_1',
  description: 'TRADER JOES #123',
  notes: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})
```

---

## Security

This is a personal app, but treat it as production. The data is real financial data. These rules are non-negotiable.

### Authentication & Session

- Passwords are stored as **bcrypt hashes** (cost factor 12 minimum) in environment variables — never in the database, never in code, never in version control.
- JWT session tokens are signed with `NEXTAUTH_SECRET`. This secret must be at least 32 random characters generated with a cryptographically secure method (e.g. `openssl rand -base64 32`).
- Session cookies are `HttpOnly`, `Secure` (in production), and `SameSite=Lax`.
- Sessions expire after 30 days. There is no "remember me" beyond this.
- Failed login attempts are not informative — return the same generic error regardless of whether the username or password was wrong. Do not say "incorrect password" vs "user not found."

```typescript
// lib/auth.ts — correct credential error response
if (!isValid) {
  return null  // NextAuth converts this to a generic error — never throw a specific message
}
```

### Authorization

Every API route handler must verify the session as its first action, before any other logic including input parsing. There are no public API endpoints — this app has one user and everything requires authentication.

```typescript
// Correct — session check is first
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)
  // ... rest of handler
}

// Wrong — never do this
export async function GET(req: NextRequest) {
  const { id } = await parseParams(req)  // auth check must come first
  const session = await getServerSession(authOptions)
  // ...
}
```

### Input Validation

All POST and PATCH request bodies are validated with Zod before any database operation. Validation failure returns 400 with the Zod error detail. Never trust the shape or content of request bodies.

```typescript
const result = CreateTransactionSchema.safeParse(await req.json())
if (!result.success) {
  return apiError(result.error.format(), 400)
}
// Only use result.data from here on — never the raw parsed body
```

String fields must have `max()` bounds on every Zod schema. Unbounded strings are not acceptable.

### SQL Injection

Prisma's query API parameterizes all values automatically. The only risk is `$queryRaw` / `$executeRaw`. When these must be used, always use tagged template literals which Prisma handles safely:

```typescript
// Safe — Prisma parameterizes the value
const result = await prisma.$queryRaw`SELECT * FROM accounts WHERE id = ${id}`

// Never — raw string interpolation bypasses parameterization
const result = await prisma.$queryRawUnsafe(`SELECT * FROM accounts WHERE id = '${id}'`)
```

### XSS Prevention

- Next.js escapes JSX output by default. Never use `dangerouslySetInnerHTML`.
- The AI insight response from Claude is parsed as JSON, not rendered as HTML. Display fields as text content only.
- CSV import: all imported strings are treated as data, never as markup. Sanitize with a whitelist approach — strip anything that is not printable ASCII or expected unicode before storing.

### Secrets & Environment

- `.env.local` is in `.gitignore`. Never commit it.
- No secrets in `next.config.js` `env` block — that exposes values to the browser bundle. Use `process.env` directly in server-only code.
- Variables prefixed `NEXT_PUBLIC_` are exposed to the browser. Never prefix a secret this way.
- The Anthropic API key, database URL, and bcrypt hash are server-only. Audit any new env var before adding it — decide explicitly whether it needs to be public.

### HTTP Security Headers

Configure these headers in `next.config.js`:

```javascript
// next.config.js
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",  // Next.js requires these in dev; tighten in prod
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "connect-src 'self' https://api.anthropic.com",
      "frame-ancestors 'none'",
    ].join('; ')
  },
]
```

### Rate Limiting

Apply rate limiting to the authentication endpoint and the AI insights generate endpoint. Use an in-memory store (acceptable for single-user, single-container deployment) or a Redis-backed store if available.

```typescript
// lib/rateLimit.ts — simple token bucket per IP
// Apply to: POST /api/auth/*, POST /api/insights/generate
```

- Auth endpoint: max 10 attempts per 15 minutes per IP. Exceeding returns 429.
- Insights generate: max 20 requests per hour (cost control + abuse prevention).

### Dependency Security

```bash
npm audit                   # Check for known vulnerabilities
npm audit --audit-level=high  # Fail on high or critical only
```

Run `npm audit` before every dependency addition. Do not add packages with unresolved high or critical vulnerabilities. Keep dependencies minimal — every package is an attack surface.

### Docker Security

- The app container runs as a non-root user. Add `USER node` to the Dockerfile after installing dependencies.
- The Postgres container is not exposed on `0.0.0.0` — bind to `127.0.0.1` in docker-compose for local development.
- Use specific image tags (`postgres:16.2-alpine`) not floating tags (`postgres:latest`) so builds are reproducible and auditable.
- Never put secrets in the Dockerfile or docker-compose.yml. Use `.env` files or Docker secrets.

### Error Handling & Information Disclosure

API error responses must never expose internal implementation details — no stack traces, no Prisma error codes, no SQL fragments.

```typescript
// lib/api.ts
export function apiError(message: string, status: number) {
  // In production, log the real error server-side; return a safe message to the client
  return NextResponse.json({ error: message }, { status })
}

// In route handlers
try {
  // ...
} catch (err) {
  console.error('[transactions:GET]', err)          // Full error in server logs
  return apiError('Failed to fetch transactions', 500)  // Safe message to client
}
```

Server-side logs may contain full error detail. Client responses may not.

---

## What NOT to Do

- Do not install a state management library (Redux, Zustand, Jotai). React Context and Server Components cover this app's needs.
- Do not use `fetch` inside `useEffect` for data that can be fetched in a Server Component.
- Do not use `any` type — ever.
- Do not write raw SQL strings — use Prisma's query API or tagged `$queryRaw`.
- Do not expose `ANTHROPIC_API_KEY` or `DATABASE_URL` to the browser bundle.
- Do not add `'use client'` to a component just because it's easier — think first.
- Do not store dollars as floats. Cents only.
- Do not hard-delete transactions.
- Do not create a new Prisma client instance per request — use the singleton in `lib/prisma.ts`.

---

## UI Design System

The visual reference for this application is a modern fintech dashboard: dark sidebar navigation, light content area, teal/green primary accent, card-based layout, and generous white space. Every screen should feel calm, data-dense without being cluttered, and instantly readable.

### Color Palette

```css
:root {
  /* Sidebar */
  --color-sidebar-bg:        #1a2332;   /* Deep navy */
  --color-sidebar-text:      #8a9bb0;   /* Muted slate */
  --color-sidebar-active-bg: #00b89c;   /* Teal — active nav item */
  --color-sidebar-active-text: #ffffff;

  /* Content area */
  --color-bg:                #f4f6f9;   /* Off-white page background */
  --color-surface:           #ffffff;   /* Card / panel surface */
  --color-surface-hover:     #f8fafc;

  /* Typography */
  --color-text-primary:      #1a2332;   /* Near-black for headings and labels */
  --color-text-secondary:    #6b7a8d;   /* Muted for supporting text */
  --color-text-disabled:     #b0bac6;

  /* Accent */
  --color-accent:            #00b89c;   /* Teal — primary actions, active states */
  --color-accent-hover:      #009e87;
  --color-accent-subtle:     #e6f7f5;   /* Teal tint for backgrounds */

  /* Semantic */
  --color-success:           #22c55e;
  --color-warning:           #f59e0b;
  --color-danger:            #ef4444;
  --color-danger-subtle:     #fef2f2;

  /* Borders */
  --color-border:            #e8ecf0;
  --color-border-focus:      #00b89c;

  /* Budget progress */
  --color-budget-ok:         #22c55e;   /* < 75% spent */
  --color-budget-warn:       #f59e0b;   /* 75–99% spent */
  --color-budget-over:       #ef4444;   /* ≥ 100% spent */
}
```

### Typography

Use **DM Sans** (headings and UI labels) paired with **Inter** (data, numbers, body text). Load both from Google Fonts.

```css
/* Headings / labels */
font-family: 'DM Sans', sans-serif;
/* Data / numbers / body */
font-family: 'Inter', sans-serif;
```

Type scale:

| Role | Size | Weight | Font |
|---|---|---|---|
| Page title | 22px | 600 | DM Sans |
| Section heading | 16px | 600 | DM Sans |
| Card label | 13px | 500 | DM Sans |
| Body / list | 14px | 400 | Inter |
| Supporting / meta | 12px | 400 | Inter |
| Currency / number | 14–24px | 600 | Inter |

Currency amounts always use tabular numbers: `font-variant-numeric: tabular-nums`.

### Layout

**Sidebar** is fixed at 220px wide, full viewport height, dark navy background. Navigation items have a teal pill background when active. The user avatar and logout sit pinned at the bottom.

**Content area** occupies the remaining width with a `#f4f6f9` background. All content is padded `24px` from the edges.

**Top bar** inside the content area: page title left, notification bell + search bar right. Height `56px`.

**Cards** are `background: white`, `border-radius: 12px`, `box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)`. Internal padding `20px`. No heavy borders — the shadow provides separation.

**Grid** uses CSS Grid. Dashboard uses a 3-column grid at 1280px+ breakpoint, collapses to 2-column at 1024px, single column at mobile.

```css
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
```

### Component Conventions

**Buttons**

```
Primary:   bg teal, white text, border-radius 8px, height 36px, px 16px
Secondary: bg white, teal border, teal text
Danger:    bg red-50, red text, red border
Ghost:     no bg, no border, teal text — icon buttons, "View All" links
```

All buttons have a subtle `transform: scale(0.98)` on active state.

**Inputs**

Height `40px`, `border: 1px solid var(--color-border)`, `border-radius: 8px`, focus ring uses `--color-border-focus` (teal). No labels inside the input — always use an external label above.

**Transaction list rows**

Each row: icon left (category color), merchant name + date below in smaller muted text, amount right-aligned in bold Inter. Negative amounts in `--color-text-primary`, positive amounts in `--color-success`. Alternating row backgrounds are not used — rely on `8px` vertical padding and `border-bottom: 1px solid var(--color-border)`.

**Budget progress bar**

Full width, `height: 6px`, `border-radius: 3px`, background `--color-border`. Fill color driven by percentage: green / amber / red. Show percentage label right-aligned above the bar.

**Charts (Recharts)**

- Use `#00b89c` as the primary bar/line color, `#e8ecf0` as the comparison/secondary color.
- Remove chart borders and grid lines except subtle horizontal guides (`stroke: #e8ecf0`).
- Tooltips: white card, `border-radius: 8px`, `box-shadow`, no default Recharts border.
- Always hide the Recharts default legend in favor of a custom inline legend above the chart.
- Axes: `fontSize: 11`, `fill: #6b7a8d`, no axis line, no tick line.

**Status badges**

Pill shape, `border-radius: 99px`, `font-size: 11px`, `font-weight: 500`, `padding: 2px 8px`. Colors:

```
Active:    bg #e6f7f5, text #00b89c
Paused:    bg #fef9ec, text #d97706
Cancelled: bg #f4f6f9, text #6b7a8d
Over budget: bg #fef2f2, text #ef4444
```

### Spacing

Use an 4px base unit. All spacing values should be multiples of 4: `4 8 12 16 20 24 32 40 48`.

### Iconography

Use **Lucide React** for all icons. Consistent `size={16}` for inline / label icons, `size={20}` for navigation items, `size={18}` for card header icons. Stroke width `1.5` throughout — never the default `2`.

### Do / Don't

**Do:**
- Let white space breathe — don't pack cards edge to edge
- Right-align all currency amounts consistently
- Use teal sparingly — only for primary actions and active states
- Keep the sidebar nav labels short (one word where possible)
- Dim secondary information — dates, IDs, supporting text use `--color-text-secondary`

**Don't:**
- Use more than one accent color per screen (no competing highlights)
- Add card borders if a shadow already separates the card from the background
- Use uppercase labels — title case only
- Mix font families beyond DM Sans + Inter
- Add decorative elements (gradients, patterns) to the content area — the sidebar provides all the visual weight

---

## Key Domain Concepts

**Account** — a financial account (checking, savings, credit card, loan, asset). Balance is the current balance in cents.

**Transaction** — a single financial movement. Positive = money in, negative = money out. Always linked to one account and one category. Soft-deletable.

**Budget** — a spending limit for a category within a period. Evaluated by summing transactions in that category for the current period and comparing to the limit.

**Subscription** — a known recurring charge tracked separately from transactions. Has its own due-date and frequency. Used for projections and the calendar view.

**RecurringRule** — a template for expected future cash flows (income or expense). Drives the projected balance calculation.

**AIInsight** — a cached Claude API response keyed by period. Regenerated on demand but not on every page load.
