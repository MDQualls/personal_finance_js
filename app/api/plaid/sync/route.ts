import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import type { RemovedTransaction, Transaction as PlaidTransaction } from 'plaid'
import { authOptions } from '@/lib/auth'
import { plaidClient } from '@/lib/plaid'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { decryptToken } from '@/lib/crypto'
import { toCents } from '@/lib/money'
import { normalizeDescription, sanitizeString } from '@/lib/normalize'
import { PLAID_CATEGORY_MAP } from '@/lib/plaidCategories'

const SyncSchema = z.object({
  plaidItemId: z.string().cuid(),
})

// Plaid errors arrive as an Axios error with `response.data.error_code` — narrow structurally
// rather than depending on axios's types, since axios is only a transitive dependency here.
function getPlaidErrorCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null || !('response' in err)) return undefined
  const response = (err as { response?: unknown }).response
  if (typeof response !== 'object' || response === null || !('data' in response)) return undefined
  const data = (response as { data?: unknown }).data
  if (typeof data !== 'object' || data === null || !('error_code' in data)) return undefined
  const code = (data as { error_code?: unknown }).error_code
  return typeof code === 'string' ? code : undefined
}

function toLocalAmountCents(plaidAmount: number): number {
  // Plaid: positive = money leaving the account (expense), negative = money entering (income) —
  // the inverse of our convention (negative = expense, positive = income).
  const cents = toCents(Math.abs(plaidAmount))
  return plaidAmount > 0 ? -cents : cents
}

async function resolveCategoryId(primary: string | undefined): Promise<string> {
  const mappedName = primary ? PLAID_CATEGORY_MAP[primary] : undefined
  if (mappedName) {
    const match = await prisma.category.findFirst({ where: { name: mappedName, isActive: true } })
    if (match) return match.id
  }

  const fallback = await prisma.category.findFirst({ where: { name: 'Uncategorized', isSystem: true } })
  if (!fallback) throw new Error('Uncategorized system category not found')
  return fallback.id
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body: unknown = await req.json()
  const result = SyncSchema.safeParse(body)
  if (!result.success) return apiError(result.error.format(), 400)

  const { plaidItemId } = result.data

  try {
    const item = await prisma.plaidItem.findUnique({
      where: { id: plaidItemId },
      include: { accounts: true },
    })
    if (!item) return apiError('Plaid item not found', 404)
    if (!item.accessToken) return apiError('This connection has been disconnected', 410)

    const accessToken = decryptToken(item.accessToken)
    const merchantRules = await prisma.merchantRule.findMany()

    let cursor = item.lastCursor ?? undefined
    let added: PlaidTransaction[] = []
    let modified: PlaidTransaction[] = []
    let removed: RemovedTransaction[] = []
    let hasMore = true

    // Paginate through all changes since the last cursor
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

    // plaidAccountId → our accountId, only for accounts that have been linked (Phase 7 mapping UI)
    const accountMap = new Map(
      item.accounts.filter((a) => a.accountId).map((a) => [a.plaidAccountId, a.accountId as string])
    )

    for (const tx of [...added, ...modified]) {
      const accountId = accountMap.get(tx.account_id)
      if (!accountId) continue // not yet mapped to a local Account — skip until linked

      const description = normalizeDescription(sanitizeString(tx.merchant_name ?? tx.name), merchantRules)
      const categoryId = await resolveCategoryId(tx.personal_finance_category?.primary)

      await prisma.transaction.upsert({
        where: { plaidTransactionId: tx.transaction_id },
        create: {
          accountId,
          plaidTransactionId: tx.transaction_id,
          amount: toLocalAmountCents(tx.amount),
          date: new Date(tx.date),
          categoryId,
          description,
          notes: null,
          needsReview: true,
        },
        update: {
          amount: toLocalAmountCents(tx.amount),
          date: new Date(tx.date),
          description,
        },
      })
    }

    if (removed.length > 0) {
      await prisma.transaction.updateMany({
        where: { plaidTransactionId: { in: removed.map((tx) => tx.transaction_id) } },
        data: { deletedAt: new Date() },
      })
    }

    await prisma.plaidItem.update({
      where: { id: plaidItemId },
      data: { lastCursor: cursor, lastSyncedAt: new Date() },
    })

    // Plaid's balance is authoritative for Plaid-managed accounts — pull it directly rather than
    // computing from transaction deltas, which drifts from pending transactions, fees, and interest.
    for (const plaidAccount of item.accounts) {
      if (!plaidAccount.accountId) continue

      const balanceResponse = await plaidClient.accountsBalanceGet({
        access_token: accessToken,
        options: { account_ids: [plaidAccount.plaidAccountId] },
      })

      const balance = balanceResponse.data.accounts[0]?.balances.current
      if (balance !== undefined && balance !== null) {
        await prisma.account.update({
          where: { id: plaidAccount.accountId },
          data: { balance: toCents(balance) },
        })
      }
    }

    return apiSuccess({ added: added.length, modified: modified.length, removed: removed.length })
  } catch (err) {
    console.error('[plaid:sync]', err)

    if (getPlaidErrorCode(err) === 'ITEM_LOGIN_REQUIRED') {
      await prisma.plaidItem.update({ where: { id: plaidItemId }, data: { status: 'ERROR' } })
      return apiError('This connection needs to be reconnected', 409)
    }

    return apiError('Sync failed', 500)
  }
}
