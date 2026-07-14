# Transfer Detection — User Guide

## What Is a Transfer?

A **transfer** is money moving between **two accounts you own** that are both tracked in this app. Both sides of the movement exist as transactions in your database — one negative (money out) and one positive (money in).

**Examples of transfers:**
- Moving $500 from your checking account to your savings account
- Paying down your credit card from your checking account
- Funding an investment account from checking

**Not transfers (these are expenses):**
- Sending money to your wife via Zelle — that money leaves your account and goes to an external account not in this app
- Paying a bill, vendor, or person
- Any transaction where only one side exists in your database

---

## The Core Requirement

**Transfer linking requires at least two accounts in the app.**

If you only have one account tracked, the feature has nothing to link. To use transfers, add your other financial accounts (savings, credit card, investment, etc.) under `/accounts` and import or enter their transactions.

---

## How Transactions Become Transfers

Transfers are **never automatic**. The app detects candidates and presents them for your review. You always confirm or dismiss.

### Step 1 — The app detects candidates

When you open `/transactions`, the **Transfer Suggestions Panel** appears at the top of the list if the engine finds likely pairs. It looks back 90 days.

Detection confidence levels:

| Confidence | Criteria |
|---|---|
| **High** | Same calendar day + equal/opposite amounts + different accounts |
| **High** | Either transaction is already categorized as "Transfers" + within 5 days |
| **High** | Same day + equal/opposite amounts + transfer keyword in description (TRANSFER, ZELLE, ACH, PAYMENT, DEPOSIT, SAVINGS) |
| **Likely** | Within 5 days + exact equal/opposite amounts + different accounts |

### Step 2 — Review the suggestions

Each candidate shows:
- Left side: the outgoing transaction (account, description, date, amount)
- Right side: the incoming transaction (account, description, date, amount)
- Confidence badge (High or Likely)
- Reason string explaining why it was flagged

### Step 3 — Confirm or dismiss

- **Confirm** — links the pair as a transfer. Both transactions are updated: `isTransfer = true`, category set to "Transfers". They are immediately excluded from all spending reports, budgets, and AI insights.
- **Not a Transfer** — dismisses this pair from the panel for this session. No changes are made to either transaction. The pair may reappear next session if still unlinked.

---

## Manually Linking a Transfer

If the suggestions panel doesn't catch a pair, you can link manually from the edit modal:

1. Open the edit modal on one of the two transactions (click the pencil icon)
2. Click **"Link as Transfer"** at the bottom-left of the form
3. A picker appears showing all compatible transactions — same absolute amount, opposite sign, different account, within ±5 days
4. Select the matching transaction
5. Both are linked atomically

**If the picker shows "No compatible transactions found":**
- The other transaction may not exist in the app yet (common if you only have one account)
- The dates may be more than 5 days apart
- The amounts may not be exactly equal and opposite

---

## What Happens After Linking

Once two transactions are linked as a transfer:

- Both rows show a `↔` icon instead of a category dot
- The category label shows "Transfer" in muted gray
- Both are excluded from spending reports, category breakdowns, budget calculations, and AI insights
- The **Hide Transfers** button in the toolbar will remove them from view when toggled on
- Hovering either row shows an **Unlink** button

---

## Unlinking a Transfer

To unlink a confirmed transfer pair:

1. Find either transaction in the list (use the **Hide Transfers** toggle OFF so transfer rows are visible)
2. Hover the row and click **Unlink**
3. Both transactions are restored: `isTransfer = false`, category reset to "Uncategorized"
4. They will reappear as candidates in the suggestions panel next time

---

## The "Hide Transfers" Toggle

The **Hide Transfers** button in the transactions toolbar controls whether confirmed transfer rows are visible in the list.

- **Off (default):** All transactions shown, including confirmed transfers (de-emphasized/muted)
- **On (teal):** Confirmed transfers hidden from the list

This has no effect until you have confirmed at least one transfer.

---

## Setting Up for Transfers

If you want to track transfers accurately:

1. Go to `/accounts` and add all accounts you own — checking, savings, credit cards, investment accounts
2. Import or manually enter transactions for those accounts
3. Return to `/transactions` — the suggestions panel will appear if it detects matching pairs

The more accounts you have in the app, the more useful this feature becomes. With a single account, it cannot function.

---

## Auditing Historical Data

If you have existing transactions already categorized as "Transfers" that were entered before this feature existed, run this audit script from inside the project directory:

```bash
docker compose exec app npx tsx prisma/seedTransfers.ts
```

This scans all unlinked transactions in the "Transfers" category, runs the detection engine against them, and prints what it finds. It does **not** auto-link anything — it reports only. Use the output to guide manual linking or to let the suggestions panel handle them.
