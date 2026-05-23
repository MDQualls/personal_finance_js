'use client'

import { useRouter } from 'next/navigation'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ProjectionChart } from '@/components/charts/ProjectionChart'
import { formatCurrency } from '@/lib/money'
import type { DailyBalance } from '@/types'

const WINDOWS = [30, 60, 90] as const

interface Props {
  data: DailyBalance[]
  days: 30 | 60 | 90
  accounts: { name: string; balance: number }[]
}

export function CashFlowClient({ data, days, accounts }: Props) {
  const router = useRouter()

  const lastDay = data[data.length - 1]
  const daysBelow = data.filter((d) => d.belowZero).length

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {WINDOWS.map((w) => (
          <Button
            key={w}
            variant={days === w ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => router.push(`?days=${w}`)}
          >
            {w} Days
          </Button>
        ))}
      </div>

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

      <Card>
        <CardHeader title="Accounts Included" />
        {accounts.length === 0 ? (
          <p className="text-[13px] text-[#6b7a8d]">No accounts found.</p>
        ) : (
          <div className="space-y-2">
            {accounts.map((a) => (
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
    </div>
  )
}
