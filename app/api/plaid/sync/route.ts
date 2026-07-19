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

const SyncSchema = z.object({
  plaidItemId: z.string().cuid(),
})

function toLocalAmountCents(plaidAmount: number): number {
  // Plaid: positive = money leaving the account (expense), negative = money entering (income) —
  // the inverse of our convention (negative = expense, positive = income).
  const cents = toCents(Math.abs(plaidAmount))
  return plaidAmount > 0 ? -cents : cents
}

// Naive contains-match placeholder — Phase 6 replaces this with lib/plaidCategories.ts's PLAID_CATEGORY_MAP.
async function resolveCategoryId(primary: string | undefined): Promise<string> {
  const searchTerm = (primary ?? 'GENERAL_MERCHANDISE').replace(/_/g, ' ')
  const match = await prisma.category.findFirst({
    where: { isActive: true, name: { contains: searchTerm, mode: 'insensitive' } },
  })
  if (match) return match.id

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

    return apiSuccess({ added: added.length, modified: modified.length, removed: removed.length })
  } catch (err) {
    console.error('[plaid:sync]', err)
    return apiError('Sync failed', 500)
  }
}
