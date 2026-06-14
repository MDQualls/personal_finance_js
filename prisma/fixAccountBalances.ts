import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// One-time correction for account balances left stale by recurring transactions
// posted before the recurringEngine balance-update fix (the engine created
// Transaction rows but never updated Account.balance).
//
// Account.balance includes an opening-balance baseline set at account creation
// that has no corresponding Transaction row, so "balance = sum of transactions"
// is NOT a valid correction. Instead, for each RecurringRule we find the
// transactions it posted (matching account/category/description/amount,
// created on or after the date the recurring engine shipped) and apply the
// missing balance delta directly.
const RECURRING_ENGINE_LIVE_DATE = new Date('2026-05-08T00:00:00.000Z')

async function main() {
  const rules = await prisma.recurringRule.findMany()
  const deltaByAccount = new Map<string, number>()

  for (const rule of rules) {
    const postedTxs = await prisma.transaction.findMany({
      where: {
        accountId: rule.accountId,
        categoryId: rule.categoryId,
        description: rule.name,
        amount: rule.amount,
        deletedAt: null,
        createdAt: { gte: RECURRING_ENGINE_LIVE_DATE },
      },
    })

    for (const tx of postedTxs) {
      console.log(`  ${rule.name}: ${tx.id} (${tx.createdAt.toISOString()}) amount ${tx.amount}`)
      deltaByAccount.set(rule.accountId, (deltaByAccount.get(rule.accountId) ?? 0) + tx.amount)
    }
  }

  for (const [accountId, delta] of deltaByAccount) {
    const account = await prisma.account.findUniqueOrThrow({ where: { id: accountId } })
    const newBalance = account.balance + delta
    console.log(`${account.name}: ${account.balance} -> ${newBalance} (delta ${delta})`)
    await prisma.account.update({ where: { id: accountId }, data: { balance: newBalance } })
  }

  if (deltaByAccount.size === 0) {
    console.log('No drift found — all account balances already correct.')
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
