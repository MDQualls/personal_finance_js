'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/money'

type BudgetActualRow = {
  categoryId: string
  categoryName: string
  budgeted: number
  spent: number
  percentage: number
  budgetType: 'SPENDING_LIMIT' | 'SAVINGS_GOAL'
}

interface BudgetActualChartProps {
  data: BudgetActualRow[]
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: BudgetActualRow }[] }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="bg-white rounded-[8px] shadow-tooltip p-3 text-[13px] min-w-[180px]">
      <p className="font-medium text-[#1a2332] mb-2">{row.categoryName}</p>
      <p className="text-[#6b7a8d]">Budgeted: {formatCurrency(row.budgeted)}</p>
      <p className="text-[#6b7a8d]">Spent: {formatCurrency(row.spent)}</p>
      <p className={`font-medium mt-1 ${
        row.budgetType === 'SAVINGS_GOAL'
          ? (row.percentage >= 100 ? 'text-[#22c55e]' : 'text-[#00b89c]')
          : (row.percentage >= 100 ? 'text-[#ef4444]' : 'text-[#00b89c]')
      }`}>
        {row.percentage}% {row.budgetType === 'SAVINGS_GOAL' ? 'saved' : 'used'}
      </p>
    </div>
  )
}

export function BudgetActualChart({ data }: BudgetActualChartProps) {
  const rowHeight = 40
  const minHeight = 120
  const chartHeight = Math.max(minHeight, data.length * rowHeight)

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="#e8ecf0" />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: '#6b7a8d' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${Math.round(v / 100).toLocaleString()}`}
        />
        <YAxis
          type="category"
          dataKey="categoryName"
          width={110}
          tick={{ fontSize: 12, fill: '#1a2332' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f4f6f9' }} />
        <Bar dataKey="spent" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {data.map((row) => (
            <Cell
              key={row.categoryId}
              fill={
                row.budgetType === 'SAVINGS_GOAL'
                  ? (row.percentage >= 100 ? '#22c55e' : '#00b89c')
                  : (row.percentage >= 100 ? '#ef4444' : '#00b89c')
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
