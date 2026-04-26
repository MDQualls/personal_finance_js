# BACKLOG.md — Personal Finance Tracker

This file tracks known gaps, bugs, and tech debt identified through codebase audit. Claude Code should read this file at the start of every session and address items in priority order unless instructed otherwise.

**How to use this file:**
- Work items top to bottom within each priority tier
- When an item is complete, mark it `[x]` and move it to the Done section at the bottom
- Do not delete items — the done history is useful
- Each item is self-contained — it describes the current state, the target state, and the exact files involved

---

## Priority 1 — Correctness Bugs (Active Wrong Behavior)

### [P1-1] Net Worth History Shows Incorrect Data
**Status:** Open  
**Files:** `lib/reports.ts` → `getNetWorthHistory()`, `app/api/reports/net-worth/route.ts`  
**Current behavior:** `getNetWorthHistory()` uses the *current* account balances for every historical month. Every data point on the Net Worth chart is identical — the chart is visually populated but financially wrong.  
**Target behavior:** Store monthly `NetWorthSnapshot` records and query those instead. Two options:
1. Add a `NetWorthSnapshot` Prisma model (`month String @unique`, `assets Int`, `liabilities Int`, `netWorth Int`, `createdAt DateTime`). Write a cron-triggered API route `POST /api/snapshots/net-worth` that captures the current balance on the 1st of each month. Query this table in `getNetWorthHistory()`, falling back to the current balance for the current month only.
2. If no snapshots exist yet, compute historical net worth by replaying transaction history per account backward from today. Option 1 is preferred — simpler and more accurate.

Run `npx prisma migrate dev --name add_net_worth_snapshot` after schema change.

---

### [P1-2] Import Page Uses `useState` as an Effect
**Status:** Open  
**File:** `app/(dashboard)/transactions/import/page.tsx` line ~52  
**Current behavior:** `useState(() => { fetch('/api/accounts')... })` is used to trigger a side effect. This is incorrect — the initializer callback runs once synchronously during render and does not behave like `useEffect`. The accounts list may not load reliably.  
**Target behavior:** Replace with `useEffect(() => { fetch('/api/accounts')... }, [])`. No other changes needed.

---

### [P1-3] `lib/normalize.ts` Is Dead Code — Never Called
**Status:** Open  
**Files:** `lib/normalize.ts`, `app/api/transactions/route.ts`, `app/api/transactions/import/route.ts`  
**Current behavior:** Merchant normalization rules (`MerchantRule` model) exist in the schema and `lib/normalize.ts` exists, but it is never imported or called anywhere. Transactions are stored with raw bank description strings — no normalization occurs.  
**Target behavior:** Call `normalize(description)` from `lib/normalize.ts` in two places:
1. `POST /api/transactions` — normalize `description` before `prisma.transaction.create()`
2. `POST /api/transactions/import` — normalize each row's `description` before the dedupe hash and create

Check `lib/normalize.ts` for the existing function signature before wiring it in. Do not rewrite the normalize logic — just connect it.

---

## Priority 2 — Missing Features (Spec Calls For, Not Built)

### [P2-1] Recurring Transactions — Full Implementation
**Status:** Open  
**Spec:** `RECURRING.md` — read in full before starting  
**Summary:** The `RecurringRule` model exists and feeds cash flow projections but has no UI, no CRUD API routes, and no auto-posting engine.

**Steps in order:**
1. Schema migration — add `isActive`, `autoPost`, `notes`, `lastPostedAt` to `RecurringRule`. Run `npx prisma migrate dev --name add_recurring_rule_fields`
2. Update `types/index.ts` — add new fields to `RecurringRule` type, add `OverdueRecurringAlert` to alert union
3. Create `lib/recurringEngine.ts` — see RECURRING.md for full implementation. Critical: use `prisma.$transaction()` for atomic post + nextDate advance. Filter `account: { plaidManaged: false }` on every engine run.
4. Create API routes:
   - `app/api/recurring/route.ts` — GET + POST
   - `app/api/recurring/[id]/route.ts` — PATCH + DELETE
   - `app/api/recurring/post-due/route.ts` — POST
   - `app/api/recurring/[id]/post-now/route.ts` — POST
5. Create `app/(dashboard)/recurring/page.tsx` and `components/forms/RecurringRuleForm.tsx`
6. Add `RefreshCw` nav item to `components/layout/Sidebar.tsx` between Subscriptions and Calendar
7. Create `__tests__/factories/recurringRule.ts`
8. Create `lib/recurringEngine.test.ts` — see RECURRING.md for required test cases
9. Create `app/api/recurring/route.test.ts`

---

### [P2-2] Calendar Page Missing Recurring Rules
**Status:** Open  
**File:** `app/(dashboard)/calendar/page.tsx`  
**Current behavior:** Calendar only queries `prisma.subscription` for upcoming items. Recurring rules with upcoming `nextDate` values are completely absent.  
**Target behavior:** Also query `prisma.recurringRule.findMany({ where: { isActive: true, nextDate: { lte: ninetyDaysOut } } })` and merge the results into `upcomingItems`. Use `type: 'recurring'` to distinguish from subscriptions. In the UI, render recurring items with a `RefreshCw` icon instead of the category color dot, and show the account name as supporting text instead of a category name.

---

### [P2-3] Dashboard Upcoming Bills Missing Recurring Rules
**Status:** Open  
**File:** `app/(dashboard)/dashboard/page.tsx`  
**Current behavior:** The "Upcoming Bills" widget only pulls from `prisma.subscription`. Recurring expense rules due in the next 7 days do not appear.  
**Target behavior:** Add a second query for `RecurringRule` entries where `type = EXPENSE`, `isActive = true`, `nextDate` within 7 days. Merge with subscription results, sort by date, show top 5. Display account name as supporting text for recurring items.

---

### [P2-4] Account Edit and Archive Not Implemented
**Status:** Open  
**Files:** `app/(dashboard)/accounts/AccountsClient.tsx`, `app/api/accounts/[id]/route.ts`  
**Current behavior:** Accounts page has an "Add Account" button but no way to edit an existing account's name, type, or balance, and no way to archive it. The `[id]` API route likely exists — check what methods it currently handles.  
**Target behavior:**
- Add edit button (pencil icon) on each account row — opens a modal with `AccountForm` pre-populated
- Add archive button — calls `PATCH /api/accounts/[id]` with `{ isActive: false }` after confirmation
- Add "Show Archived" toggle to reveal inactive accounts with a Restore option
- Ensure `PATCH /api/accounts/[id]` handles `{ isActive: false }` and full field updates

---

### [P2-5] Merchant Normalization Settings Page Missing
**Status:** Open  
**Files:** `app/(dashboard)/settings/rules/page.tsx`, new page needed  
**Current behavior:** `/settings/rules` only shows auto-categorization rules (`AutoRule`). `MerchantRule` model exists in the schema and `lib/normalize.ts` exists but there is no UI to create, edit, or delete merchant normalization rules.  
**Target behavior:** Add a second section to `/settings/rules/page.tsx` below auto-categorization rules titled "Merchant Normalization." Each rule maps a pattern (contains or regex) to a display name. CRUD operations hit a new `app/api/rules/merchant/route.ts` and `app/api/rules/merchant/[id]/route.ts`. Form fields: Pattern, Is Regex toggle, Display Name.

---

### [P2-6] Budget vs. Actual Report Missing
**Status:** Open  
**Files:** `app/(dashboard)/reports/page.tsx`, `app/api/reports/` (new route needed)  
**Current behavior:** Reports page has Spending by Category, Monthly Trend, and Net Worth charts. The spec calls for a Budget vs. Actual horizontal bar chart — it does not exist.  
**Target behavior:** Add a `GET /api/reports/budget-actual` route that returns each active budget with `{ categoryName, budgeted, spent, percentage }` for the selected period. Add a `BudgetActualChart` Recharts component using `BarChart` in horizontal layout — one bar per budget category, teal fill for spent, `--color-border` background for remaining, red fill when over. Add this chart to the reports page below the Monthly Trend chart.

---

### [P2-7] CSV Export Not Implemented on Any Report
**Status:** Open  
**Files:** `app/(dashboard)/reports/page.tsx`, `app/api/reports/spending/route.ts`, `app/api/reports/trends/route.ts`  
**Current behavior:** Spec states all reports support CSV export. No export functionality exists anywhere.  
**Target behavior:** Add a `format=csv` query parameter to the spending and trends report API routes. When `format=csv`, return a `text/csv` response with appropriate headers instead of JSON. Add an "Export CSV" ghost button to each chart card on the reports page that appends `&format=csv` to the current report URL and triggers a download via `window.open()` or an anchor tag.

---

### [P2-8] `/transactions/new` Listed as Dedicated Page — Actually a Modal
**Status:** Open (documentation fix only)  
**Files:** `PersonalFinanceTracker-Spec.md`, `CLAUDE.md`  
**Current behavior:** The spec lists `/transactions/new` as a dedicated route. In reality, adding a transaction is handled via a modal within `/transactions`. There is no `/transactions/new` page.  
**Target behavior:** Update the UI Pages table in `PersonalFinanceTracker-Spec.md` — remove `/transactions/new` as a separate route. Note that transaction creation is modal-based within `/transactions`. No code changes needed.

---

## Priority 3 — Tech Debt (Works but Needs Improvement)

### [P3-1] `window.location.reload()` Anti-Pattern Throughout
**Status:** Open  
**Files:** `app/(dashboard)/accounts/AccountsClient.tsx`, `app/(dashboard)/budgets/BudgetsClient.tsx`, `app/(dashboard)/subscriptions/SubscriptionsClient.tsx`, `app/(dashboard)/settings/categories/CategoriesClient.tsx`  
**Current behavior:** After mutations (create, edit, delete), components call `window.location.reload()` to refresh data. This is a full browser reload — it loses scroll position, flashes, and is inconsistent with Next.js App Router patterns.  
**Target behavior:** Replace `window.location.reload()` with `router.refresh()` from `next/navigation`. Import `useRouter` and call `router.refresh()` after successful mutations. This triggers a server-side revalidation of the current route without a full reload. Also close modals and reset form state after the refresh.

---

### [P3-2] `getMonthlyTrends()` N+1 Query Pattern
**Status:** Open  
**File:** `lib/reports.ts` → `getMonthlyTrends()`  
**Current behavior:** Runs one `prisma.transaction.findMany()` per month in a sequential loop. For 6 months that's 6 round trips; for 12 months it's 12. This grows linearly with the months parameter.  
**Target behavior:** Replace the loop with a single query that fetches all transactions within the full date range, then groups them in application memory by month:

```typescript
const transactions = await prisma.transaction.findMany({
  where: {
    deletedAt: null,
    date: { gte: startOfMonth(subMonths(now, months - 1)), lte: endOfMonth(now) },
  },
  include: { category: true },
})
// Then group by month string in a Map
```

This reduces N queries to 1 regardless of the months parameter.

---

### [P3-3] Report Pages Use `useEffect` Data Fetching in Client Components
**Status:** Open  
**Files:** `app/(dashboard)/reports/page.tsx`, `app/(dashboard)/cashflow/page.tsx`, `app/(dashboard)/reports/insights/page.tsx`  
**Current behavior:** These pages are `'use client'` components that fetch data via `useEffect` and `fetch()`. This means no data is available on initial render — users see a loading spinner on every visit.  
**Target behavior:** Convert the static data fetches to Server Components. The date-range-driven reports (`spending`, `trends`) need to stay client-side for interactivity, but the initial data load can be server-rendered using Next.js `searchParams`. Cashflow page can become a Server Component with the 30-day window as default. Insights page stays client-side (user-triggered generation). Evaluate each page individually — don't convert all at once.

---

### [P3-4] `lib/reports.ts` and `lib/normalize.ts` Not Documented in CLAUDE.md
**Status:** Open  
**File:** `CLAUDE.md` → Project Structure section  
**Current behavior:** CLAUDE.md lists `lib/` files as `prisma.ts, api.ts, money.ts, dates.ts, anthropic.ts, auth.ts, rateLimit.ts` but omits `reports.ts`, `normalize.ts`, `projection.ts`, `alerts.ts`.  
**Target behavior:** Update the `lib/` directory listing in CLAUDE.md to include all current files with a one-line description of each. This ensures Claude Code knows these files exist and uses them rather than recreating logic.

---

### [P3-5] `getNetWorthHistory()` Uses Current Balances for All Historical Months
**Status:** Duplicate of P1-1 — see P1-1. Resolved when P1-1 is complete.

---

## Priority 4 — Future Phases (BLOCKED — Do Not Touch)

> ⛔ Claude Code must not read PLAID.md or begin any Plaid-related work until explicitly instructed by the user. All P4 items are blocked until every P1, P2, and P3 item is marked Done. Do not infer permission to start these from context — wait for a direct instruction.

### [P4-1] Plaid Integration
**Spec:** `PLAID.md` — do not read until instructed  
**Blocked by:** P2-1 (recurring transactions + `plaidManaged` guard must exist first)  
**Blocked by:** All P1, P2, P3 items must be complete

### [P4-2] Net Worth Snapshot Cron Trigger
**Blocked by:** P1-1 (NetWorthSnapshot model must exist first)  
**Detail:** Once P1-1 is done, add a Mac crontab entry calling `POST /api/snapshots/net-worth` on the 1st of each month at midnight. Instructions in P1-1.

### [P4-3] Recurring Engine Daily Trigger
**Blocked by:** P2-1 (recurring engine must exist first)  
**Detail:** Once P2-1 is done, add a Mac crontab entry calling `POST /api/recurring/post-due` at 6am daily. See RECURRING.md Option A.

---

## Done

*Items will be moved here as they are completed.*

---

*BACKLOG.md — Last audited April 26, 2026*
