# Plaid Integration Spec — Personal Finance Tracker

This document covers everything needed to add Plaid bank account connectivity to the finance tracker. Plaid acts as the secure middleman between the app and the user's financial institutions. The app never handles raw bank credentials.

---

## How It Works (Overview)

```
User clicks "Connect Account"
  → App calls /api/plaid/link-token    (creates a Plaid Link session)
  → Plaid Link widget opens in browser (Plaid's hosted UI — app never sees credentials)
  → User selects bank, authenticates with Plaid
  → Plaid returns a public_token to the app
  → App calls /api/plaid/exchange-token (exchanges public_token for access_token)
  → App stores access_token in database
  → App calls /api/plaid/sync           (pulls transactions + balances using access_token)
  → Transactions upserted into Transaction table
```

---

## Prerequisites

### Plaid Developer Account

1. Sign up at https://dashboard.plaid.com/signup — free
2. Create an application in the Plaid dashboard
3. Start in **Sandbox** environment (fake data, instant approval)
4. Request **Development** environment access (real banks, up to 100 items free)
5. Production requires Plaid approval and has per-item monthly fees — not needed for personal use

### Environment Tiers

| Tier | Banks | Cost | Use Case |
|---|---|---|---|
| Sandbox | Fake test credentials only | Free | Development and testing |
| Development | Real institutions, up to 100 items | Free | Personal use — this is your target |
| Production | Real institutions, unlimited | Per-item fee | Commercial apps |

---

## Environment Variables

Add to `.env.local`:

```env
PLAID_CLIENT_ID=your_client_id_from_plaid_dashboard
PLAID_SECRET=your_development_secret_from_plaid_dashboard
PLAID_ENV=development
```

For sandbox testing, swap `PLAID_ENV=sandbox` and use the sandbox secret. Never use production credentials locally.

---

## Dependencies

```bash
npm install plaid
```

No other dependencies required. The Plaid Link widget is loaded via a `<script>` tag, not an npm package.

---

## Database Schema Changes

Add two new Prisma models. Run `npx prisma migrate dev` after adding them.

```prisma
// prisma/schema.prisma — add these models

model PlaidItem {
  id                String    @id @default(cuid())
  accessToken       String    @unique  // encrypted at rest — see Security section
  itemId            String    @unique  // Plaid's identifier for the institution connection
  institutionId     String
  institutionName   String
  lastSyncedAt      DateTime?
  lastCursor        String?   // Plaid transactions cursor for incremental sync
  status            PlaidItemStatus @default(ACTIVE)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  accounts          PlaidAccount[]
}

model PlaidAccount {
  id            String      @id @default(cuid())
  plaidItemId   String
  plaidItem     PlaidItem   @relation(fields: [plaidItemId], references: [id])
  plaidAccountId String     @unique  // Plaid's account ID
  accountId     String?     @unique  // Link to our Account model once matched/created
  account       Account?    @relation(fields: [accountId], references: [id])
  name          String
  mask          String?     // Last 4 digits
  officialName  String?
  type          String      // depository, credit, loan, investment
  subtype       String?     // checking, savings, credit card, etc.
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
}

enum PlaidItemStatus {
  ACTIVE
  ERROR        // Item needs re-authentication
  DISCONNECTED
}
```

Also add to the existing `Account` model:
```prisma
plaidManaged  Boolean       @default(false)  // true = Plaid owns transaction posting for this account
plaidAccount  PlaidAccount?                  // reverse relation
```

And add to the existing `Transaction` model:
```prisma
plaidTransactionId  String?  @unique  // Plaid's transaction ID — used for dedup
```

> **Critical:** The `plaidManaged` flag is the reconciliation guard. When `true`, the recurring engine will never auto-post transactions to this account. Plaid is the sole source of transaction truth for any account where this flag is set. See the Reconciliation section below.

---

## Plaid Client Setup

```typescript
// lib/plaid.ts
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid'

const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
})

export const plaidClient = new PlaidApi(configuration)
```

This singleton is server-only. Never import it in a client component.

---

## API Routes

### POST /api/plaid/link-token

Creates a Plaid Link session. Called when the user clicks "Connect Account."

```typescript
// app/api/plaid/link-token/route.ts
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { plaidClient } from '@/lib/plaid'
import { apiSuccess, apiError } from '@/lib/api'
import { CountryCode, Products } from 'plaid'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: 'single-user' },
      client_name: 'Personal Finance Tracker',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    })

    return apiSuccess({ linkToken: response.data.link_token })
  } catch (err) {
    console.error('[plaid:link-token]', err)
    return apiError('Failed to create link token', 500)
  }
}
```

### POST /api/plaid/exchange-token

Exchanges the temporary `public_token` (returned by Plaid Link after the user connects) for a permanent `access_token`. Called once per institution connection.

```typescript
// app/api/plaid/exchange-token/route.ts
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { plaidClient } from '@/lib/plaid'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { z } from 'zod'
import { encryptToken } from '@/lib/crypto'

const Schema = z.object({
  publicToken: z.string().min(1),
  institutionId: z.string().min(1),
  institutionName: z.string().min(1).max(255),
  accounts: z.array(z.object({
    id: z.string(),
    name: z.string(),
    mask: z.string().nullable(),
    type: z.string(),
    subtype: z.string().nullable(),
  })),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body = Schema.safeParse(await req.json())
  if (!body.success) return apiError(body.error.format(), 400)

  const { publicToken, institutionId, institutionName, accounts } = body.data

  try {
    const exchange = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    })

    const { access_token, item_id } = exchange.data

    // Encrypt before storing — see Security section
    const encryptedToken = encryptToken(access_token)

    const plaidItem = await prisma.plaidItem.create({
      data: {
        accessToken: encryptedToken,
        itemId: item_id,
        institutionId,
        institutionName,
        accounts: {
          create: accounts.map(a => ({
            plaidAccountId: a.id,
            name: a.name,
            mask: a.mask,
            type: a.type,
            subtype: a.subtype,
          })),
        },
      },
      include: { accounts: true },
    })

    return apiSuccess({ plaidItemId: plaidItem.id })
  } catch (err) {
    console.error('[plaid:exchange-token]', err)
    return apiError('Failed to connect account', 500)
  }
}
```

### POST /api/plaid/sync

Pulls transactions and balances from Plaid and upserts them into the local database. Uses Plaid's cursor-based sync API for incremental updates — only fetches new/modified/removed transactions since the last sync.

```typescript
// app/api/plaid/sync/route.ts
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { plaidClient } from '@/lib/plaid'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { decryptToken } from '@/lib/crypto'
import { toCents } from '@/lib/money'
import { z } from 'zod'

const Schema = z.object({
  plaidItemId: z.string().cuid(),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body = Schema.safeParse(await req.json())
  if (!body.success) return apiError(body.error.format(), 400)

  const { plaidItemId } = body.data

  try {
    const item = await prisma.plaidItem.findUnique({
      where: { id: plaidItemId },
      include: { accounts: true },
    })

    if (!item) return apiError('Plaid item not found', 404)

    const accessToken = decryptToken(item.accessToken)
    let cursor = item.lastCursor ?? undefined
    let added: any[] = []
    let modified: any[] = []
    let removed: any[] = []
    let hasMore = true

    // Paginate through all changes since last cursor
    while (hasMore) {
      const response = await plaidClient.transactionsSync({
        access_token: accessToken,
        cursor,
      })

      added = added.concat(response.data.added)
      modified = modified.concat(response.data.modified)
      removed = removed.concat(response.data.removed)
      hasMore = response.data.has_more
      cursor = response.data.next_cursor
    }

    // Build account ID lookup: plaidAccountId → our accountId
    const accountMap = new Map(
      item.accounts
        .filter(a => a.accountId)
        .map(a => [a.plaidAccountId, a.accountId!])
    )

    // Upsert added + modified transactions
    const toUpsert = [...added, ...modified]
    for (const tx of toUpsert) {
      const accountId = accountMap.get(tx.account_id)
      if (!accountId) continue  // account not yet linked — skip

      await prisma.transaction.upsert({
        where: { plaidTransactionId: tx.transaction_id },
        create: {
          accountId,
          plaidTransactionId: tx.transaction_id,
          amount: toCents(Math.abs(tx.amount)),
          // Plaid: positive amount = money leaving the account (expense)
          // Our convention: negative = expense, positive = income
          // Plaid amounts are negated for credits, so we invert
          date: new Date(tx.date),
          description: tx.merchant_name ?? tx.name,
          notes: null,
          categoryId: await resolveCategory(tx.personal_finance_category?.primary),
        },
        update: {
          amount: toCents(Math.abs(tx.amount)),
          date: new Date(tx.date),
          description: tx.merchant_name ?? tx.name,
        },
      })
    }

    // Soft-delete removed transactions
    for (const tx of removed) {
      await prisma.transaction.updateMany({
        where: { plaidTransactionId: tx.transaction_id },
        data: { deletedAt: new Date() },
      })
    }

    // Update cursor and lastSyncedAt
    await prisma.plaidItem.update({
      where: { id: plaidItemId },
      data: { lastCursor: cursor, lastSyncedAt: new Date() },
    })

    return apiSuccess({
      added: added.length,
      modified: modified.length,
      removed: removed.length,
    })
  } catch (err) {
    console.error('[plaid:sync]', err)
    return apiError('Sync failed', 500)
  }
}

// Map Plaid's category to our local category — expand this as needed
async function resolveCategory(plaidCategory?: string): Promise<string> {
  const name = plaidCategory ?? 'GENERAL_MERCHANDISE'
  const category = await prisma.category.findFirst({
    where: { name: { contains: name, mode: 'insensitive' } },
  })
  // Fall back to an "Uncategorized" system category
  return category?.id ?? (await prisma.category.findFirst({ where: { name: 'Uncategorized' } }))!.id
}
```

### GET /api/plaid/items

Returns all connected Plaid items (institutions) with their linked accounts.

```typescript
// app/api/plaid/items/route.ts
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const items = await prisma.plaidItem.findMany({
    where: { status: 'ACTIVE' },
    include: { accounts: { include: { account: true } } },
    orderBy: { createdAt: 'desc' },
  })

  // Never return the accessToken to the client
  return apiSuccess(items.map(({ accessToken: _, ...item }) => item))
}
```

### DELETE /api/plaid/items/[id]

Disconnects an institution. Calls Plaid's item remove endpoint and marks the item as disconnected locally.

```typescript
// app/api/plaid/items/[id]/route.ts
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const item = await prisma.plaidItem.findUnique({ where: { id: params.id } })
  if (!item) return apiError('Not found', 404)

  const accessToken = decryptToken(item.accessToken)
  await plaidClient.itemRemove({ access_token: accessToken })

  await prisma.plaidItem.update({
    where: { id: params.id },
    data: { status: 'DISCONNECTED' },
  })

  return apiSuccess({ disconnected: true })
}
```

---

## Frontend — Plaid Link Widget

The Plaid Link UI is a prebuilt widget loaded via script tag. Add this to the accounts settings page.

```typescript
// components/plaid/ConnectAccountButton.tsx
'use client'

import { useState, useCallback } from 'react'
import { usePlaidLink } from 'react-plaid-link'

// Install: npm install react-plaid-link
export function ConnectAccountButton({ onSuccess }: { onSuccess: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const openLink = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/plaid/link-token', { method: 'POST' })
    const { data } = await res.json()
    setLinkToken(data.linkToken)
    setLoading(false)
  }, [])

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (publicToken, metadata) => {
      await fetch('/api/plaid/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicToken,
          institutionId: metadata.institution?.institution_id,
          institutionName: metadata.institution?.name,
          accounts: metadata.accounts,
        }),
      })
      onSuccess()
    },
  })

  return (
    <button
      onClick={linkToken ? () => open() : openLink}
      disabled={loading || (!!linkToken && !ready)}
      className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium"
    >
      {loading ? 'Preparing...' : 'Connect Bank Account'}
    </button>
  )
}
```

Install the React helper:

```bash
npm install react-plaid-link
```

---

## Reconciliation — Preventing Double-Entry

This is the most important operational concern when mixing Plaid with recurring rules. Without a guard, a recurring rule set to `autoPost = true` and a Plaid sync will both create a transaction for the same real charge — different descriptions, same date and amount — and your balance, spending reports, and net worth will be wrong.

### The Guard: `plaidManaged`

When an `Account` has `plaidManaged = true`, Plaid is the sole source of transaction truth for that account. The recurring engine must never auto-post to it.

This is enforced in `lib/recurringEngine.ts` (see RECURRING.md) via a filter on the database query:

```typescript
const dueRules = await prisma.recurringRule.findMany({
  where: {
    isActive: true,
    autoPost: true,
    nextDate: { lte: now },
    account: { plaidManaged: false },   // never post to Plaid-managed accounts
  },
  include: { account: true },
})
```

This is not optional. This filter must be present every time the engine runs.

### Setting `plaidManaged` on Account Creation via Plaid

When the exchange-token route creates or links a local `Account` from a Plaid account, set `plaidManaged = true` automatically:

```typescript
// In exchange-token route, when creating a new Account from a PlaidAccount
await prisma.account.create({
  data: {
    name: plaidAccount.name,
    type: mapPlaidAccountType(plaidAccount.type, plaidAccount.subtype),
    balance: 0,           // will be updated on first sync
    plaidManaged: true,   // Plaid owns this account's transactions
  },
})
```

### What This Means in Practice

| Account type | `plaidManaged` | Who posts transactions |
|---|---|---|
| Checking (connected to Plaid) | `true` | Plaid sync only |
| Savings (connected to Plaid) | `true` | Plaid sync only |
| Credit card (connected to Plaid) | `true` | Plaid sync only |
| Cash / wallet (manual) | `false` | Recurring engine + manual entry |
| Credit union Plaid can't reach | `false` | CSV import + manual entry |
| Loan (manual tracking only) | `false` | Recurring engine |

### Recurring Rules on Plaid-Managed Accounts

Recurring rules linked to a Plaid-managed account should have `autoPost = false`. They still contribute to cash flow projections — which is valuable — but they will never create duplicate transactions. The UI should warn the user when they attempt to create a recurring rule with `autoPost = true` on a Plaid-managed account:

```
⚠ This account is managed by Plaid. Auto-post has been disabled to prevent
duplicate transactions. This rule will still appear in cash flow projections.
```

Enforce this in the API route:

```typescript
// In POST /api/recurring — after validating the schema
const account = await prisma.account.findUnique({ where: { id: body.data.accountId } })
if (account?.plaidManaged && body.data.autoPost) {
  return apiError(
    'Auto-post is not allowed on Plaid-managed accounts. Set autoPost to false.',
    422
  )
}
```

### Balance Sync

Plaid also returns current balances on each sync. Update the linked `Account.balance` from Plaid's balance data at the end of each sync run:

```typescript
// At the end of POST /api/plaid/sync, after processing transactions
for (const plaidAcct of item.accounts) {
  if (!plaidAcct.accountId) continue

  const balanceResponse = await plaidClient.accountsBalanceGet({
    access_token: accessToken,
    options: { account_ids: [plaidAcct.plaidAccountId] },
  })

  const balance = balanceResponse.data.accounts[0]?.balances.current
  if (balance !== undefined && balance !== null) {
    await prisma.account.update({
      where: { id: plaidAcct.accountId },
      data: { balance: toCents(balance) },
    })
  }
}
```

This keeps your account balances authoritative from the bank rather than computed from transaction history, which avoids drift from pending transactions, fees, and interest.

---

## Security

### Access Token Encryption

Plaid `access_token` values grant full read access to a user's bank accounts. They must be encrypted at rest in the database — storing them as plaintext is not acceptable even for a personal app.

Add an encryption key to `.env.local`:

```env
ENCRYPTION_KEY=<output of: openssl rand -base64 32>
```

Implement AES-256-GCM encryption:

```typescript
// lib/crypto.ts
import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'base64')

export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Store as iv:tag:encrypted — all base64
  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':')
}

export function decryptToken(stored: string): string {
  const [ivB64, tagB64, encryptedB64] = stored.split(':')
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const encrypted = Buffer.from(encryptedB64, 'base64')
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final('utf8')
}
```

### Additional Security Rules

- The `accessToken` field is never returned in any API response — strip it before sending (see `GET /api/plaid/items`)
- `PLAID_SECRET` and `ENCRYPTION_KEY` are server-only env vars — never prefix with `NEXT_PUBLIC_`
- All Plaid API calls are server-side only — the client never calls Plaid directly
- If a sync fails with a `ITEM_LOGIN_REQUIRED` error, set the `PlaidItem.status` to `ERROR` and surface a re-authentication prompt to the user

---

## Transaction Amount Convention

Plaid's sign convention differs from ours. Reconcile on import:

| Plaid amount | Meaning | Our convention |
|---|---|---|
| Positive (e.g. 45.00) | Money leaving account (expense/debit) | Negative cents (-4500) |
| Negative (e.g. -1200.00) | Money entering account (income/credit) | Positive cents (120000) |

Apply this in the sync route:

```typescript
const isExpense = tx.amount > 0
const amountCents = isExpense
  ? -toCents(tx.amount)       // expense: negative
  : toCents(Math.abs(tx.amount)) // income: positive
```

---

## Category Mapping

Plaid returns a `personal_finance_category` object on each transaction with a `primary` and `detailed` value. Map these to your local categories in a lookup table rather than doing a fuzzy DB search on every transaction.

```typescript
// lib/plaidCategories.ts
// Expand this map as you observe real transaction categories from your banks
export const PLAID_CATEGORY_MAP: Record<string, string> = {
  'FOOD_AND_DRINK':         'Dining Out',
  'GROCERIES':              'Groceries',
  'TRANSPORTATION':         'Transportation',
  'RENT_AND_UTILITIES':     'Housing',
  'ENTERTAINMENT':          'Entertainment',
  'GENERAL_MERCHANDISE':    'Shopping',
  'MEDICAL':                'Healthcare',
  'PERSONAL_CARE':          'Personal Care',
  'TRAVEL':                 'Travel',
  'INCOME':                 'Income',
  'TRANSFER_IN':            'Transfer',
  'TRANSFER_OUT':           'Transfer',
  'LOAN_PAYMENTS':          'Loan Payment',
  'BANK_FEES':              'Bank Fees',
}
```

Auto-categorization rules (already in the app) will progressively override these defaults as you train them.

---

## Sync Strategy

For a personal app, manual sync triggered by a "Sync Now" button is sufficient. A background job is optional but adds complexity.

**Manual sync (recommended for v1):**
- "Sync" button on the Accounts page or connected institution card
- Calls `POST /api/plaid/sync` with the `plaidItemId`
- Shows a loading state and summary on completion (X added, Y modified, Z removed)

**Automatic sync (optional Phase 9):**
- Plaid webhooks notify your app of new transactions in real time
- Requires a publicly reachable URL — use `ngrok` in development or deploy to a VPS
- Webhook endpoint: `POST /api/plaid/webhook`
- Plaid sends `SYNC_UPDATES_AVAILABLE` event → trigger sync for that item

---

## UI Pages

| Route | Purpose |
|---|---|
| /settings/connections | List connected institutions, sync status, last synced time, disconnect button |
| /settings/connections/[id] | Linked accounts for an institution, map Plaid accounts to local accounts |

The "Connect Bank Account" button lives on `/settings/connections` and triggers the Plaid Link flow.

---

## Build Phase

Add as **Phase 8** after the core app is complete and stable:

| Step | Task |
|---|---|
| 9.1 | Add Prisma models + `plaidManaged` flag to Account, run migration |
| 9.2 | Implement `lib/plaid.ts` and `lib/crypto.ts` |
| 9.3 | Build API routes: link-token, exchange-token, sync, items |
| 9.4 | Add `plaidManaged` guard to recurring engine (see RECURRING.md) |
| 9.5 | Add `autoPost` validation in POST /api/recurring for Plaid-managed accounts |
| 9.6 | Build `ConnectAccountButton` component and connections settings page |
| 9.7 | Implement category mapping, amount sign convention, and balance sync |
| 9.8 | Test end-to-end in Sandbox environment with Plaid test credentials |
| 9.9 | Switch `PLAID_ENV` to `development`, connect a real institution |
| 9.10 | (Optional) Add webhook support for real-time sync |

---

## Testing the Plaid Integration

In Sandbox mode, Plaid provides test credentials:

```
Username: user_good
Password: pass_good
```

These simulate a connected institution with fake transactions. Use them to test the full flow without connecting a real bank. Plaid's sandbox also has credentials that simulate error states (expired token, MFA required, etc.) — test those too before switching to development mode.

---

*Plaid Integration Spec — v1.1 | Personal Finance Tracker*
