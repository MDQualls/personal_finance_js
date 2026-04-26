'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { ProjectionChart } from '@/components/charts/ProjectionChart'
import { formatCurrency } from '@/lib/money'
import type { DailyBalance } from '@/types'

const WINDOWS = [30, 60, 90] as const

export default function CashFlowPage() {
  const [days, setDays] = useState<30 | 60 | 90>(30)
  const [data, setData] = useState<DailyBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState<{ accounts: { name: string; balance: number }[] }>({ accounts: [] })

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reports/cashflow?days=${days}`)
      .then((r) => r.json())
      .then((body) => {
        setData(body.data ?? [])
        setMeta(body.meta ?? { accounts: [] })
        setLoading(false)
      })
  }, [days])

  const lastDay = data[data.length - 1]
  const daysBelow = data.filter((d) => d.belowZero).length

  return (
    <div className="space-y-6">
      {/* Window toggle */}
      <div className="flex items-center gap-2">
        {WINDOWS.map((w) => (
          <Button
            key={w}
            variant={days === w ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setDays(w)}
          >
            {w} Days
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size={32} /></div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <p className="text-[13px] font-medium font-heading text-[#6b7a8d]">Current Balance</p>
              <p className={`text-[22px] font-semibold font-tabular mt-1 ${data[0]?.balance < 0 ? 'text-[#ef4444]' : 'text-[#1a2332]'}`}>
                {formatCurrency(data[0]?.balance ?? 0)}
              </p>
            </Card>
            <Card>
              <p className="text-[13px] font-medium font-heading text-[#6b7a8d]">Projected in {days}d</p>
              <p className={`text-[22px] font-semibold font-tabular mt-1 ${lastDay?.belowZero ? 'text-[#ef4444]' : 'text-[#1a2332]'}`}>
                {formatCurrency(lastDay?.balance ?? 0)}
              </p>
            </Card>
            <Card>
              <p className="text-[13px] font-medium font-heading text-[#6b7a8d]">Days Below Zero</p>
              <p className={`text-[22px] font-semibold mt-1 ${daysBelow > 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                {daysBelow}
              </p>
            </Card>
          </div>

          <Card>
            <CardHeader title="Projected Balance" subtitle="Based on recurring rules and active subscriptions" />
            <ProjectionChart data={data} />
          </Card>

          {/* Assumptions */}
          <Card>
            <CardHeader title="Accounts Included" />
            {meta.accounts.length === 0 ? (
              <p className="text-[13px] text-[#6b7a8d]">No accounts found.</p>
            ) : (
              <div className="space-y-2">
                {meta.accounts.map((a) => (
                  <div key={a.name} className="flex justify-between text-[13px]">
                    <span className="text-[#1a2332]">{a.name}</span>
                    <span className={`font-tabular font-semibold ${a.balance < 0 ? 'text-[#ef4444]' : 'text-[#1a2332]'}`}>
                      {formatCurrency(a.balance)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
