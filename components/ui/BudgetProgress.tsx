import { formatCurrency } from '@/lib/money'

interface BudgetProgressProps {
  spent: number  // cents
  limit: number  // cents
  label?: string
  showAmounts?: boolean
  budgetType?: 'SPENDING_LIMIT' | 'SAVINGS_GOAL'
}

function getProgressColor(percentage: number): string {
  if (percentage >= 100) return '#ef4444'
  if (percentage >= 75) return '#f59e0b'
  return '#22c55e'
}

function getBadgeVariant(percentage: number): string {
  if (percentage >= 100) return 'text-[#ef4444] bg-[#fef2f2]'
  if (percentage >= 75) return 'text-[#d97706] bg-[#fef9ec]'
  return 'text-[#22c55e] bg-[#f0fdf4]'
}

export function BudgetProgress({ spent, limit, label, showAmounts = true, budgetType }: BudgetProgressProps) {
  const percentage = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0
  const displayPercentage = limit > 0 ? Math.round((spent / limit) * 100) : 0

  const isSavingsGoal = budgetType === 'SAVINGS_GOAL'
  const color = isSavingsGoal
    ? (displayPercentage >= 100 ? '#22c55e' : '#00b89c')
    : getProgressColor(displayPercentage)
  const badgeVariant = isSavingsGoal
    ? (displayPercentage >= 100
        ? 'text-[#22c55e] bg-[#f0fdf4]'
        : 'text-[#00b89c] bg-[#e6f7f5]')
    : getBadgeVariant(displayPercentage)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        {label && (
          <p className="text-[13px] font-medium font-heading text-[#1a2332] truncate">{label}</p>
        )}
        <span className={`text-[11px] font-medium font-heading px-2 py-0.5 rounded-[99px] ${badgeVariant}`}>
          {displayPercentage}%
        </span>
      </div>

      <div className="h-[6px] w-full bg-[#e8ecf0] rounded-[3px] overflow-hidden">
        <div
          className="h-full rounded-[3px] transition-all"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>

      {showAmounts && (
        <div className="flex justify-between text-[12px] text-[#6b7a8d]">
          <span>{formatCurrency(spent)} {isSavingsGoal ? 'saved' : 'spent'}</span>
          <span>{formatCurrency(limit)} {isSavingsGoal ? 'goal' : 'budget'}</span>
        </div>
      )}
    </div>
  )
}
