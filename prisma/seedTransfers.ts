/**
 * One-time audit script: finds existing unlinked transactions categorized as
 * "Transfers" and reports what the detection engine would match.
 *
 * Run with: npx tsx prisma/seedTransfers.ts
 * Does NOT auto-link — prints candidates only.
 */

import { PrismaClient } from '@prisma/client'
import { detectTransferCandidates } from '../lib/transferDetection'
import type { Transaction } from '../types'

const prisma = new PrismaClient()

async function main() {
  const SYSTEM_TRANSFERS_CATEGORY_ID = 'system_transfers'

  const rawTransactions = await prisma.transaction.findMany({
    where: {
      deletedAt: null,
      isTransfer: false,
      OR: [
        { categoryId: SYSTEM_TRANSFERS_CATEGORY_ID },
      ],
    },
    include: { category: true, account: true, tags: true },
  })

  console.log(`\nFound ${rawTransactions.length} unlinked transaction(s) in the Transfers category.\n`)

  if (rawTransactions.length === 0) {
    console.log('Nothing to audit. Exiting.')
    return
  }

  // Cast to app Transaction type for the detection engine
  const transactions = rawTransactions as unknown as Transaction[]
  const candidates = detectTransferCandidates(transactions)

  if (candidates.length === 0) {
    console.log('No transfer pairs detected among these transactions.')
    console.log('They may not have matching equal/opposite amounts on different accounts within 5 days.')
    return
  }

  console.log(`Detected ${candidates.length} candidate pair(s):\n`)

  for (const c of candidates) {
    const from = c.fromTransaction
    const to = c.toTransaction
    console.log(`  [${c.confidence.toUpperCase()}] ${c.reason}`)
    console.log(`    FROM: ${from.account?.name ?? from.accountId} | ${from.description} | ${new Date(from.date).toISOString().slice(0, 10)} | ${(from.amount / 100).toFixed(2)}`)
    console.log(`    TO:   ${to.account?.name ?? to.accountId} | ${to.description} | ${new Date(to.date).toISOString().slice(0, 10)} | ${(to.amount / 100).toFixed(2)}`)
    console.log()
  }

  console.log('To link these, use the Transfer Suggestions panel at /transactions or the "Link as Transfer" button in each transaction\'s edit modal.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
