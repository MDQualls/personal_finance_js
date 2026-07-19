# Plaid Integration — Phase Progress Tracker

Tracks implementation progress for P4-1 (Plaid Integration, see `BACKLOG.md` and `PLAID.md`). Update the status column as each phase completes so work can resume cleanly across sessions.

**Status legend:** `Not Started` / `In Progress` / `Complete` / `Blocked`

| Phase | Description | Status | Depends On |
|---|---|---|---|
| 1 | Schema & Migration | Complete | — |
| 2 | Core Infrastructure (Plaid client, encryption) | Not Started | Phase 1 |
| 3 | API Routes (link-token, exchange-token, sync, items) | Not Started | Phase 2 |
| 4 | Reconciliation Guard (recurring engine + autoPost validation) | Not Started | Phase 3 |
| 5 | Category Mapping & Amount Convention | Not Started | Phase 3 |
| 6 | Frontend (Connect button, connections settings pages) | Not Started | Phase 3 |
| 7 | Automated Tests | Not Started | Phases 2–6 |
| 8 | Sandbox End-to-End Verification | Not Started | Phase 7 + user Phase A/B (`PLAID_SETUP_CHECKLIST.md`) |
| 9 | Production Cutover (DB clear + real bank connections) | Not Started | Phase 8 + user Phase C (`PLAID_SETUP_CHECKLIST.md`) |
| 10 | Documentation & Closeout | Not Started | Phase 9 |

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

## Phase 2 — Core Infrastructure
- [ ] `npm install plaid`
- [ ] `lib/plaid.ts` — Plaid client singleton
- [ ] `lib/crypto.ts` — AES-256-GCM `encryptToken` / `decryptToken`
- [ ] Env vars wired: `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`, `ENCRYPTION_KEY`

## Phase 3 — API Routes
- [ ] `POST /api/plaid/link-token`
- [ ] `POST /api/plaid/exchange-token`
- [ ] `POST /api/plaid/sync` (cursor-based, paginated, upsert + soft-delete removed)
- [ ] `GET /api/plaid/items` (never returns `accessToken`)
- [ ] `DELETE /api/plaid/items/[id]`

## Phase 4 — Reconciliation Guard
- [ ] `plaidManaged: false` filter added to due-rule query in `lib/recurringEngine.ts`
- [ ] `autoPost` + `plaidManaged` validation (422) in `POST /api/recurring`
- [ ] Balance sync at end of `POST /api/plaid/sync` (Plaid balance → `Account.balance`)

## Phase 5 — Category Mapping & Amount Convention
- [ ] `lib/plaidCategories.ts` — `PLAID_CATEGORY_MAP`
- [ ] Amount sign conversion applied correctly in sync route (Plaid positive = expense → our negative)

## Phase 6 — Frontend
- [ ] `npm install react-plaid-link`
- [ ] `components/plaid/ConnectAccountButton.tsx`
- [ ] `/settings/connections` page — list institutions, sync status, disconnect
- [ ] `/settings/connections/[id]` page — map Plaid accounts to local accounts

## Phase 7 — Automated Tests
- [ ] `lib/crypto.test.ts`
- [ ] `app/api/plaid/link-token/route.test.ts`
- [ ] `app/api/plaid/exchange-token/route.test.ts`
- [ ] `app/api/plaid/sync/route.test.ts`
- [ ] `app/api/plaid/items/route.test.ts` (+ `[id]` DELETE)
- [ ] `lib/recurringEngine.test.ts` updated — asserts `plaidManaged: false` filter present
- [ ] Full suite green (`npx jest`)

## Phase 8 — Sandbox End-to-End Verification
- [ ] User completes `PLAID_SETUP_CHECKLIST.md` Phase A (dev account, sandbox keys, encryption key)
- [ ] Full Link → exchange → sync flow tested with `user_good` / `pass_good`
- [ ] Sandbox error-state login tested (expired token / MFA)

## Phase 9 — Production Cutover
- [ ] User completes `PLAID_SETUP_CHECKLIST.md` Phase C (Development access, real env vars)
- [ ] **Confirm with user before executing** — clear `Transaction`, `Transfer`, `NetWorthRecord` data
- [ ] Connect both real institutions via Plaid Link
- [ ] Map Plaid accounts to local `Account` records, confirm `plaidManaged: true`
- [ ] Initial sync run, spot-check results
- [ ] Refine `lib/plaidCategories.ts` against real transaction categories
- [ ] Run transfer detection / link transfers via suggestions panel

## Phase 10 — Documentation & Closeout
- [ ] Update `BACKLOG.md` — mark P4-1 complete, move to Done
- [ ] Update `CLAUDE.md` project structure if new files/patterns warrant it
- [ ] Update auto-memory (`project_status.md`, `next_session.md`) with final state

---

*Update this file's status column and checkboxes as each phase completes. If a session ends mid-phase, leave it `In Progress` and note the last completed step at the bottom.*

## Session Notes
_(append here as work progresses)_

**2026-07-19:** Phase 1 complete. Note for future migrations on this project: `prisma migrate dev` fails with "environment is non-interactive" when run via `docker compose exec` from Claude Code's shell (no TTY). Workaround used: `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script` to generate the SQL into a manually-created `prisma/migrations/<timestamp>_<name>/migration.sql`, then `npx prisma migrate deploy` to apply and record it. Followed by `npx prisma generate` + `docker compose restart app` as usual.
