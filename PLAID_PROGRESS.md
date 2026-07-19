# Plaid Integration — Phase Progress Tracker

Tracks implementation progress for P4-1 (Plaid Integration, see `BACKLOG.md` and `PLAID.md`) plus the Import Review Queue feature folded in alongside it (see Phase 2). Update the status column as each phase completes so work can resume cleanly across sessions.

**Status legend:** `Not Started` / `In Progress` / `Complete` / `Blocked`

| Phase | Description | Status | Depends On |
|---|---|---|---|
| 1 | Schema & Migration (Plaid) | Complete | — |
| 2 | Import Review Queue (CSV + Plaid) | Complete | Phase 1 |
| 3 | Core Infrastructure (Plaid client, encryption) | Complete | Phase 1 |
| 4 | API Routes (link-token, exchange-token, sync, items) | Not Started | Phase 3 |
| 5 | Reconciliation Guard (recurring engine + autoPost validation) | Not Started | Phase 4 |
| 6 | Category Mapping & Amount Convention | Not Started | Phase 4, Phase 2 |
| 7 | Frontend (Connect button, connections settings pages) | Not Started | Phase 4 |
| 8 | Automated Tests | Not Started | Phases 2–7 |
| 9 | Sandbox End-to-End Verification | Not Started | Phase 8 + user Phase A/B (`PLAID_SETUP_CHECKLIST.md`) |
| 10 | Production Cutover (DB clear + real bank connections) | Not Started | Phase 9 + user Phase C (`PLAID_SETUP_CHECKLIST.md`) |
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

## Phase 4 — API Routes
- [ ] `POST /api/plaid/link-token`
- [ ] `POST /api/plaid/exchange-token`
- [ ] `POST /api/plaid/sync` (cursor-based, paginated, upsert + soft-delete removed) — **sets `needsReview: true` on every newly-added transaction** (see Phase 2 note)
- [ ] `GET /api/plaid/items` (never returns `accessToken`)
- [ ] `DELETE /api/plaid/items/[id]`

## Phase 5 — Reconciliation Guard
- [ ] `plaidManaged: false` filter added to due-rule query in `lib/recurringEngine.ts`
- [ ] `autoPost` + `plaidManaged` validation (422) in `POST /api/recurring`
- [ ] Balance sync at end of `POST /api/plaid/sync` (Plaid balance → `Account.balance`)

## Phase 6 — Category Mapping & Amount Convention
- [ ] `lib/plaidCategories.ts` — `PLAID_CATEGORY_MAP`
- [ ] Amount sign conversion applied correctly in sync route (Plaid positive = expense → our negative)

## Phase 7 — Frontend
- [ ] `npm install react-plaid-link`
- [ ] `components/plaid/ConnectAccountButton.tsx`
- [ ] `/settings/connections` page — list institutions, sync status, disconnect
- [ ] `/settings/connections/[id]` page — map Plaid accounts to local accounts

## Phase 8 — Automated Tests
- [ ] `lib/crypto.test.ts`
- [ ] `app/api/plaid/link-token/route.test.ts`
- [ ] `app/api/plaid/exchange-token/route.test.ts`
- [ ] `app/api/plaid/sync/route.test.ts`
- [ ] `app/api/plaid/items/route.test.ts` (+ `[id]` DELETE)
- [ ] `lib/recurringEngine.test.ts` updated — asserts `plaidManaged: false` filter present
- [ ] `app/api/transactions/review/route.test.ts`
- [ ] `app/api/transactions/[id]/review/route.test.ts`
- [ ] Report/budget/insight route tests updated — assert `needsReview: false` present in queries
- [ ] Full suite green (`npx jest`)

## Phase 9 — Sandbox End-to-End Verification
- [ ] User completes `PLAID_SETUP_CHECKLIST.md` Phase A (dev account, sandbox keys, encryption key)
- [ ] Full Link → exchange → sync flow tested with `user_good` / `pass_good`
- [ ] Confirm synced transactions land in the review queue, not straight into reports
- [ ] Sandbox error-state login tested (expired token / MFA)

## Phase 10 — Production Cutover
- [ ] User completes `PLAID_SETUP_CHECKLIST.md` Phase C (Development access, real env vars)
- [ ] **Confirm with user before executing** — clear `Transaction`, `Transfer`, `NetWorthRecord` data
- [ ] Connect both real institutions via Plaid Link
- [ ] Map Plaid accounts to local `Account` records, confirm `plaidManaged: true`
- [ ] Initial sync run, spot-check results, work through the review queue
- [ ] Refine `lib/plaidCategories.ts` against real transaction categories
- [ ] Run transfer detection / link transfers via suggestions panel

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
