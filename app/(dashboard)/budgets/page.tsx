import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfPeriod, endOfPeriod } from '@/lib/dates'
import { BudgetsClient } from './BudgetsClient'
import type { BudgetPeriod } from '@prisma/client'

export default async function BudgetsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  const now = new Date()

  const [budgets, categories] = await Promise.all([
    prisma.budget.findMany({ include: { category: true }, orderBy: { category: { name: 'asc' } } }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
  ])

  const enriched = await Promise.all(
    budgets.map(async (budget) => {
      const start = startOfPeriod(now, budget.period as BudgetPeriod)
      const end = endOfPeriod(now, budget.period as BudgetPeriod)

      const result = await prisma.transaction.aggregate({
        where: {
          categoryId: budget.categoryId,
          deletedAt: null,
          date: { gte: start, lte: end },
          amount: { lt: 0 },
        },
        _sum: { amount: true },
      })

      return { ...budget, spent: Math.abs(result._sum.amount ?? 0) }
    })
  )

  return <BudgetsClient budgets={enriched} categories={categories} />
}
