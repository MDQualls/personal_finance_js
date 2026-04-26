'use client'

import { useState } from 'react'
import { Plus, PiggyBank } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { BudgetProgress } from '@/components/ui/BudgetProgress'
import { BudgetForm } from '@/components/forms/BudgetForm'
import type { Category } from '@/types'

type Budget = {
  id: string
  amount: number
  spent: number
  period: string
  category: { id: string; name: string; color: string }
}

const PERIOD_LABELS: Record<string, string> = {
  WEEKLY: 'This week',
  MONTHLY: 'This month',
  QUARTERLY: 'This quarter',
  YEARLY: 'This year',
}

interface BudgetsClientProps {
  budgets: Budget[]
  categories: Category[]
}

export function BudgetsClient({ budgets, categories }: BudgetsClientProps) {
  const [showAdd, setShowAdd] = useState(false)

  const overCount = budgets.filter((b) => b.spent >= b.amount).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          {overCount > 0 && (
            <p className="text-[13px] text-[#ef4444] font-medium">
              {overCount} budget{overCount > 1 ? 's' : ''} over limit
            </p>
          )}
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus size={16} strokeWidth={1.5} />
          New Budget
        </Button>
      </div>

      {budgets.length === 0 ? (
        <Card>
          <EmptyState
            icon={PiggyBank}
            title="No budgets set"
            description="Create spending limits for your categories to stay on track."
            action={{ label: 'Create Budget', onClick: () => setShowAdd(true) }}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => (
            <Card key={budget.id}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: budget.category.color }}
                  />
                  <p className="text-[14px] font-semibold font-heading text-[#1a2332]">
                    {budget.category.name}
                  </p>
                </div>
                <span className="text-[11px] text-[#6b7a8d]">
                  {PERIOD_LABELS[budget.period] ?? budget.period}
                </span>
              </div>
              <BudgetProgress spent={budget.spent} limit={budget.amount} />
            </Card>
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New Budget">
        <BudgetForm
          categories={categories}
          onSuccess={() => { setShowAdd(false); window.location.reload() }}
        />
      </Modal>
    </div>
  )
}
