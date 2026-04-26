'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/money'
import type { DailyBalance } from '@/types'

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  const balance = payload[0].value
  return (
    <div className="bg-white rounded-[8px] shadow-tooltip p-3 text-[13px]">
      <p className="font-medium text-[#1a2332] mb-1">{label}</p>
      <p className={balance < 0 ? 'text-[#ef4444]' : 'text-[#6b7a8d]'}>
        {formatCurrency(balance)}
      </p>
    </div>
  )
}

interface ProjectionChartProps {
  data: DailyBalance[]
}

export function ProjectionChart({ data }: ProjectionChartProps) {
  const chartData = data.map((d) => ({
    date: d.date.slice(5), // "MM-DD"
    balance: d.balance,
    belowZero: d.belowZero,
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid vertical={false} stroke="#e8ecf0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#6b7a8d' }}
          axisLine={false}
          tickLine={false}
          interval={Math.floor(data.length / 6)}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#6b7a8d' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${Math.round(v / 100).toLocaleString()}`}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1} />
        <Line
          type="monotone"
          dataKey="balance"
          stroke="#00b89c"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#00b89c' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
