'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/money'
import type { MonthlyTrend } from '@/types'

interface MonthlyTrendChartProps {
  data: MonthlyTrend[]
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-[8px] shadow-tooltip p-3 text-[13px]">
      <p className="font-medium text-[#1a2332] mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-[#6b7a8d]">
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

export function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1.5 text-[12px] text-[#6b7a8d]">
          <span className="w-3 h-2 rounded-sm bg-[#00b89c]" />
          Income
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-[#6b7a8d]">
          <span className="w-3 h-2 rounded-sm bg-[#e8ecf0]" />
          Expenses
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} barGap={4} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="#e8ecf0" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: '#6b7a8d' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#6b7a8d' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${Math.round(v / 100).toLocaleString()}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="income" name="Income" fill="#00b89c" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expenses" name="Expenses" fill="#e8ecf0" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
