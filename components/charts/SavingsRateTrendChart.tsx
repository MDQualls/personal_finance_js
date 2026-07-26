'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { SavingsRatePoint } from '@/types'

interface SavingsRateTrendChartProps {
  data: SavingsRatePoint[]
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-[8px] shadow-tooltip p-3 text-[13px]">
      <p className="font-medium text-[#1a2332] mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-[#6b7a8d]">
          {p.name}: {p.value.toFixed(1)}%
        </p>
      ))}
    </div>
  )
}

export function SavingsRateTrendChart({ data }: SavingsRateTrendChartProps) {
  const hasGoal = data.some((d) => d.goalRate !== null)

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1.5 text-[12px] text-[#6b7a8d]">
          <span className="w-3 h-0.5 rounded-sm bg-[#00b89c]" />
          Savings Rate
        </div>
        {hasGoal && (
          <div className="flex items-center gap-1.5 text-[12px] text-[#6b7a8d]">
            <span className="w-3 h-0.5 rounded-sm bg-[#6b7a8d]" style={{ opacity: 0.6 }} />
            Goal
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
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
            tickFormatter={(v) => `${Math.round(v)}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="savingsRate"
            name="Savings Rate"
            stroke="#00b89c"
            strokeWidth={2}
            dot={{ r: 4, fill: '#00b89c', stroke: '#ffffff', strokeWidth: 2 }}
            connectNulls
          />
          {hasGoal && (
            <Line
              type="monotone"
              dataKey="goalRate"
              name="Goal"
              stroke="#6b7a8d"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
