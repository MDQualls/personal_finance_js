'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/money'
import type { SpendingByCategory } from '@/types'

interface SpendingPieChartProps {
  data: SpendingByCategory[]
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: SpendingByCategory }[] }) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return (
    <div className="bg-white rounded-[8px] shadow-tooltip p-3 text-[13px]">
      <p className="font-medium text-[#1a2332] mb-1">{item.categoryName}</p>
      <p className="text-[#6b7a8d]">{formatCurrency(item.amount)} · {item.percentage}%</p>
    </div>
  )
}

export function SpendingPieChart({ data }: SpendingPieChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[280px] text-[13px] text-[#6b7a8d]">
        No spending data for this period
      </div>
    )
  }

  return (
    <div>
      {/* Custom legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4">
        {data.slice(0, 6).map((item) => (
          <div key={item.categoryId} className="flex items-center gap-1.5 text-[12px] text-[#6b7a8d]">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
            {item.categoryName}
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={110}
            paddingAngle={2}
            dataKey="amount"
          >
            {data.map((entry) => (
              <Cell key={entry.categoryId} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
