'use client'

import { useRouter } from 'next/navigation'
import { Card, CardHeader } from '@/components/ui/Card'
import { SpendingPieChart } from '@/components/charts/SpendingPieChart'
import { MonthlyTrendChart } from '@/components/charts/MonthlyTrendChart'
import { SavingsRateTrendChart } from '@/components/charts/SavingsRateTrendChart'
import { NetWorthChart } from '@/components/charts/NetWorthChart'
import { BudgetActualChart } from '@/components/charts/BudgetActualChart'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/money'
import { summarizeTrends, computeSavingsRateSeries } from '@/lib/trendSummary'
import Link from 'next/link'
import type {
  SpendingByCategory,
  MonthlyTrend,
  NetWorthSnapshot,
  BudgetActualRow,
  CostFloor,
  ExpenseSplit,
  CategoryComparison,
  SavingsSummary,
} from '@/types'

interface Props {
  from: string
  to: string
  spending: SpendingByCategory[]
  trends: MonthlyTrend[]
  netWorth: NetWorthSnapshot[]
  budgetActual: BudgetActualRow[]
  costFloor: CostFloor | null
  expenseSplit: ExpenseSplit | null
  comparison: CategoryComparison[]
  savings: SavingsSummary | null
  savingsGoalMonthly: number
}

export function ReportsClient({
  from,
  to,
  spending,
  trends,
  netWorth,
  budgetActual,
  costFloor,
  expenseSplit,
  comparison,
  savings,
  savingsGoalMonthly,
}: Props) {
  const router = useRouter()

  function updateRange(nextFrom: string, nextTo: string) {
    router.push(`?from=${nextFrom}&to=${nextTo}`)
  }

  return (
    <div className="space-y-6">
      {/* Date range filter */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="report-from" className="text-[13px] font-medium font-heading text-[#6b7a8d]">From</label>
          <input
            id="report-from"
            type="date"
            value={from}
            onChange={(e) => updateRange(e.target.value, to)}
            className="h-[36px] px-3 rounded-[8px] border border-[#e8ecf0] text-[13px] outline-none focus:border-[#00b89c]"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="report-to" className="text-[13px] font-medium font-heading text-[#6b7a8d]">To</label>
          <input
            id="report-to"
            type="date"
            value={to}
            onChange={(e) => updateRange(from, e.target.value)}
            className="h-[36px] px-3 rounded-[8px] border border-[#e8ecf0] text-[13px] outline-none focus:border-[#00b89c]"
          />
        </div>

        <div className="ml-auto">
          <Link href="/reports/insights">
            <Button variant="secondary">AI Insights</Button>
          </Link>
        </div>
      </div>

      <div className="space-y-6">
        {costFloor && (
          <Card>
            <CardHeader
              title="Fixed Cost of Living"
              subtitle="Minimum monthly household cost — active recurring rules and subscriptions"
            />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#6b7a8d]">Recurring Expenses</span>
                <span className="text-[13px] font-tabular text-[#1a2332]">
                  {formatCurrency(costFloor.recurringExpenses)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#6b7a8d]">Active Subscriptions</span>
                <span className="text-[13px] font-tabular text-[#1a2332]">
                  {formatCurrency(costFloor.subscriptions)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-[#e8ecf0]">
                <span className="text-[13px] font-semibold font-heading text-[#1a2332]">
                  Total Monthly Floor
                </span>
                <span className="text-[24px] font-semibold font-tabular text-[#1a2332]">
                  {formatCurrency(costFloor.totalMonthly)}
                </span>
              </div>
              {trends.length > 0 &&
                (() => {
                  const avgIncome = trends.reduce((sum, t) => sum + t.income, 0) / trends.length
                  if (avgIncome <= 0) return null
                  const pct = Math.round((costFloor.totalMonthly / avgIncome) * 100)
                  return (
                    <p className="text-[12px] text-[#6b7a8d]">
                      {pct}% of your average monthly income ({formatCurrency(avgIncome)})
                    </p>
                  )
                })()}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-5">
          <Card>
            <div className="flex items-start justify-between mb-1">
              <CardHeader title="Spending by Category" subtitle="Expenses only" />
              <a
                href={`/api/reports/spending?from=${from}T00:00:00Z&to=${to}T23:59:59Z&format=csv`}
                download="spending.csv"
                className="text-[12px] text-[#00b89c] hover:text-[#009e87] font-medium shrink-0 mt-0.5"
              >
                Export CSV
              </a>
            </div>
            <SpendingPieChart data={spending} />
          </Card>

          <Card>
            <CardHeader title="Top Categories" subtitle="vs. previous calendar month" />
            <div className="space-y-3">
              {spending.slice(0, 8).map((item) => {
                const cmp = comparison.find((c) => c.categoryId === item.categoryId)
                return (
                  <div key={item.categoryId}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-[13px] text-[#1a2332]">{item.categoryName}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[13px] font-semibold font-tabular text-[#1a2332]">
                          ${(item.amount / 100).toFixed(2)}
                        </span>
                        <span className="text-[12px] text-[#6b7a8d] ml-2">{item.percentage}%</span>
                      </div>
                    </div>
                    {cmp && (
                      <p
                        className={`text-[11px] font-tabular mt-0.5 ml-4 ${
                          cmp.percentChange === null
                            ? 'text-[#6b7a8d]'
                            : cmp.delta > 0
                              ? 'text-[#ef4444]'
                              : cmp.delta < 0
                                ? 'text-[#22c55e]'
                                : 'text-[#6b7a8d]'
                        }`}
                      >
                        {cmp.percentChange === null
                          ? 'New this month'
                          : `${cmp.delta >= 0 ? '+' : '-'}${formatCurrency(Math.abs(cmp.delta))} (${
                              cmp.percentChange >= 0 ? '+' : ''
                            }${cmp.percentChange}%) vs last month`}
                      </p>
                    )}
                  </div>
                )
              })}
              {spending.length === 0 && (
                <p className="text-[13px] text-[#6b7a8d]">No spending data for this period.</p>
              )}
            </div>

            {savings && (savings.currentAmount > 0 || savings.priorAmount > 0) && (
              <div className="mt-4 pt-4 border-t border-[#e8ecf0] flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium font-heading text-[#1a2332]">Saved This Month</p>
                  <p className="text-[12px] text-[#6b7a8d]">Moved to Savings & Investments — not counted as spending</p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-[13px] font-semibold font-tabular text-[#1a2332]">
                    {formatCurrency(savings.currentAmount)}
                  </p>
                  {savings.percentChange === null ? (
                    <p className="text-[11px] font-tabular text-[#6b7a8d] mt-0.5">New this month</p>
                  ) : (
                    <p
                      className={`text-[11px] font-tabular mt-0.5 ${
                        savings.delta > 0 ? 'text-[#22c55e]' : savings.delta < 0 ? 'text-[#ef4444]' : 'text-[#6b7a8d]'
                      }`}
                    >
                      {savings.delta >= 0 ? '+' : '-'}
                      {formatCurrency(Math.abs(savings.delta))} ({savings.percentChange >= 0 ? '+' : ''}
                      {savings.percentChange}%) vs last month
                    </p>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>

        {expenseSplit && (
          <Card>
            <CardHeader
              title="Fixed vs. Variable Expenses"
              subtitle="Categories with an active recurring rule or subscription count as fixed"
            />
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] font-medium font-heading text-[#1a2332]">Fixed / Committed</span>
                  <span className="text-[13px] font-semibold font-tabular text-[#1a2332]">
                    {formatCurrency(expenseSplit.fixed.total)} · {expenseSplit.fixed.percentage}%
                  </span>
                </div>
                <div className="space-y-2">
                  {expenseSplit.fixed.categories.map((c) => (
                    <div key={c.categoryId} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                        <span className="text-[13px] text-[#1a2332]">{c.categoryName}</span>
                      </div>
                      <span className="text-[13px] font-tabular text-[#1a2332]">{formatCurrency(c.amount)}</span>
                    </div>
                  ))}
                  {expenseSplit.fixed.categories.length === 0 && (
                    <p className="text-[13px] text-[#6b7a8d]">No fixed expenses this period.</p>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] font-medium font-heading text-[#1a2332]">
                    Variable / Discretionary
                  </span>
                  <span className="text-[13px] font-semibold font-tabular text-[#00b89c]">
                    {formatCurrency(expenseSplit.variable.total)} · {expenseSplit.variable.percentage}%
                  </span>
                </div>
                <div className="space-y-2">
                  {expenseSplit.variable.categories.map((c) => (
                    <div key={c.categoryId} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                        <span className="text-[13px] text-[#1a2332]">{c.categoryName}</span>
                      </div>
                      <span className="text-[13px] font-tabular text-[#1a2332]">{formatCurrency(c.amount)}</span>
                    </div>
                  ))}
                  {expenseSplit.variable.categories.length === 0 && (
                    <p className="text-[13px] text-[#6b7a8d]">No variable expenses this period.</p>
                  )}
                </div>
              </div>
            </div>
            <p className="text-[12px] text-[#6b7a8d] mt-4 pt-4 border-t border-[#e8ecf0]">
              {formatCurrency(expenseSplit.variable.total)} was truly discretionary this period — the rest was already committed.
            </p>
          </Card>
        )}

        {(() => {
          const trendSummary = summarizeTrends(trends)
          if (!trendSummary) return null
          const isAboveAverage = trendSummary.vsAverageDelta > 0
          return (
            <Card>
              <CardHeader title="Monthly Spending Summary" subtitle="Derived from the past 6 months" />
              <div className="grid grid-cols-3 gap-5">
                <div>
                  <p className="text-[13px] font-medium font-heading text-[#6b7a8d]">Average Monthly Spend</p>
                  <p className="text-[18px] font-semibold font-tabular text-[#1a2332] mt-1">
                    {formatCurrency(trendSummary.avgExpenses)}
                  </p>
                </div>
                <div>
                  <p className="text-[13px] font-medium font-heading text-[#6b7a8d]">This Month vs. Average</p>
                  <p
                    className={`text-[18px] font-semibold font-tabular mt-1 ${
                      isAboveAverage ? 'text-[#ef4444]' : 'text-[#22c55e]'
                    }`}
                  >
                    {isAboveAverage ? '+' : '-'}
                    {formatCurrency(Math.abs(trendSummary.vsAverageDelta))}
                  </p>
                  <p className="text-[12px] text-[#6b7a8d] mt-0.5">
                    {isAboveAverage ? 'Above average' : 'Below average'}
                  </p>
                </div>
                <div>
                  <p className="text-[13px] font-medium font-heading text-[#6b7a8d]">Average Monthly Income</p>
                  <p className="text-[18px] font-semibold font-tabular text-[#1a2332] mt-1">
                    {formatCurrency(trendSummary.avgIncome)}
                  </p>
                </div>
                <div>
                  <p className="text-[13px] font-medium font-heading text-[#6b7a8d]">Average Savings Rate</p>
                  <p className="text-[18px] font-semibold font-tabular text-[#1a2332] mt-1">
                    {trendSummary.avgSavingsRate.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-[13px] font-medium font-heading text-[#6b7a8d]">Best Month</p>
                  <p className="text-[18px] font-semibold font-tabular text-[#1a2332] mt-1">
                    {formatCurrency(trendSummary.bestMonth.expenses)}
                  </p>
                  <p className="text-[12px] text-[#6b7a8d] mt-0.5">{trendSummary.bestMonth.month}</p>
                </div>
                <div>
                  <p className="text-[13px] font-medium font-heading text-[#6b7a8d]">Worst Month</p>
                  <p className="text-[18px] font-semibold font-tabular text-[#1a2332] mt-1">
                    {formatCurrency(trendSummary.worstMonth.expenses)}
                  </p>
                  <p className="text-[12px] text-[#6b7a8d] mt-0.5">{trendSummary.worstMonth.month}</p>
                </div>
              </div>
            </Card>
          )
        })()}

        <Card>
          <div className="flex items-start justify-between mb-1">
            <CardHeader title="Monthly Trend" subtitle="Income vs. Expenses — past 6 months" />
            <a
              href="/api/reports/trends?months=6&format=csv"
              download="trends.csv"
              className="text-[12px] text-[#00b89c] hover:text-[#009e87] font-medium shrink-0 mt-0.5"
            >
              Export CSV
            </a>
          </div>
          <MonthlyTrendChart data={trends} />
        </Card>

        <Card>
          <CardHeader
            title="Savings Rate Trend"
            subtitle={
              savingsGoalMonthly > 0
                ? 'Net ÷ income per month, vs. your active savings goal'
                : 'Net ÷ income per month'
            }
          />
          <SavingsRateTrendChart data={computeSavingsRateSeries(trends, savingsGoalMonthly)} />
        </Card>

        <Card>
          <CardHeader title="Net Worth" subtitle="Past 12 months" />
          <NetWorthChart data={netWorth} />
        </Card>

        <Card>
          <CardHeader title="Budget vs. Actual" subtitle="Active budgets for selected period — highest usage first" />
          {budgetActual.length === 0 ? (
            <p className="text-[13px] text-[#6b7a8d] pt-2">No active budgets to display.</p>
          ) : (
            <BudgetActualChart data={budgetActual} />
          )}
        </Card>
      </div>
    </div>
  )
}
