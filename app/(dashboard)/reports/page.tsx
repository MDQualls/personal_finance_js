'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { SpendingPieChart } from '@/components/charts/SpendingPieChart'
import { MonthlyTrendChart } from '@/components/charts/MonthlyTrendChart'
import { NetWorthChart } from '@/components/charts/NetWorthChart'
import { BudgetActualChart } from '@/components/charts/BudgetActualChart'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/money'
import Link from 'next/link'
import type { SpendingByCategory, MonthlyTrend, NetWorthSnapshot, BudgetActualRow, CostFloor } from '@/types'

export default function ReportsPage() {
  const [spending, setSpending] = useState<SpendingByCategory[]>([])
  const [trends, setTrends] = useState<MonthlyTrend[]>([])
  const [netWorth, setNetWorth] = useState<NetWorthSnapshot[]>([])
  const [budgetActual, setBudgetActual] = useState<BudgetActualRow[]>([])
  const [costFloor, setCostFloor] = useState<CostFloor | null>(null)
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10))
  const [to, setTo] = useState(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10))

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/reports/spending?from=${from}T00:00:00Z&to=${to}T23:59:59Z`).then((r) => r.json()),
      fetch('/api/reports/trends?months=6').then((r) => r.json()),
      fetch('/api/reports/net-worth?months=12').then((r) => r.json()),
      fetch(`/api/reports/budget-actual?from=${from}T00:00:00Z&to=${to}T23:59:59Z`).then((r) => r.json()),
      fetch('/api/reports/cost-floor').then((r) => r.json()),
    ]).then(([s, t, n, b, c]) => {
      setSpending(s.data ?? [])
      setTrends(t.data ?? [])
      setNetWorth(n.data ?? [])
      setBudgetActual(b.data ?? [])
      setCostFloor(c.data ?? null)
      setLoading(false)
    })
  }, [from, to])

  return (
    <div className="space-y-6">
      {/* Date range filter */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-[13px] font-medium font-heading text-[#6b7a8d]">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-[36px] px-3 rounded-[8px] border border-[#e8ecf0] text-[13px] outline-none focus:border-[#00b89c]"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[13px] font-medium font-heading text-[#6b7a8d]">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-[36px] px-3 rounded-[8px] border border-[#e8ecf0] text-[13px] outline-none focus:border-[#00b89c]"
          />
        </div>

        <div className="ml-auto">
          <Link href="/reports/insights">
            <Button variant="secondary">AI Insights</Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size={32} /></div>
      ) : (
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
              <CardHeader title="Top Categories" />
              <div className="space-y-3">
                {spending.slice(0, 8).map((item) => (
                  <div key={item.categoryId} className="flex items-center justify-between">
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
                ))}
                {spending.length === 0 && (
                  <p className="text-[13px] text-[#6b7a8d]">No spending data for this period.</p>
                )}
              </div>
            </Card>
          </div>

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
      )}
    </div>
  )
}
