import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getSpendingByCategory,
  getMonthlyTrends,
  getNetWorthHistory,
  getBudgetActual,
  getCostFloor,
  getExpenseSplit,
  getSpendingComparison,
  getSavingsSummary,
} from '@/lib/reports'
import { monthlyEquivalent } from '@/lib/money'
import { ReportsClient } from './ReportsClient'

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  const from = searchParams.from ?? defaultFrom
  const to = searchParams.to ?? defaultTo

  const fromDate = new Date(`${from}T00:00:00Z`)
  const toDate = new Date(`${to}T23:59:59Z`)

  const [spending, trends, netWorth, budgetActual, costFloor, expenseSplit, comparison, savings, goalBudgets] =
    await Promise.all([
      getSpendingByCategory(fromDate, toDate),
      getMonthlyTrends(6),
      getNetWorthHistory(12),
      getBudgetActual(fromDate, toDate),
      getCostFloor(),
      getExpenseSplit(fromDate, toDate),
      getSpendingComparison(fromDate),
      getSavingsSummary(fromDate),
      prisma.budget.findMany({
        where: { isActive: true, budgetType: 'SAVINGS_GOAL' },
        select: { amount: true, period: true },
      }),
    ])

  const savingsGoalMonthly = goalBudgets.reduce(
    (sum, budget) => sum + monthlyEquivalent(budget.amount, budget.period),
    0
  )

  return (
    <ReportsClient
      from={from}
      to={to}
      spending={spending}
      trends={trends}
      netWorth={netWorth}
      budgetActual={budgetActual}
      costFloor={costFloor}
      expenseSplit={expenseSplit}
      comparison={comparison}
      savings={savings}
      savingsGoalMonthly={savingsGoalMonthly}
    />
  )
}
