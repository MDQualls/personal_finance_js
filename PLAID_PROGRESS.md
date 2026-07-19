# Plaid Integration — Phase Progress Tracker

Tracks implementation progress for P4-1 (Plaid Integration, see `BACKLOG.md` and `PLAID.md`) plus the Import Review Queue feature folded in alongside it (see Phase 2). Update the status column as each phase completes so work can resume cleanly across sessions.

**Status legend:** `Not Started` / `In Progress` / `Complete` / `Blocked`

| Phase | Description | Status | Depends On |
|---|---|---|---|
| 1 | Schema & Migration (Plaid) | Complete | — |
| 2 | Import Review Queue (CSV + Plaid) | Complete | Phase 1 |
| 3 | Core Infrastructure (Plaid client, encryption) | Complete | Phase 1 |
| 4 | API Routes (link-token, exchange-token, sync, items) | Complete | Phase 3 |
| 5 | Reconciliation Guard (recurring engine + autoPost validation) | Complete | Phase 4 |
| 6 | Category Mapping & Amount Convention | Complete | Phase 4, Phase 2 |
| 7 | Frontend (Connect button, connections settings pages) | Complete | Phase 4 |
| 8 | Automated Tests | Complete | Phases 2–7 |
| 9 | Sandbox End-to-End Verification | Complete | Phase 8 + user Phase A/B (`PLAID_SETUP_CHECKLIST.md`) |
| 10 | Production Cutover (DB clear + real bank connections) | In Progress | Phase 9 + user Phase C (`PLAID_SETUP_CHECKLIST.md`) |
| 11 | Documentation & Closeout | Not Started | Phase 10 |

---

## Phase 1 — Schema & Migration ✓
**Status:** Complete — 2026-07-19
- [x] Add `PlaidItem` model (`prisma/schema.prisma`)
- [x] Add `PlaidAccount` model
- [x] Add `PlaidItemStatus` enum
- [x] Add `plaidManaged` boolean + `plaidAccount` relation to `Account`
- [x] Add `plaidTransactionId` (unique, optional) to `Transaction`
- [x] Run migration — `20260719151234_add_plaid_integration` (generated via `prisma migrate diff` + `migrate deploy`, since `migrate dev` requires an interactive TTY not available via `docker compose exec` from this shell — see Session Notes)
- [x] Update `types/index.ts` with new types (`PlaidItem`, `PlaidAccount`, `PlaidItemStatus`, plus `plaidManaged` on `Account` and `plaidTransactionId` on `Transaction`)
- [x] Fixed test factories (`__tests__/factories/account.ts`, `transaction.ts`) and `lib/transactionExport.test.ts` local mocks to include new required fields
- [x] `npx tsc --noEmit` clean, full suite green (404/404 tests)

---

## Phase 2 — Import Review Queue (CSV + Plaid) ✓

**Status:** Complete — 2026-07-19
**Origin:** User request 2026-07-19 — imported transactions (CSV or Plaid) should never blindly trust an auto-assigned category. They need to sit in a reviewable queue until explicitly approved or corrected.

**Implementation deviated from the original spec below in a few ways — noted here since the checklist was written before building:**
- No separate `/api/transactions/review` or `/api/transactions/[id]/review` routes were created. Reused the existing `GET /api/transactions` (added a `needsReview=true` filter param, same pattern as `excludeTransfers`) and existing `PATCH /api/transactions/[id]` (added `needsReview` as an optional Zod field — approval is just `{ needsReview: false, categoryId }` through the existing edit endpoint). Simpler, no new abstraction needed.
- The "reuse the existing P2-9 transfer-link expand pattern" assumption was wrong — that pattern doesn't actually exist in `TransactionRow.tsx` (BACKLOG.md described it but it wasn't literally built that way). Built a new lightweight expand/collapse section instead, scoped to review mode only.
- The expand panel does **not** show "raw unnormalized description" as originally planned — the CSV import route normalizes the description before storing, and the original raw string isn't persisted anywhere. Would require a new schema field to add; not built (scope decision, flagged to user). The panel shows account, date, source (Plaid/CSV inferred from `plaidTransactionId`), and notes instead.
- Sidebar count badge is computed once per layout render (Server Component `prisma.transaction.count`), not live-polled. Client mutations that affect the count (approve, delete, restore) call `router.refresh()` to keep it in sync — consistent with the existing P3-1 `router.refresh()` convention in this codebase.

### Decisions on record
- Applies to **both** CSV import and Plaid sync — not Plaid-only.
- New field, **not** a repurposing of `isValidated` (which stays a general per-row "I've looked at this" toggle used across all transactions, manual entries included).
- Transactions with `needsReview: true` are **excluded from all report/budget/insight aggregates** until approved — same treatment as `isTransfer` in P2-9.
- Dedicated route `/transactions/review`, surfaced as a **tab** on the existing Transactions page (alongside Active/Deleted) rather than a new top-level sidebar item — consistent with the Active/Archived and Active/Cancelled tab pattern already used on Budgets and Subscriptions.
- Sidebar "Transactions" nav item gets a **count badge** when `needsReview` transactions exist — must be hard to miss.
- Row shows enough to decide in the common case (date, description, amount, account, inline category dropdown) plus an **expandable detail** affordance reusing the existing `TransactionRow` expand pattern (already built for transfer-link info in P2-9) for the confusing cases — raw description, source (CSV/Plaid), Plaid's suggested category detail, notes, account.
- **Deferred, not in scope for v1:** bulk "approve all" action. Revisit only if manual per-row approval becomes a real friction point once Plaid import volume is flowing.

### Steps
- [x] Schema: add `needsReview Boolean @default(false)` to `Transaction` (`prisma/schema.prisma`), migrated (`20260719153259_add_needs_review`)
- [x] Update `types/index.ts` — add `needsReview` to `Transaction` type
- [x] `app/api/transactions/import/route.ts` (CSV) — set `needsReview: true` on every created row
- [x] Add `needsReview: false` to every report/budget/insight aggregate query:
  - `lib/reports.ts` (`getSpendingByCategory()`, `getMonthlyTrends()`) — `getBudgetActual` doesn't exist as a lib function; that logic lives inline in the route below
  - `app/api/reports/spending/route.ts` / `trends/route.ts` — no direct query, covered via `lib/reports.ts`
  - `app/api/reports/budget-actual/route.ts` — direct `aggregate()` call, updated
  - `app/api/insights/generate/route.ts` — both `findMany` calls (current + prior period)
  - `app/api/budgets/route.ts` — direct `aggregate()` call, updated
  - `lib/projection.ts` — confirmed **not** touched; projections track real cash flow same as transfers
- [x] `GET /api/transactions` — extended with `needsReview=true` filter param (reused existing route instead of a new one)
- [x] `PATCH /api/transactions/[id]` — extended with optional `needsReview` field (reused existing route; approve = `{ needsReview: false, categoryId }`)
- [x] `app/(dashboard)/transactions/review/page.tsx` — dedicated route, renders `TransactionsClient` with `initialTab="review"`
- [x] Review tab UI in `TransactionsClient.tsx` alongside Active/Deleted
- [x] Inline category `<select>` per row in the review view
- [x] Expandable row detail (new expand/collapse section, review-mode only) — account, date, source (Plaid/CSV), notes
- [x] Sidebar badge — `components/layout/Sidebar.tsx` renders amber count badge on "Transactions" nav item, count computed in `DashboardLayout` server-side
- [x] CSV import "done" screen links to `/transactions/review` and calls `router.refresh()` so the badge is current
- [ ] **Reminder for Phase 4:** Plaid sync route must set `needsReview: true` on every newly-added transaction — not done yet, Phase 4 doesn't exist

### Files Created
| File | Purpose |
|---|---|
| `app/(dashboard)/transactions/review/page.tsx` | Dedicated review route |
| `components/ui/TransactionRow.test.tsx` | New component tests for review-mode behavior |

### Files Modified
| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `needsReview` to `Transaction` |
| `types/index.ts` | Add `needsReview` to `Transaction` type |
| `app/api/transactions/import/route.ts` | Set `needsReview: true` on create |
| `lib/reports.ts` | Add `needsReview: false` to both aggregate functions |
| `app/api/reports/budget-actual/route.ts` | Add `needsReview: false` |
| `app/api/insights/generate/route.ts` | Add `needsReview: false` (both queries) |
| `app/api/budgets/route.ts` | Add `needsReview: false` |
| `app/api/transactions/route.ts` | Add `needsReview` filter param |
| `app/api/transactions/[id]/route.ts` | Add `needsReview` to Zod schema |
| `components/ui/TransactionRow.tsx` | Inline category dropdown, Approve button, expand detail |
| `app/(dashboard)/transactions/TransactionsClient.tsx` | Review tab, approve handler, router.refresh() wiring |
| `app/(dashboard)/layout.tsx` | Fetch `reviewCount`, pass to `Sidebar` |
| `components/layout/Sidebar.tsx` | Pending-review count badge |
| `app/(dashboard)/transactions/import/page.tsx` | Link to review queue + refresh after import |
| `__tests__/factories/transaction.ts`, `lib/transactionExport.test.ts` | Add `needsReview` default to mocks |
| `app/api/transactions/import/route.test.ts`, `transactions/route.test.ts`, `transactions/[id]/route.test.ts`, `reports/budget-actual/route.test.ts`, `budgets/route.test.ts`, `insights/generate/route.test.ts` | New test coverage for `needsReview` behavior |

**Verified:** `tsc --noEmit` clean, full suite green (417/417 tests, up from 404 — 13 new tests). All touched routes confirmed to compile with zero server errors (curl + docker logs check — no Chrome extension connected this session for full click-through browser verification).

---

## Phase 3 — Core Infrastructure ✓
**Status:** Complete — 2026-07-19
- [x] `npm install plaid` (v43.0.0) — confirmed zero new vulnerabilities via `npm audit` (all 16 pre-existing findings trace to unrelated deps: next, eslint-config-next, next-auth, babel, etc. — none to `plaid`)
- [x] `lib/plaid.ts` — Plaid client singleton, server-only, reads `PLAID_ENV`/`PLAID_CLIENT_ID`/`PLAID_SECRET` from `process.env`
- [x] `lib/crypto.ts` — AES-256-GCM `encryptToken` / `decryptToken`
- [x] `lib/crypto.test.ts` — round-trip, empty string, non-deterministic ciphertext (unique IV per call), tamper detection (auth tag), missing-key error path. Added now rather than deferred to Phase 8 since this is security-critical code (encrypts the Plaid access token at rest)
- [ ] Env vars **not yet** written to `.env.local` — `PLAID_CLIENT_ID`/`PLAID_SECRET`/`PLAID_ENV`/`ENCRYPTION_KEY` remain the user's task per `PLAID_SETUP_CHECKLIST.md` Phase A. Code reads them via `process.env` and fails gracefully (clear error, not a crash) if absent.

**Deviation from the PLAID.md spec:** `lib/crypto.ts` reads `ENCRYPTION_KEY` lazily inside a `getKey()` helper on each call, not as a module-top-level `const`. The spec's version computes the key at import time (`Buffer.from(process.env.ENCRYPTION_KEY!, 'base64')` at module scope) — that throws immediately on import if the env var is unset, which would crash Jest's coverage collector (it imports every `lib/**/*.ts` file) well before the user has done any Plaid account setup. Lazy lookup defers the failure to actual encrypt/decrypt calls, which don't happen until Phase 9/10.

**Verified:** `tsc --noEmit` clean, full suite green (424/424 — 7 new crypto tests). All routes still compile with zero server errors after adding the new lib files (curl + docker logs check).

## Phase 4 — API Routes ✓
**Status:** Complete — 2026-07-19
- [x] `POST /api/plaid/link-token`
- [x] `POST /api/plaid/exchange-token` — creates `PlaidItem` + unlinked `PlaidAccount` rows (`accountId` null); mapping to local `Account` records happens later via the Phase 7 connections UI, not automatically here
- [x] `POST /api/plaid/sync` (cursor-based, paginated, upsert + soft-delete removed) — **sets `needsReview: true` on every newly-created transaction** (Phase 2 dependency, confirmed wired)
- [x] `GET /api/plaid/items` (never returns `accessToken` — response is explicitly reshaped, not a raw Prisma passthrough)
- [x] `DELETE /api/plaid/items/[id]`

**Deviations / notes:**
- Amount sign conversion (Plaid positive = expense → our negative cents) was implemented now rather than deferred to Phase 6 as originally scoped — it's pure correctness with no dependency on the category map, and shipping a known-wrong sign felt worse than just doing it right the first time. `toLocalAmountCents()` in `app/api/plaid/sync/route.ts`.
- Category resolution in the sync route is a **naive contains-match placeholder** (`resolveCategoryId()`), matching the original PLAID.md-era example. Phase 6 still needs to replace this with `lib/plaidCategories.ts`'s `PLAID_CATEGORY_MAP` — not a real improvement over fuzzy matching until that lookup table exists.
- Descriptions from Plaid now go through the same `sanitizeString` + `normalizeDescription` pipeline as CSV import (merchant rules apply to Plaid transactions too). Extracted `sanitizeString` out of `app/api/transactions/import/route.ts` into `lib/normalize.ts` since it's now a shared concern across both import sources.
- **`Account.balance` is NOT updated by this sync route yet** — that's explicitly Phase 5 (Reconciliation Guard) work per PLAID.md's "Balance Sync" section, which pulls Plaid's authoritative balance rather than computing deltas from transaction amounts (avoids drift from pending transactions/fees). This means running a real sync before Phase 5 lands would leave account balances stale at whatever they were set to when the local `Account` was created/mapped. Not a practical risk yet — nothing can invoke this route today: no `.env.local` Plaid credentials, no frontend Connect/Sync button (Phase 7), no Sandbox verification (Phase 9) done.
- No automated tests added yet — deliberately deferred to Phase 8, consistent with the existing phase split. The sync route's internals will still change in Phase 5 (balance sync, `plaidManaged` guard) and Phase 6 (real category map), so tests written now would need rewriting almost immediately.
- `tsc --noEmit` clean, full suite still green (424/424 — no new tests this phase, see above). `npx prisma validate` clean. `eslint` could not be verified — pre-existing repo-wide issue (`@typescript-eslint/no-explicit-any` / `no-unused-vars` rule definitions not found for **any** file, confirmed on `next.config.js` and other unmodified files too — not something this session introduced. Worth fixing separately.

## Phase 5 — Reconciliation Guard ✓
**Status:** Complete — 2026-07-19
- [x] `plaidManaged: false` filter added to due-rule query in `lib/recurringEngine.ts` — replaced the placeholder comment that was already there
- [x] `autoPost` + `plaidManaged` validation (422) in `POST /api/recurring` — `app/api/recurring/route.test.ts` already had `prismaMock.account.findUnique.mockResolvedValue({ plaidManaged: false })` staged in its POST tests from a prior session, confirming this was the intended shape
- [x] Balance sync at end of `POST /api/plaid/sync` (`accountsBalanceGet` → `Account.balance`, per PLAID.md's "Balance Sync" section) — closes the gap flagged in the Phase 4 notes above

**Known gap — not closed this phase, flagging so it isn't forgotten:** `PATCH /api/recurring/[id]` does **not** enforce the `plaidManaged` guard. A rule could still be edited after creation to set `autoPost: true` on (or reassign to) a Plaid-managed account and bypass the check. Scoped out because: (1) the phase checklist only names `POST /api/recurring`, and (2) `app/api/recurring/[id]/route.test.ts`'s existing PATCH tests don't stub a rule/account lookup, so adding the fetch-then-validate logic needed for PATCH would require rewriting those tests rather than just extending them — treated as Phase 8 scope instead of expanding Phase 5 unprompted. Worth closing before Phase 10 (production cutover) actually connects real accounts.
- [x] `tsc --noEmit` clean, full suite still green (424/424, no test changes needed — existing mocks already covered the new code paths). `prisma validate` clean.

## Phase 6 — Category Mapping & Amount Convention ✓
**Status:** Complete — 2026-07-19
- [x] `lib/plaidCategories.ts` — `PLAID_CATEGORY_MAP`, mapping Plaid's 16-value `personal_finance_category.primary` taxonomy to the actual local category names seeded in `prisma/seed.ts` (not the illustrative names from PLAID.md's example, which don't match this app's real categories — e.g. `MEDICAL` → `'Health & Medical'` not `'Healthcare'`, `TRANSFER_IN`/`TRANSFER_OUT` → `'Transfers'` not `'Transfer'`)
- [x] Amount sign conversion — already done in Phase 4 (`toLocalAmountCents()`), nothing left to do here

**Deviations:**
- 4 of Plaid's primary categories (`LOAN_PAYMENTS`, `BANK_FEES`, `GENERAL_SERVICES`, `GOVERNMENT_AND_NON_PROFIT`) are deliberately left out of the map — there's no reasonable local category for them yet, and forcing a mismatch would be worse than falling back to Uncategorized. Add local categories for these if they show up often in real sync data.
- `resolveCategoryId()` in `app/api/plaid/sync/route.ts` now does an **exact** name match against the mapped category (`isActive: true`), replacing the old `contains`/fuzzy match placeholder from Phase 4 entirely — deterministic instead of guessable.
- `tsc --noEmit` clean, full suite still green (424/424, no test changes needed — no Plaid route tests exist yet, still Phase 8 scope).

## Phase 7 — Frontend ✓
**Status:** Complete — 2026-07-19
- [x] `npm install react-plaid-link` (v4.1.1) — `npm audit` confirms zero new vulnerabilities, same 16 pre-existing findings as before, none traced to this package
- [x] `components/plaid/ConnectAccountButton.tsx` — wraps `usePlaidLink`; auto-opens the widget once the token is fetched and the script is ready (a `useEffect`, not PLAID.md's two-click example) for a one-click flow instead of "fetch token" then "open" as two separate clicks
- [x] `/settings/connections` page + `ConnectionsClient.tsx` — lists institutions with status badge, last-synced time, per-account linked/not-linked state and balance, Sync Now, Manage/Map Accounts, Disconnect
- [x] `/settings/connections/[id]` page + `ConnectionMappingClient.tsx` — per-Plaid-account mapping UI: pick an existing unlinked local `Account` or create a new one inline
- [x] New supporting route not in the original PLAID.md spec: `PATCH /api/plaid/accounts/[id]` — links a `PlaidAccount` to a local `Account` (existing or newly created), sets `plaidManaged: true` in both cases. Needed because PLAID.md's Phase 7 checklist calls for a mapping page but never specifies the route that performs the actual mapping.
- [x] `next.config.js` CSP updated: `script-src`/`frame-src` allow `cdn.plaid.com` (Plaid Link's widget), `connect-src` allows Plaid's sandbox/development/production API hosts. Required for Link to function at all — not optional.
- [x] Sidebar: added "Connections" item (Landmark icon) to the Settings section in `components/layout/Sidebar.tsx`

**Browser-verified end-to-end** (Chrome extension connected mid-session, full click-through completed — not just `tsc`/tests this time):
- Empty state renders correctly, no console errors
- "Connect Bank Account" fails gracefully with "Failed to start connection" (expected — no real `PLAID_CLIENT_ID`/`SECRET` set yet); confirmed server-side the failure is Plaid correctly rejecting empty credentials, not a bug
- Inserted a throwaway `PlaidItem`/`PlaidAccount` directly via SQL to exercise the list and mapping UI with real data (cleaned up afterward, not left in the DB)
- Connections list correctly showed the institution, "Not linked" badge, and account row
- Mapping page: dropdown correctly listed real existing unlinked accounts (queried via `plaidAccount: null`) plus "+ Create new account"; creating a new account end-to-end produced a real `Account` row with `plaidManaged: true`, `balance: 0`, correct `type` — row then correctly flipped to the "✓ Linked to [name]" read-only state
- Connections list then reflected the linked balance and switched the button from "Map Accounts (1)" to "Manage"
- Sync Now and Disconnect both fail gracefully (expected, fake/no real Plaid credentials) with inline error text, no crash
- `/settings/connections/[nonexistent-id]` renders the standard Next.js 404 inside the dashboard shell (`notFound()`)
- **Caught mid-session:** clicking Disconnect triggers a native `confirm()` dialog, which froze browser automation (a known limitation of the testing tool, not a bug — `confirm()` for destructive actions is this codebase's established pattern, used identically in accounts, budgets, subscriptions, recurring, tags, rules, and transactions). User manually dismissed it to unblock.
- `tsc --noEmit` clean, `prisma validate` clean, full suite still green (424/424, no test changes needed — still Phase 8 scope, and no Plaid UI components have tests yet either)

## Phase 8 — Automated Tests ✓
**Status:** Complete — 2026-07-19
- [x] `lib/crypto.test.ts` — already existed (added early in Phase 3 for security-criticality reasons)
- [x] `app/api/plaid/link-token/route.test.ts` — 100% coverage
- [x] `app/api/plaid/exchange-token/route.test.ts` — 100% coverage
- [x] `app/api/plaid/sync/route.test.ts` — 100% coverage (15 tests: auth, validation, 404, amount sign conversion both directions, unmapped-account skip, category map hit/fallback/no-category-at-all/missing-Uncategorized-500, removed-transaction soft-delete, pagination, balance sync incl. null-balance skip, general 500)
- [x] `app/api/plaid/items/route.test.ts` (GET) — 100% coverage, includes an explicit assertion that `accessToken` never appears in the JSON response
- [x] `app/api/plaid/items/[id]/route.test.ts` (DELETE) — 100% coverage
- [x] `app/api/plaid/accounts/[id]/route.test.ts` (PATCH, Phase 7 addition not in the original checklist) — 100% coverage, both the link-existing and create-new branches
- [x] `lib/recurringEngine.test.ts` — added the missing assertion for the `plaidManaged: false` filter (guard itself shipped in Phase 5, no test explicitly checked for it until now)
- [x] `app/api/recurring/route.test.ts` — added the missing 422-rejection test for `autoPost: true` on a Plaid-managed account, plus a test confirming `autoPost: false` is allowed (guard shipped in Phase 5, same gap as above)
- [x] Two new factories: `__tests__/factories/plaidItem.ts`, `__tests__/factories/plaidAccount.ts`
- [x] Full suite green: 464/464 (up from 424 — 40 new tests)

**Skipped, deliberately:**
- `app/api/transactions/review/route.test.ts` and `app/api/transactions/[id]/review/route.test.ts` — these routes were never built. Phase 2 reused the existing `GET /api/transactions` (`needsReview=true` filter param) and `PATCH /api/transactions/[id]` instead, and both already have test coverage for that behavior from Phase 2. This checklist item predates that decision and is stale.
- Report/budget/insight `needsReview: false` test assertions — already added in Phase 2 (`reports/budget-actual`, `budgets`, `insights/generate` route tests). Nothing new needed.
- Component tests for `ConnectAccountButton`, `ConnectionsClient`, `ConnectionMappingClient` — matches this codebase's established convention: page-level `*Client.tsx` orchestration components (`AccountsClient`, `BudgetsClient`, `SubscriptionsClient`, `RecurringClient`, etc.) have never had tests, only small reusable primitives (`TransactionRow`, `BudgetProgress`) do. These three fit the former pattern. Their actual business logic (token exchange, account creation/linking, sync/disconnect) is already covered by the API route tests.

**Coverage note:** the global coverage gate in `jest.config.js` (80% lines/statements/branches/functions) was already failing before this phase — confirmed via `git stash` comparison against the Phase 7 commit: 52.74%/45.74%/42.8%/52.91% baseline, now 61.2%/49.68%/47.48%/61.31% after Phase 8's additions. This is pre-existing, project-wide tech debt (most page-level components across the whole app, not just Plaid, have no tests) — not something this phase introduced, and fixing it is out of scope for a Plaid-focused phase. The pre-commit hook already runs `--no-coverage`, so this has never actually gated anything. Worth a BACKLOG.md entry if the user wants it enforced for real.
- [x] `tsc --noEmit` clean, all 6 Plaid API routes individually verified at 98.6–100% coverage (well above the 90% CLAUDE.md bar for API route handlers)

## Phase 9 — Sandbox End-to-End Verification ✓
**Status:** Complete — 2026-07-19
- [x] User completed `PLAID_SETUP_CHECKLIST.md` Phase A (dev account, sandbox keys, encryption key) — verified all four `.env.local` vars present, `PLAID_ENV=sandbox`
- [x] Full Link → exchange → sync flow tested with `user_good` / `pass_good` against First Platypus Bank — exchange-token, account mapping, and sync (48 transactions) all succeeded; balance synced from $0.00 → $110.00
- [x] Confirmed synced transactions land in the review queue (`needsReview: true`) — verified in `/transactions/review`, approve flow tested
- [x] Confirmed amount sign conversion and category mapping are correct against real Sandbox data (Uber → Transportation, McDonald's/Starbucks → Food & Dining, United Airlines credit → Travel positive)
- [x] Reconciliation guard re-verified against a real synced Plaid-managed account (not just mocks): `POST /api/recurring` with `autoPost: true` correctly returned 422
- [x] Sandbox error-state login tested — forced a real `ITEM_LOGIN_REQUIRED` via Plaid's `sandbox/item/reset_login` API and confirmed via server logs

**Gap found and fixed this phase — the re-auth path did not exist before today:**
Forcing `ITEM_LOGIN_REQUIRED` and clicking Sync Now produced only a generic "Sync failed" 500 with no status change and no reconnect affordance — `PlaidItemStatus.ERROR` and the "Needs Attention" badge existed in schema/UI but nothing ever set them, and Link update mode wasn't implemented. Built and verified end-to-end in the same session:
- `app/api/plaid/link-token/route.ts` — accepts optional `plaidItemId`; when present, decrypts the item's access token and calls `linkTokenCreate` in Link's update mode (no `products`) instead of creating a fresh item
- `app/api/plaid/sync/route.ts` — added `getPlaidErrorCode()` (structural narrowing of the Axios error shape, not a dependency on axios's types since axios is only transitive here); on `ITEM_LOGIN_REQUIRED` specifically, sets `PlaidItem.status = 'ERROR'` and returns 409 (other error codes still fall through to the existing generic 500 — deliberately narrow, only handling the one code PLAID.md called out)
- `app/api/plaid/items/[id]/route.ts` — new `PATCH`, Zod-restricted to `{ status: 'ACTIVE' }` only (the one transition a client should be able to request — every other status change already happens server-side)
- `components/plaid/ConnectAccountButton.tsx` — now takes a discriminated `mode: 'connect' | 'reconnect'` prop; reconnect mode fetches the update-mode link token and, since Plaid doesn't require re-exchanging the token in update mode, just PATCHes the item back to ACTIVE on Link's `onSuccess`
- `ConnectionsClient.tsx` — renders `Reconnect` instead of `Sync Now` when `status === 'ERROR'`, shows a specific "needs to be reconnected" message on a 409 from Sync Now
- Verified the complete loop live in Sandbox on the broken test item: Sync Now → 409 → badge flips to "Needs Attention" → Reconnect → Plaid Link update-mode flow (skipped straight to password entry, already knew the username) → `pass_good` → PATCH → badge back to "Active" → Sync Now works again
- 9 new tests added across the three route test files (473/473 total passing), `tsc --noEmit` clean
- Browser automation note for future sessions: coordinate-based clicks were unreliable inside the Plaid Link iframe in this environment (clicks landed but didn't register); keyboard navigation (Tab to focus, Enter to activate) worked reliably instead — use that approach first for any future Link automation in Chrome extension sessions.

All disposable Sandbox test data from this phase (the throwaway `PlaidItem` and `Sandbox Test Checking` account) was cleaned up afterward — item disconnected via `DELETE /api/plaid/items/[id]`, account archived via `isActive: false` (never hard-deleted, per the standing data-integrity rule).

## Phase 10 — Production Cutover (in progress)
**Status:** In Progress — started 2026-07-19
- [x] User completed `PLAID_SETUP_CHECKLIST.md` Phase C — **used Production environment, not Development** as the checklist originally specified. Confirmed intentional with the user (Plaid Production approval already obtained); Production is billed per institution/API call, worth keeping in mind going forward.
- [x] **Confirmed with user before executing** — cleared all pre-Plaid data: 108 `Transaction` rows (107 active + 1 already soft-deleted), 0 `Transfer`, 0 `NetWorthRecord`. Also removed all leftover Sandbox test data in the same pass: the disconnected "First Platypus Bank" `PlaidItem`, its 12 `PlaidAccount` rows, and the archived "Sandbox Test Checking" `Account` (hard-deleted — it was fake test data, not real financial history, so the normal soft-delete/archive convention for accounts doesn't apply). Budgets (1), Subscriptions (12), and RecurringRules (3) were deliberately left untouched, as agreed.
- [x] Connected real institution via Plaid Link — **one connection, not two as originally planned**: both spouses bank at Oklahoma's Credit Union, so a single Plaid Link connection (Production) exposes all 7 accounts across both people.
- [x] Mapped 5 of 7 returned Plaid accounts to local `Account` records, `plaidManaged: true` confirmed on each: `Holly CC 4147`, `OKCU Savings 8650`, `Holly Checking 8660`, `Holly Savings 8680`, `OKCU 8690`. The remaining 2 (`Savings •8110`, `Free Checking •8120`) are intentionally left unmapped — user confirmed these will never be tracked in this app. The sync route already skips any Plaid account with no local mapping, so this is a stable end state, not a TODO.
- [x] Initial sync run by the user — succeeded, balances updated, transactions landed in the review queue as expected. **User is now working through the review queue** (approve/edit/recategorize) — in progress as of session end, not yet complete.
- [ ] Refine `lib/plaidCategories.ts` against real transaction categories — hold until the review queue pass is finished and real miscategorization patterns are visible
- [ ] Run transfer detection / link transfers via suggestions panel — hold until the review queue pass is finished

**Gap surfaced during this phase, not yet closed:** `PATCH /api/recurring/[id]` still doesn't enforce the `plaidManaged` guard that `POST /api/recurring` has had since Phase 5 (see Phase 5 section above — this was explicitly flagged to close "before Phase 10 connects real accounts," and real accounts are now connected). Checked all 3 live `RecurringRule` rows (`Subaru Payment`, `Yanmar - DLL Finance`, `M1`, all on the now-Plaid-managed `OKCU 8690` account) — all have `autoPost: false`, so there is no active double-posting happening right now. But nothing currently stops a PATCH from flipping one to `autoPost: true` on that account, which would start silently duplicating transactions against the live Plaid sync. **Must close next session, before moving on to P5 reporting work.**

**Also done this session, adjacent to Phase 10 but not part of the phase checklist — general security hardening** (user asked directly, tied to a stated personal-use security agreement: HTTPS for public traffic, encrypt at rest + delete when done, patched deps, no hardcoded secrets):
- `docker-compose.yml`: both `app` and `db` now bind to `127.0.0.1` only (app was previously `0.0.0.0:3000`, reachable by anything on the LAN over plain HTTP — now matches the "never actually public" reasoning that made HTTPS unnecessary).
- `PlaidItem.accessToken` is now nullable (migration `20260719205105_plaid_item_access_token_nullable`) and gets cleared on disconnect once the token is revoked at Plaid, instead of leaving dead ciphertext in the DB indefinitely. `sync` and `link-token` (update mode) both return `410` if called against an item whose token has already been cleared.
- `npm audit fix` (no `--force`) cleared 9 of 16 known vulnerabilities with zero breaking changes; rebuilt the Docker image so the running container actually picked up the patched lockfile (the dev container's `node_modules` is a separate anonymous volume from the host's, so a host-side `npm install`/`audit fix` alone doesn't reach the container without a rebuild — worth remembering for any future dependency work). Remaining 7 vulnerabilities all require `--force`, including a `next-auth` downgrade to a pre-1.0 beta that would be a regression, not a fix — left alone deliberately, flagged as a future explicit-upgrade decision, not fixed blindly.
- Committed as `f000d0d`, 476/476 tests green, `tsc --noEmit` clean.

## Phase 11 — Documentation & Closeout
- [ ] Update `BACKLOG.md` — mark P4-1 complete, move to Done
- [ ] Update `CLAUDE.md` project structure if new files/patterns warrant it
- [ ] Update auto-memory (`project_status.md`, `next_session.md`) with final state

---

*Update this file's status column and checkboxes as each phase completes. If a session ends mid-phase, leave it `In Progress` and note the last completed step at the bottom.*

## Session Notes
_(append here as work progresses)_

**2026-07-19:** Phase 1 complete. Note for future migrations on this project: `prisma migrate dev` fails with "environment is non-interactive" when run via `docker compose exec` from Claude Code's shell (no TTY). Workaround used: `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script` to generate the SQL into a manually-created `prisma/migrations/<timestamp>_<name>/migration.sql`, then `npx prisma migrate deploy` to apply and record it. Followed by `npx prisma generate` + `docker compose restart app` as usual.

**2026-07-19:** Import Review Queue scoped and inserted as new Phase 2 (renumbering all subsequent phases, old 2→3 through old 10→11). Covers both CSV and Plaid imports. Key design calls: new `needsReview` field (not reusing `isValidated`), excluded from reports until approved, `/transactions/review` as a tab on the existing Transactions page with a sidebar badge, inline category dropdown + expandable row detail (reusing the P2-9 transfer-link expand pattern) instead of a modal or separate popup. Bulk-approve explicitly deferred — revisit only if per-row approval becomes real friction once Plaid volume is flowing.

**2026-07-19 — Session end:** Phases 1–3 complete this session (schema/migration, import review queue, core Plaid infrastructure). 424 tests passing, `tsc --noEmit` clean, all three phases committed locally (`fa1ef5b`, `0399e9c`, `b48982b` — 3 commits ahead of `origin/main`, not yet pushed). **Next session starts at Phase 4 — Plaid API Routes** (link-token, exchange-token, sync, items GET/DELETE). Phase 4's sync route must remember to set `needsReview: true` on every newly-added transaction (Phase 2 dependency, noted in Phase 4's checklist below). No `.env.local` Plaid/encryption values have been set yet — still the user's task per `PLAID_SETUP_CHECKLIST.md` Phase A, needed before Phase 9 (Sandbox verification) but not before Phase 4 can be built.

**2026-07-19 — Phase 4 complete:** Built all 5 API routes (`link-token`, `exchange-token`, `sync`, `items` GET, `items/[id]` DELETE). `needsReview: true` confirmed wired on transaction creation in the sync route. See the Phase 4 section above for the full deviation list — notably: amount sign conversion was done now instead of deferred to Phase 6, `Account.balance` is intentionally NOT touched yet (Phase 5), category resolution is still a naive placeholder pending Phase 6's `PLAID_CATEGORY_MAP`, and no tests were added yet (deferred to Phase 8 since the sync route body will change again in Phases 5–6). 424 tests still green, `tsc --noEmit` and `prisma validate` clean. Committed as `3198d22`.

**2026-07-19 — Phase 5 complete:** Wired the `plaidManaged: false` guard into `lib/recurringEngine.ts`'s due-rule query, added the `autoPost` + `plaidManaged` 422 validation to `POST /api/recurring`, and added balance sync (`accountsBalanceGet`) to the end of `POST /api/plaid/sync`. All three closed gaps that were explicitly called out or placeholder-commented in earlier phases. **Known gap carried forward: `PATCH /api/recurring/[id]` doesn't enforce the same guard yet** — see the Phase 5 section above for why it was scoped out (existing PATCH tests aren't set up for the required rule/account lookup) and a reminder to close it before Phase 10. 424 tests still green with zero test changes needed — the POST test file already had the `account.findUnique` mock staged from a prior session. Committed as `913f7b5`.

**2026-07-19 — Phase 6 complete:** Built `lib/plaidCategories.ts` with a real `PLAID_CATEGORY_MAP` covering 12 of Plaid's 16 primary categories, mapped against the actual category names in `prisma/seed.ts` (corrected from PLAID.md's illustrative names, which don't match). `resolveCategoryId()` in the sync route now does an exact match against the mapped name instead of the old fuzzy `contains` placeholder. 4 Plaid categories have no local equivalent yet and intentionally fall back to Uncategorized — noted in the Phase 6 section above. 424 tests still green, `tsc --noEmit` clean, no test changes needed. Committed as `b763033`.

**2026-07-19 — Phase 7 complete:** Built the full frontend: `ConnectAccountButton`, `/settings/connections` (list/sync/disconnect), `/settings/connections/[id]` (map Plaid accounts to local accounts), sidebar nav entry, and CSP updates for Plaid Link. Added a route not in the original spec — `PATCH /api/plaid/accounts/[id]` — since PLAID.md's Phase 7 checklist never specified what actually performs the account mapping. **This phase got a real browser click-through** (Chrome extension connected mid-session), not just `tsc`/tests — see the Phase 7 section above for the full verification list, including a live end-to-end test of account creation via the mapping UI (real `Account` row created with `plaidManaged: true`). One incident: the Disconnect button's `confirm()` dialog froze browser automation — expected tool behavior, not a code bug, and the user dismissed it manually. Test DB rows were cleaned up after verification. 424 tests still green, `tsc --noEmit` and `prisma validate` clean. Committed as `b238a27`.

**2026-07-19 — Phase 8 complete:** Wrote tests for all 6 Plaid API routes (98.6–100% coverage each), closed two test gaps from earlier phases (`recurringEngine.test.ts`'s `plaidManaged` filter assertion, `POST /api/recurring`'s 422 rejection test — both guards shipped in Phase 5 without accompanying tests at the time), and added 2 new factories. 464/464 tests green, `tsc --noEmit` clean. Skipped 3 stale checklist items that referenced routes never actually built (Phase 2 reused existing routes instead) and deliberately skipped component tests for the 3 new frontend pieces, matching this codebase's established convention of not testing page-level `*Client.tsx` components. Confirmed via `git stash` that the project's 80% global coverage gate was already failing before this phase (52.7% baseline) — pre-existing, project-wide, out of scope here; noted for a possible future BACKLOG.md item. Not yet committed — awaiting user review.

**P4-1 is now fully code-complete through Phase 8.** Remaining phases are no longer "build more code" — they're verification and go-live:
- **Phase 9 — Sandbox Verification**: blocked on the user completing `PLAID_SETUP_CHECKLIST.md` Phase A (Plaid dev account, sandbox keys, `ENCRYPTION_KEY` in `.env.local`) — quick, ~10 min, no real bank credentials needed.
- **Phase 10 — Production Cutover**: real bank connections, and a destructive DB clear that needs explicit re-confirmation when it comes up.
- **Phase 11 — Documentation & Closeout**.

**Next session:** check whether the user has completed Phase A of `PLAID_SETUP_CHECKLIST.md`. If yes, proceed to Phase 9 (Sandbox Link → exchange → sync flow with Plaid's `user_good`/`pass_good` test credentials, plus an error-state login test). If not yet, Phase 8 was the last "no dependencies" phase — there's nothing further to build without it.

**2026-07-19 — Session end:** User is doing `PLAID_SETUP_CHECKLIST.md` Phase A manual setup (Plaid dev account, Sandbox keys, `ENCRYPTION_KEY`) outside this session, right after Phase 8 wrapped. All 8 code phases committed locally (`fa1ef5b` through `99cc799`) — **5 commits ahead of `origin/main`, not pushed.** Full suite green (464/464), `tsc --noEmit` and `prisma validate` clean as of the last commit. **Next session starts at Phase 9 — Sandbox End-to-End Verification.** Confirm the user's `.env.local` has `PLAID_CLIENT_ID`/`PLAID_SECRET`/`PLAID_ENV=sandbox`/`ENCRYPTION_KEY` set before starting (restart the app container after adding them so the running dev server picks up the new env vars), then run the full Link → exchange-token → sync flow using Plaid's `user_good`/`pass_good` Sandbox credentials, plus at least one Sandbox error-state login (expired token or MFA-required) to exercise the re-auth path.

**2026-07-19 — Session end (Phase 10 in progress):** Real cutover underway. Plaid Production connection to Oklahoma's Credit Union live (5 of 7 accounts mapped, 2 permanently excluded per user decision). All pre-Plaid transaction/transfer/net-worth history and all Sandbox test data wiped per the 7/13 standing decision. First real sync ran successfully; user is mid-way through manually reviewing/approving the synced transactions — not yet declared "100% accurate" by the user, so Phase 10's last two checklist items (category refinement, transfer detection pass) are intentionally on hold until that review is done. Also closed three general security-hardening items the same session (port binding, dead-token cleanup, dependency patches — see the dedicated note in the Phase 10 section above), committed as `f000d0d`, unrelated to the Plaid phase checklist itself.

**Next session must fully close out, in order, before touching P5 reporting:**
1. Close the `PATCH /api/recurring/[id]` `plaidManaged` guard gap (flagged since Phase 5, real accounts are connected now — see Phase 10 section above for exact current risk state, which is low but not zero).
2. Confirm with the user that their review-queue pass is done, then run the transfer detection / category-refinement checklist items.
3. Phase 11 — Documentation & Closeout (`BACKLOG.md`, `CLAUDE.md` if warranted, final memory update).

User was explicit: all of the above must be fully handled next session before moving on to P5 reporting enhancements.
