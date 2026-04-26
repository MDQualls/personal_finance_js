'use client'

import { useState } from 'react'
import { Plus, Repeat, Pencil, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { SubscriptionForm } from '@/components/forms/SubscriptionForm'
import { formatCurrency } from '@/lib/money'
import { formatDisplay } from '@/lib/dates'
import type { Category } from '@/types'

type Subscription = {
  id: string
  name: string
  amount: number
  frequency: string
  nextDueDate: Date
  isActive: boolean
  alertDays: number
  notes: string | null
  monthlyEquivalent: number
  category: { id: string; name: string; color: string }
  categoryId: string
}

const FREQ_LABELS: Record<string, string> = {
  WEEKLY: 'Weekly',
  BIWEEKLY: 'Every 2 weeks',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly',
}

interface Props {
  subscriptions: Subscription[]
  categories: Category[]
  totalMonthly: number
  totalAnnual: number
}

export function SubscriptionsClient({ subscriptions, categories, totalMonthly, totalAnnual }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Subscription | null>(null)

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    await fetch(`/api/subscriptions/${id}`, { method: 'DELETE' })
    window.location.reload()
  }

  function handleEdit(sub: Subscription) {
    setEditing(sub)
  }

  return (
    <div className="space-y-5">
      {/* Totals banner */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <p className="text-[13px] font-medium font-heading text-[#6b7a8d]">Monthly Total</p>
          <p className="text-[24px] font-semibold font-tabular text-[#1a2332] mt-1">
            {formatCurrency(totalMonthly)}
          </p>
        </Card>
        <Card>
          <p className="text-[13px] font-medium font-heading text-[#6b7a8d]">Annual Total</p>
          <p className="text-[24px] font-semibold font-tabular text-[#1a2332] mt-1">
            {formatCurrency(totalAnnual)}
          </p>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setShowAdd(true)}>
          <Plus size={16} strokeWidth={1.5} />
          Add Subscription
        </Button>
      </div>

      {subscriptions.length === 0 ? (
        <Card>
          <EmptyState
            icon={Repeat}
            title="No subscriptions tracked"
            description="Add your recurring services and bills to track and project their costs."
            action={{ label: 'Add Subscription', onClick: () => setShowAdd(true) }}
          />
        </Card>
      ) : (
        <Card padding={false}>
          <div className="divide-y divide-[#e8ecf0]">
            {subscriptions.map((sub) => (
              <div key={sub.id} className="group flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-[8px] flex-shrink-0"
                    style={{ backgroundColor: sub.category.color }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-medium text-[#1a2332]">{sub.name}</p>
                      <Badge variant={sub.isActive ? 'active' : 'cancelled'}>
                        {sub.isActive ? 'Active' : 'Cancelled'}
                      </Badge>
                    </div>
                    <p className="text-[12px] text-[#6b7a8d] mt-0.5">
                      {FREQ_LABELS[sub.frequency]} · Due {formatDisplay(sub.nextDueDate)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[14px] font-semibold font-tabular text-[#1a2332]">
                      {formatCurrency(sub.amount)}
                    </p>
                    {sub.frequency !== 'MONTHLY' && (
                      <p className="text-[12px] text-[#6b7a8d]">
                        ≈ {formatCurrency(sub.monthlyEquivalent)}/mo
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(sub)}
                      className="h-7 w-7 flex items-center justify-center rounded-[6px] text-[#6b7a8d] hover:text-[#1a2332] hover:bg-[#f4f6f9] transition-colors"
                    >
                      <Pencil size={14} strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => handleDelete(sub.id, sub.name)}
                      className="h-7 w-7 flex items-center justify-center rounded-[6px] text-[#6b7a8d] hover:text-[#ef4444] hover:bg-[#fef2f2] transition-colors"
                    >
                      <Trash2 size={14} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Subscription">
        <SubscriptionForm
          categories={categories}
          onSuccess={() => { setShowAdd(false); window.location.reload() }}
        />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Subscription">
        {editing && (
          <SubscriptionForm
            categories={categories}
            initialValues={editing}
            onSuccess={() => { setEditing(null); window.location.reload() }}
          />
        )}
      </Modal>
    </div>
  )
}
