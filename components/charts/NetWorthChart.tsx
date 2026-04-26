'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/money'
import type { NetWorthSnapshot } from '@/types'

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-[8px] shadow-tooltip p-3 text-[13px]">
      <p className="font-medium text-[#1a2332] mb-1">{label}</p>
      <p className="text-[#6b7a8d]">Net Worth: {formatCurrency(payload[0].value)}</p>
    </div>
  )
}

export function NetWorthChart({ data }: { data: NetWorthSnapshot[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00b89c" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#00b89c" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#e8ecf0" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7a8d' }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: '#6b7a8d' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${Math.round(v / 100).toLocaleString()}`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="netWorth"
          stroke="#00b89c"
          strokeWidth={2}
          fill="url(#netWorthGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
