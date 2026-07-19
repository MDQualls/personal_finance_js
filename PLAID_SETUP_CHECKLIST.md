# Plaid Manual Setup Punch List

Manual, human-side steps for the P4-1 Plaid integration — accounts, credentials, and bank actions that Claude Code cannot do for you. See `PLAID.md` for the full technical spec.

**None of this blocks writing the code.** The schema, API routes, and UI can be implemented against nothing. It only matters once we're ready to run and test the integration.

---

## Phase A — Before we can test anything (minimum bar, ~10 min)

Needed once we reach the Sandbox test step in the build phase (PLAID.md step 9.8) — not before.

- [x] Sign up at https://dashboard.plaid.com/signup (free)
- [x] Create an application in the Plaid dashboard
- [x] Grab **Sandbox** keys (Client ID + Sandbox Secret)
- [x] Generate an encryption key: `openssl rand -base64 32`
- [x] Add to `.env.local`:
  ```
  PLAID_CLIENT_ID=...
  PLAID_SECRET=...          # sandbox secret
  PLAID_ENV=sandbox
  ENCRYPTION_KEY=...        # from openssl command above
  ```

## Phase B — Sandbox testing

- [x] Run the full Link → exchange → sync flow using Plaid's fake credentials: `user_good` / `pass_good` — done 2026-07-19, P4-1 Phase 9
- [x] Test at least one Sandbox error-state login (expired token or MFA-required) to exercise the re-auth UI path before it matters for real — done 2026-07-19; this uncovered the re-auth path wasn't built at all, which got built and verified the same session (see `PLAID_PROGRESS.md` Phase 9)

## Phase C — Going live with real banks

- [ ] Request **Development** environment access in the Plaid dashboard (real banks, free, up to 100 items — usually near-instant approval)
- [ ] Swap `.env.local` to the Development secret and `PLAID_ENV=development`
- [ ] Connect your checking account via "Connect Bank Account" → select bank → authenticate through Plaid's hosted widget (your bank credentials never touch this app)
- [ ] Connect your wife's account the same way
- [ ] On `/settings/connections/[id]`, map each Plaid-returned account to a local `Account` record (new or existing)
- [ ] Confirm `plaidManaged: true` is set correctly on every account Plaid now owns — this is the guard that stops the recurring engine from double-posting
- [ ] Review and expand `lib/plaidCategories.ts` after the first real sync — expect a manual pass reassigning a batch of transactions since Plaid's categories won't line up perfectly with yours on day one
- [ ] Trigger the first manual sync and eyeball the added/modified/removed counts before trusting it unattended

## Ongoing / optional

- [ ] Manual "Sync Now" click periodically — v1 has no auto-sync
- [ ] (Optional) Set up `ngrok` or deploy somewhere reachable if you later want webhook-triggered real-time sync instead of manual sync
- [ ] Re-authenticate (reconnect via Plaid Link) any time a `PlaidItem` status flips to `ERROR` — happens after a bank-forced password reset or new MFA requirement

---

*Reference: `PLAID.md` for the technical spec, `BACKLOG.md` P4-1 for build status.*
