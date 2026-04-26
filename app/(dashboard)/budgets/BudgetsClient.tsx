'use client'

import { useState } from 'react'
import { Plus, PiggyBank, Pencil, Trash2, RotateCcw } from 'lucide-react'
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
  rollover: boolean
  isActive: boolean
  categoryId: string
  category: { id: string; name: string; color: string }
}

const PERIOD_LABELS: Record<string, string> = {
  WEEKLY: 'This week',
  MONTHLY: 'This month',
  QUARTERLY: 'This quarter',
  YEARLY: 'This year',
}

type FilterTab = 'active' | 'archived'

interface BudgetsClientProps {
  budgets: Budget[]
  categories: Category[]
}

export function BudgetsClient({ budgets, categories }: BudgetsClientProps) {
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Budget | null>(null)
  const [tab, setTab] = useState<FilterTab>('active')

  const visible = budgets.filter((b) => (tab === 'active' ? b.isActive : !b.isActive))
  const archivedCount = budgets.filter((b) => !b.isActive).length
  const overCount = budgets.filter((b) => b.isActive && b.spent >= b.amount).length

  async function handleArchive(id: string) {
    if (!confirm('Archive this budget? You can restore it later.')) return
    await fetch(`/api/budgets/${id}`, { method: 'DELETE' })
    window.location.reload()
  }

  async function handleRestore(id: string) {
    await fetch(`/api/budgets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: true }),
    })
    window.location.reload()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 bg-[#f4f6f9] rounded-[8px]">
          <button
            onClick={() => setTab('active')}
            className={`px-3 py-1.5 rounded-[6px] text-[13px] font-medium font-heading transition-colors ${
              tab === 'active'
                ? 'bg-white text-[#1a2332] shadow-sm'
                : 'text-[#6b7a8d] hover:text-[#1a2332]'
            }`}
          >
            Active
            {overCount > 0 && (
              <span className="ml-1.5 text-[11px] bg-[#fef2f2] text-[#ef4444] px-1.5 py-0.5 rounded-[99px]">
                {overCount} over
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('archived')}
            className={`px-3 py-1.5 rounded-[6px] text-[13px] font-medium font-heading transition-colors ${
              tab === 'archived'
                ? 'bg-white text-[#1a2332] shadow-sm'
                : 'text-[#6b7a8d] hover:text-[#1a2332]'
            }`}
          >
            Archived
            {archivedCount > 0 && (
              <span className="ml-1.5 text-[11px] bg-[#e8ecf0] text-[#6b7a8d] px-1.5 py-0.5 rounded-[99px]">
                {archivedCount}
              </span>
            )}
          </button>
        </div>

        <Button onClick={() => setShowAdd(true)}>
          <Plus size={16} strokeWidth={1.5} />
          New Budget
        </Button>
      </div>

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={PiggyBank}
            title={tab === 'active' ? 'No active budgets' : 'No archived budgets'}
            description={
              tab === 'active'
                ? 'Create spending limits for your categories to stay on track.'
                : 'Archived budgets will appear here.'
            }
            action={tab === 'active' ? { label: 'Create Budget', onClick: () => setShowAdd(true) } : undefined}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((budget) => (
            <Card key={budget.id} className={!budget.isActive ? 'opacity-60' : undefined}>
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
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#6b7a8d]">
                    {PERIOD_LABELS[budget.period] ?? budget.period}
                  </span>
                  <div className="flex items-center gap-1">
                    {budget.isActive ? (
                      <>
                        <button
                          onClick={() => setEditing(budget)}
                          className="h-6 w-6 flex items-center justify-center rounded-[6px] text-[#6b7a8d] hover:text-[#1a2332] hover:bg-[#f4f6f9] transition-colors"
                          title="Edit"
                        >
                          <Pencil size={13} strokeWidth={1.5} />
                        </button>
                        <button
                          onClick={() => handleArchive(budget.id)}
                          className="h-6 w-6 flex items-center justify-center rounded-[6px] text-[#6b7a8d] hover:text-[#ef4444] hover:bg-[#fef2f2] transition-colors"
                          title="Archive"
                        >
                          <Trash2 size={13} strokeWidth={1.5} />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleRestore(budget.id)}
                        className="h-6 flex items-center gap-1 px-2 rounded-[6px] text-[11px] font-medium text-[#00b89c] hover:bg-[#e6f7f5] transition-colors"
                        title="Restore"
                      >
                        <RotateCcw size={12} strokeWidth={1.5} />
                        Restore
                      </button>
                    )}
                  </div>
                </div>
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

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Budget">
        {editing && (
          <BudgetForm
            categories={categories}
            initialValues={editing}
            onSuccess={() => { setEditing(null); window.location.reload() }}
          />
        )}
      </Modal>
    </div>
  )
}
