import type { MonthlyTrend, TrendSummary, SavingsRatePoint } from '@/types'

// Pure client-safe helper (no prisma import) — derives Monthly Spending Summary stats
// from an already-fetched MonthlyTrend[] array. Assumes trends are ordered oldest to
// newest, matching getMonthlyTrends()'s output; the last entry is treated as "this month."
export function summarizeTrends(trends: MonthlyTrend[]): TrendSummary | null {
  if (trends.length === 0) return null

  const avgExpenses = Math.round(trends.reduce((sum, t) => sum + t.expenses, 0) / trends.length)
  const avgIncome = Math.round(trends.reduce((sum, t) => sum + t.income, 0) / trends.length)
  const avgSavingsRate =
    (trends.reduce((sum, t) => sum + (t.income > 0 ? t.net / t.income : 0), 0) / trends.length) * 100

  const thisMonth = trends[trends.length - 1]
  const bestMonth = trends.reduce((min, t) => (t.expenses < min.expenses ? t : min))
  const worstMonth = trends.reduce((max, t) => (t.expenses > max.expenses ? t : max))

  return {
    avgExpenses,
    avgIncome,
    avgSavingsRate,
    thisMonthExpenses: thisMonth.expenses,
    vsAverageDelta: thisMonth.expenses - avgExpenses,
    bestMonth: { month: bestMonth.month, expenses: bestMonth.expenses },
    worstMonth: { month: worstMonth.month, expenses: worstMonth.expenses },
  }
}

// Pure client-safe helper — derives the Savings Rate Trend chart's series from an
// already-fetched MonthlyTrend[] array. `monthlyGoal` (cents) is the sum of active
// SAVINGS_GOAL budgets' monthly-equivalent amounts; expressed here as the rate that
// goal represents against each month's actual income, since income varies month to month.
export function computeSavingsRateSeries(trends: MonthlyTrend[], monthlyGoal = 0): SavingsRatePoint[] {
  return trends.map((t) => ({
    month: t.month,
    savingsRate: t.income > 0 ? (t.net / t.income) * 100 : 0,
    goalRate: monthlyGoal > 0 && t.income > 0 ? (monthlyGoal / t.income) * 100 : null,
  }))
}
