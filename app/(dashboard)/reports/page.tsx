'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { SpendingPieChart } from '@/components/charts/SpendingPieChart'
import { MonthlyTrendChart } from '@/components/charts/MonthlyTrendChart'
import { NetWorthChart } from '@/components/charts/NetWorthChart'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'
import type { SpendingByCategory, MonthlyTrend, NetWorthSnapshot } from '@/types'

export default function ReportsPage() {
  const [spending, setSpending] = useState<SpendingByCategory[]>([])
  const [trends, setTrends] = useState<MonthlyTrend[]>([])
  const [netWorth, setNetWorth] = useState<NetWorthSnapshot[]>([])
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
    ]).then(([s, t, n]) => {
      setSpending(s.data ?? [])
      setTrends(t.data ?? [])
      setNetWorth(n.data ?? [])
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
          <div className="grid grid-cols-2 gap-5">
            <Card>
              <CardHeader title="Spending by Category" subtitle="Expenses only" />
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
            <CardHeader title="Monthly Trend" subtitle="Income vs. Expenses — past 6 months" />
            <MonthlyTrendChart data={trends} />
          </Card>

          <Card>
            <CardHeader title="Net Worth" subtitle="Past 12 months" />
            <NetWorthChart data={netWorth} />
          </Card>
        </div>
      )}
    </div>
  )
}
