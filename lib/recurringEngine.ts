import { prisma } from './prisma'
import { addFrequency } from './dates'

export async function postDueRecurringRules(): Promise<{
  posted: number
  skipped: number
  errors: string[]
}> {
  const now = new Date()
  now.setHours(23, 59, 59, 999) // include anything due today

  const dueRules = await prisma.recurringRule.findMany({
    where: {
      isActive: true,
      autoPost: true,
      nextDate: { lte: now },
      account: { plaidManaged: false }, // never auto-post to Plaid-managed accounts — Plaid is the sole source of truth
    },
  })

  let posted = 0
  let skipped = 0
  const errors: string[] = []

  for (const rule of dueRules) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.transaction.create({
          data: {
            accountId: rule.accountId,
            categoryId: rule.categoryId,
            amount: rule.amount,
            date: rule.nextDate,
            description: rule.name,
            notes: rule.notes ?? null,
          },
        })

        await tx.account.update({
          where: { id: rule.accountId },
          data: { balance: { increment: rule.amount } },
        })

        await tx.recurringRule.update({
          where: { id: rule.id },
          data: {
            nextDate: addFrequency(rule.nextDate, rule.frequency),
            lastPostedAt: new Date(),
          },
        })
      })

      posted++
    } catch (err) {
      console.error(`[recurringEngine] Failed to post rule ${rule.id}:`, err)
      errors.push(
        `Rule "${rule.name}" (${rule.id}): ${err instanceof Error ? err.message : 'Unknown error'}`
      )
      skipped++
    }
  }

  return { posted, skipped, errors }
}
