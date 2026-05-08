'use client'

import { useState } from 'react'
import { RefreshCw, Plus, Pencil, Play, XCircle, UploadCloud } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { RecurringRuleForm } from '@/components/forms/RecurringRuleForm'
import { formatCurrency } from '@/lib/money'
import { formatDisplay } from '@/lib/dates'
import type { Account, Category } from '@/types'

const FREQ_LABELS: Record<string, string> = {
  WEEKLY: 'Weekly',
  BIWEEKLY: 'Every 2 Weeks',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly',
}

type Rule = {
  id: string
  name: string
  amount: number
  frequency: string
  nextDate: Date
  type: 'INCOME' | 'EXPENSE'
  isActive: boolean
  autoPost: boolean
  notes: string | null
  lastPostedAt: Date | null
  accountId: string
  categoryId: string
  monthlyEquivalent: number
  account: { id: string; name: string }
  category: { id: string; name: string; color: string }
}

interface Props {
  rules: Rule[]
  accounts: Account[]
  categories: (Category & { children: Category[] })[]
  monthlyIncome: number
  monthlyExpenses: number
}

function isDueSoon(date: Date): 'overdue' | 'soon' | null {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const diff = Math.floor((d.getTime() - now.getTime()) / 86400000)
  if (diff < 0) return 'overdue'
  if (diff <= 3) return 'soon'
  return null
}

export function RecurringClient({ rules, accounts, categories, monthlyIncome, monthlyExpenses }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Rule | null>(null)
  const [postingAll, setPostingAll] = useState(false)

  const income = rules.filter((r) => r.type === 'INCOME')
  const expenses = rules.filter((r) => r.type === 'EXPENSE')
  const monthlyNet = monthlyIncome - monthlyExpenses

  async function handlePostAll() {
    setPostingAll(true)
    try {
      const res = await fetch('/api/recurring/post-due', { method: 'POST' })
      const data = await res.json()
      const { posted, skipped, errors } = data.data ?? {}
      const msg = `Posted ${posted ?? 0} rule(s). Skipped: ${skipped ?? 0}.${errors?.length ? ` Errors: ${errors.join(', ')}` : ''}`
      alert(msg)
      window.location.reload()
    } finally {
      setPostingAll(false)
    }
  }

  async function handlePostNow(rule: Rule) {
    if (!confirm(`Post "${rule.name}" now? This will create a transaction and advance the next date.`)) return
    await fetch(`/api/recurring/${rule.id}/post-now`, { method: 'POST' })
    window.location.reload()
  }

  async function handleDeactivate(rule: Rule) {
    if (!confirm(`Deactivate "${rule.name}"? It will no longer auto-post or appear in projections.`)) return
    await fetch(`/api/recurring/${rule.id}`, { method: 'DELETE' })
    window.location.reload()
  }

  async function handleToggleAutoPost(rule: Rule) {
    await fetch(`/api/recurring/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoPost: !rule.autoPost }),
    })
    window.location.reload()
  }

  function RuleSection({ title, sectionRules }: { title: string; sectionRules: Rule[] }) {
    if (sectionRules.length === 0) return null
    return (
      <div>
        <h2 className="text-[16px] font-semibold font-heading text-[#1a2332] mb-3">{title}</h2>
        <Card padding={false}>
          <div className="divide-y divide-[#e8ecf0]">
            {sectionRules.map((rule) => {
              const dueSoon = isDueSoon(rule.nextDate)
              return (
                <div key={rule.id} className="group flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-[8px] flex-shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: rule.category.color }}
                    >
                      <RefreshCw size={14} strokeWidth={1.5} className="text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[14px] font-medium text-[#1a2332] truncate">{rule.name}</p>
                        <span className="text-[11px] font-medium bg-[#f4f6f9] text-[#6b7a8d] px-2 py-0.5 rounded-[99px] flex-shrink-0">
                          {FREQ_LABELS[rule.frequency]}
                        </span>
                        {!rule.autoPost && (
                          <span className="text-[11px] font-medium bg-[#fef9ec] text-[#d97706] px-2 py-0.5 rounded-[99px] flex-shrink-0">
                            Manual
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p
                          className={`text-[12px] ${
                            dueSoon === 'overdue'
                              ? 'text-[#ef4444]'
                              : dueSoon === 'soon'
                              ? 'text-[#d97706]'
                              : 'text-[#6b7a8d]'
                          }`}
                        >
                          {dueSoon === 'overdue' ? 'Overdue · ' : dueSoon === 'soon' ? 'Due soon · ' : ''}
                          Next: {formatDisplay(rule.nextDate)}
                        </p>
                        <span className="text-[12px] text-[#b0bac6]">·</span>
                        <p className="text-[12px] text-[#6b7a8d]">{rule.category.name}</p>
                        <span className="text-[12px] text-[#b0bac6]">·</span>
                        <p className="text-[12px] text-[#6b7a8d]">{rule.account.name}</p>
                      </div>
                      {rule.lastPostedAt && (
                        <p className="text-[11px] text-[#b0bac6] mt-0.5">
                          Last posted {formatDisplay(rule.lastPostedAt)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <p
                        className={`text-[14px] font-semibold font-tabular ${
                          rule.type === 'INCOME' ? 'text-[#22c55e]' : 'text-[#1a2332]'
                        }`}
                      >
                        {rule.type === 'INCOME' ? '+' : '-'}
                        {formatCurrency(Math.abs(rule.amount))}
                      </p>
                      {rule.frequency !== 'MONTHLY' && (
                        <p className="text-[12px] text-[#6b7a8d]">
                          ≈ {formatCurrency(rule.monthlyEquivalent)}/mo
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handlePostNow(rule)}
                        className="h-7 w-7 flex items-center justify-center rounded-[6px] text-[#6b7a8d] hover:text-[#00b89c] hover:bg-[#e6f7f5] transition-colors"
                        title="Post now"
                      >
                        <Play size={13} strokeWidth={1.5} />
                      </button>
                      <button
                        onClick={() => setEditing(rule)}
                        className="h-7 w-7 flex items-center justify-center rounded-[6px] text-[#6b7a8d] hover:text-[#1a2332] hover:bg-[#f4f6f9] transition-colors"
                        title="Edit"
                      >
                        <Pencil size={13} strokeWidth={1.5} />
                      </button>
                      <button
                        onClick={() => handleDeactivate(rule)}
                        className="h-7 w-7 flex items-center justify-center rounded-[6px] text-[#6b7a8d] hover:text-[#ef4444] hover:bg-[#fef2f2] transition-colors"
                        title="Deactivate"
                      >
                        <XCircle size={13} strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <p className="text-[13px] font-medium font-heading text-[#6b7a8d]">Monthly Income</p>
          <p className="text-[24px] font-semibold font-tabular text-[#22c55e] mt-1">
            +{formatCurrency(monthlyIncome)}
          </p>
        </Card>
        <Card>
          <p className="text-[13px] font-medium font-heading text-[#6b7a8d]">Monthly Expenses</p>
          <p className="text-[24px] font-semibold font-tabular text-[#1a2332] mt-1">
            -{formatCurrency(monthlyExpenses)}
          </p>
        </Card>
        <Card>
          <p className="text-[13px] font-medium font-heading text-[#6b7a8d]">Monthly Net</p>
          <p
            className={`text-[24px] font-semibold font-tabular mt-1 ${
              monthlyNet >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'
            }`}
          >
            {monthlyNet >= 0 ? '+' : '-'}
            {formatCurrency(Math.abs(monthlyNet))}
          </p>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-[#6b7a8d]">
          {rules.length} active rule{rules.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handlePostAll} loading={postingAll}>
            <UploadCloud size={16} strokeWidth={1.5} />
            Post Due Now
          </Button>
          <Button onClick={() => setShowAdd(true)}>
            <Plus size={16} strokeWidth={1.5} />
            Add Rule
          </Button>
        </div>
      </div>

      {rules.length === 0 ? (
        <Card>
          <EmptyState
            icon={RefreshCw}
            title="No recurring rules"
            description="Add rules for your recurring income and expenses — paychecks, rent, loan payments — to auto-post transactions on schedule."
            action={{ label: 'Add Rule', onClick: () => setShowAdd(true) }}
          />
        </Card>
      ) : (
        <>
          <RuleSection title="Recurring Transactions" sectionRules={rules} />
        </>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Recurring Rule">
        <RecurringRuleForm
          accounts={accounts}
          categories={categories}
          onSuccess={() => { setShowAdd(false); window.location.reload() }}
        />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Recurring Rule">
        {editing && (
          <RecurringRuleForm
            accounts={accounts}
            categories={categories}
            initialValues={editing}
            onSuccess={() => { setEditing(null); window.location.reload() }}
          />
        )}
      </Modal>
    </div>
  )
}
