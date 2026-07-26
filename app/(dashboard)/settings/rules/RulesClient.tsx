'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Zap, Store, Pencil } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'

type AutoRule = { id: string; pattern: string; isRegex: boolean; categoryId: string; priority: number }
type Category = { id: string; name: string }
type MerchantRule = { id: string; pattern: string; isRegex: boolean; displayName: string }

interface Props {
  rules: AutoRule[]
  categories: Category[]
  merchantRules: MerchantRule[]
}

const autoRuleFormSchema = z.object({
  pattern: z.string().min(1, 'Pattern is required').max(200),
  isRegex: z.boolean(),
  categoryId: z.string().min(1, 'Category is required'),
})
type AutoRuleFormValues = z.infer<typeof autoRuleFormSchema>

const merchantRuleFormSchema = z.object({
  pattern: z.string().min(1, 'Pattern is required').max(200),
  isRegex: z.boolean(),
  displayName: z.string().min(1, 'Display name is required').max(100),
})
type MerchantRuleFormValues = z.infer<typeof merchantRuleFormSchema>

export function RulesClient({ rules, categories, merchantRules }: Props) {
  const router = useRouter()
  const [showAdd, setShowAdd] = useState(false)
  const [showMerchantModal, setShowMerchantModal] = useState(false)
  const [editingMerchant, setEditingMerchant] = useState<MerchantRule | null>(null)

  const autoRuleForm = useForm<AutoRuleFormValues>({
    resolver: zodResolver(autoRuleFormSchema),
    defaultValues: { pattern: '', isRegex: false, categoryId: '' },
  })

  const merchantForm = useForm<MerchantRuleFormValues>({
    resolver: zodResolver(merchantRuleFormSchema),
    defaultValues: { pattern: '', isRegex: false, displayName: '' },
  })

  function openAdd() {
    autoRuleForm.reset({ pattern: '', isRegex: false, categoryId: '' })
    setShowAdd(true)
  }

  async function save(values: AutoRuleFormValues) {
    await fetch('/api/auto-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, priority: rules.length }),
    })
    setShowAdd(false)
    router.refresh()
  }

  async function deleteRule(id: string) {
    if (!confirm('Delete this rule?')) return
    await fetch(`/api/auto-rules/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  function openNewMerchant() {
    setEditingMerchant(null)
    merchantForm.reset({ pattern: '', isRegex: false, displayName: '' })
    setShowMerchantModal(true)
  }

  function openEditMerchant(rule: MerchantRule) {
    setEditingMerchant(rule)
    merchantForm.reset({ pattern: rule.pattern, isRegex: rule.isRegex, displayName: rule.displayName })
    setShowMerchantModal(true)
  }

  function closeMerchantModal() {
    setShowMerchantModal(false)
    setEditingMerchant(null)
  }

  async function saveMerchant(values: MerchantRuleFormValues) {
    const url = editingMerchant ? `/api/rules/merchant/${editingMerchant.id}` : '/api/rules/merchant'
    await fetch(url, {
      method: editingMerchant ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    closeMerchantModal()
    router.refresh()
  }

  async function deleteMerchant(id: string) {
    if (!confirm('Delete this merchant rule?')) return
    await fetch(`/api/rules/merchant/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }))

  return (
    <div className="max-w-2xl space-y-6">
      {/* Auto-Categorization Rules */}
      <div>
        <div className="flex justify-end mb-4">
          <Button onClick={openAdd}>
            <Plus size={16} strokeWidth={1.5} />
            New Rule
          </Button>
        </div>

        <Card padding={false}>
          <div className="px-5 py-4 border-b border-[#e8ecf0]">
            <CardHeader
              title="Auto-Categorization Rules"
              subtitle="First match wins — rules applied in priority order"
            />
          </div>

          {rules.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="No rules set"
              description="Create rules to automatically categorize transactions when they're added."
              action={{ label: 'New Rule', onClick: openAdd }}
            />
          ) : (
            <div className="divide-y divide-[#e8ecf0]">
              {rules.map((rule, i) => {
                const cat = categories.find((c) => c.id === rule.categoryId)
                return (
                  <div key={rule.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-[#b0bac6] w-5 text-right">{i + 1}</span>
                      <div>
                        <p className="text-[13px] font-medium text-[#1a2332]">
                          {rule.isRegex ? <code className="text-[12px] bg-[#f4f6f9] px-1 rounded">{rule.pattern}</code> : `"${rule.pattern}"`}
                        </p>
                        <p className="text-[12px] text-[#6b7a8d] mt-0.5">→ {cat?.name ?? rule.categoryId}</p>
                      </div>
                    </div>
                    <button onClick={() => deleteRule(rule.id)} aria-label="Delete" className="h-7 w-7 flex items-center justify-center rounded-[6px] text-[#6b7a8d] hover:text-[#ef4444] hover:bg-[#fef2f2]">
                      <Trash2 size={14} strokeWidth={1.5} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Merchant Normalization Rules */}
      <div>
        <div className="flex justify-end mb-4">
          <Button onClick={openNewMerchant}>
            <Plus size={16} strokeWidth={1.5} />
            New Rule
          </Button>
        </div>

        <Card padding={false}>
          <div className="px-5 py-4 border-b border-[#e8ecf0]">
            <CardHeader
              title="Merchant Normalization"
              subtitle="Map raw transaction strings to clean display names"
            />
          </div>

          {merchantRules.length === 0 ? (
            <EmptyState
              icon={Store}
              title="No merchant rules"
              description="Create rules to clean up raw merchant names from your bank."
              action={{ label: 'New Rule', onClick: openNewMerchant }}
            />
          ) : (
            <div className="divide-y divide-[#e8ecf0]">
              {merchantRules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-[13px] font-medium text-[#1a2332]">
                      {rule.isRegex
                        ? <code className="text-[12px] bg-[#f4f6f9] px-1 rounded">{rule.pattern}</code>
                        : `"${rule.pattern}"`}
                    </p>
                    <p className="text-[12px] text-[#6b7a8d] mt-0.5">→ {rule.displayName}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditMerchant(rule)}
                      aria-label="Edit"
                      className="h-7 w-7 flex items-center justify-center rounded-[6px] text-[#6b7a8d] hover:text-[#00b89c] hover:bg-[#e6f7f5]"
                    >
                      <Pencil size={14} strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => deleteMerchant(rule.id)}
                      aria-label="Delete"
                      className="h-7 w-7 flex items-center justify-center rounded-[6px] text-[#6b7a8d] hover:text-[#ef4444] hover:bg-[#fef2f2]"
                    >
                      <Trash2 size={14} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Auto-Categorization modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New Auto-Categorization Rule">
        <form onSubmit={autoRuleForm.handleSubmit(save)} className="space-y-4">
          <Input
            label="Pattern"
            {...autoRuleForm.register('pattern')}
            error={autoRuleForm.formState.errors.pattern?.message}
            placeholder="e.g. TRADER JOE"
            hint={autoRuleForm.watch('isRegex') ? 'Regex pattern (case-insensitive)' : 'Substring match (case-insensitive)'}
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" {...autoRuleForm.register('isRegex')} className="rounded" />
            <span className="text-[13px] text-[#1a2332]">Use regex pattern</span>
          </label>
          <Select
            label="Category"
            options={categoryOptions}
            placeholder="Select category…"
            {...autoRuleForm.register('categoryId')}
            error={autoRuleForm.formState.errors.categoryId?.message}
          />
          <div className="flex justify-end pt-2">
            <Button type="submit" loading={autoRuleForm.formState.isSubmitting}>Create Rule</Button>
          </div>
        </form>
      </Modal>

      {/* Merchant Normalization modal */}
      <Modal
        open={showMerchantModal}
        onClose={closeMerchantModal}
        title={editingMerchant ? 'Edit Merchant Rule' : 'New Merchant Rule'}
      >
        <form onSubmit={merchantForm.handleSubmit(saveMerchant)} className="space-y-4">
          <Input
            label="Pattern"
            {...merchantForm.register('pattern')}
            error={merchantForm.formState.errors.pattern?.message}
            placeholder="e.g. TRADER JOE"
            hint={merchantForm.watch('isRegex') ? 'Regex pattern (case-insensitive)' : 'Substring match (case-insensitive)'}
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" {...merchantForm.register('isRegex')} className="rounded" />
            <span className="text-[13px] text-[#1a2332]">Use regex pattern</span>
          </label>
          <Input
            label="Display Name"
            {...merchantForm.register('displayName')}
            error={merchantForm.formState.errors.displayName?.message}
            placeholder="e.g. Trader Joe's"
          />
          <div className="flex justify-end pt-2">
            <Button type="submit" loading={merchantForm.formState.isSubmitting}>
              {editingMerchant ? 'Save Changes' : 'Create Rule'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
