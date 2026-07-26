import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfPeriod, endOfPeriod } from '@/lib/dates'
import { getBudgetSpent } from '@/lib/reports'
import { BudgetsClient } from './BudgetsClient'
import type { BudgetPeriod } from '@prisma/client'

export default async function BudgetsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  const now = new Date()

  const [budgets, categories] = await Promise.all([
    prisma.budget.findMany({
      include: { category: true },
      orderBy: [{ isActive: 'desc' }, { category: { name: 'asc' } }],
    }),
    prisma.category.findMany({
      where: { isActive: true, parentId: null },
      include: { children: { where: { isActive: true }, orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    }),
  ])

  const enriched = await Promise.all(
    budgets.map(async (budget) => {
      const start = startOfPeriod(now, budget.period as BudgetPeriod)
      const end = endOfPeriod(now, budget.period as BudgetPeriod)
      const spent = await getBudgetSpent(budget.categoryId, start, end)

      return { ...budget, spent }
    })
  )

  return <BudgetsClient budgets={enriched} categories={categories} />
}
