'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Zap, Store, Pencil } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'

type AutoRule = { id: string; pattern: string; isRegex: boolean; categoryId: string; priority: number }
type Category = { id: string; name: string }
type MerchantRule = { id: string; pattern: string; isRegex: boolean; displayName: string }

export default function RulesSettingsPage() {
  const [rules, setRules] = useState<AutoRule[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [pattern, setPattern] = useState('')
  const [isRegex, setIsRegex] = useState(false)
  const [categoryId, setCategoryId] = useState('')
  const [saving, setSaving] = useState(false)

  const [merchantRules, setMerchantRules] = useState<MerchantRule[]>([])
  const [merchantLoading, setMerchantLoading] = useState(true)
  const [showMerchantModal, setShowMerchantModal] = useState(false)
  const [editingMerchant, setEditingMerchant] = useState<MerchantRule | null>(null)
  const [mPattern, setMPattern] = useState('')
  const [mIsRegex, setMIsRegex] = useState(false)
  const [mDisplayNameStr, setMDisplayNameStr] = useState('')
  const [mSaving, setMSaving] = useState(false)

  function load() {
    setLoading(true)
    Promise.all([
      fetch('/api/auto-rules').then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
    ]).then(([r, c]) => {
      setRules(r.data ?? [])
      const flat: Category[] = []
      for (const cat of c.data ?? []) {
        flat.push(cat)
        for (const sub of cat.children ?? []) flat.push(sub)
      }
      setCategories(flat)
      setLoading(false)
    })
  }

  function loadMerchant() {
    setMerchantLoading(true)
    fetch('/api/rules/merchant')
      .then((r) => r.json())
      .then((r) => {
        setMerchantRules(r.data ?? [])
        setMerchantLoading(false)
      })
  }

  useEffect(() => {
    load()
    loadMerchant()
  }, [])

  async function save() {
    setSaving(true)
    await fetch('/api/auto-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern, isRegex, categoryId, priority: rules.length }),
    })
    setSaving(false)
    setShowAdd(false)
    setPattern('')
    setIsRegex(false)
    setCategoryId('')
    load()
  }

  async function deleteRule(id: string) {
    if (!confirm('Delete this rule?')) return
    await fetch(`/api/auto-rules/${id}`, { method: 'DELETE' })
    load()
  }

  function openNewMerchant() {
    setEditingMerchant(null)
    setMPattern('')
    setMIsRegex(false)
    setMDisplayNameStr('')
    setShowMerchantModal(true)
  }

  function openEditMerchant(rule: MerchantRule) {
    setEditingMerchant(rule)
    setMPattern(rule.pattern)
    setMIsRegex(rule.isRegex)
    setMDisplayNameStr(rule.displayName)
    setShowMerchantModal(true)
  }

  function closeMerchantModal() {
    setShowMerchantModal(false)
    setEditingMerchant(null)
    setMPattern('')
    setMIsRegex(false)
    setMDisplayNameStr('')
  }

  async function saveMerchant() {
    setMSaving(true)
    const url = editingMerchant ? `/api/rules/merchant/${editingMerchant.id}` : '/api/rules/merchant'
    await fetch(url, {
      method: editingMerchant ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: mPattern, isRegex: mIsRegex, displayName: mDisplayNameStr }),
    })
    setMSaving(false)
    closeMerchantModal()
    loadMerchant()
  }

  async function deleteMerchant(id: string) {
    if (!confirm('Delete this merchant rule?')) return
    await fetch(`/api/rules/merchant/${id}`, { method: 'DELETE' })
    loadMerchant()
  }

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }))

  return (
    <div className="max-w-2xl space-y-6">
      {/* Auto-Categorization Rules */}
      <div>
        <div className="flex justify-end mb-4">
          <Button onClick={() => setShowAdd(true)}>
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

          {loading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : rules.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="No rules set"
              description="Create rules to automatically categorize transactions when they're added."
              action={{ label: 'New Rule', onClick: () => setShowAdd(true) }}
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
                    <button onClick={() => deleteRule(rule.id)} className="h-7 w-7 flex items-center justify-center rounded-[6px] text-[#6b7a8d] hover:text-[#ef4444] hover:bg-[#fef2f2]">
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

          {merchantLoading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : merchantRules.length === 0 ? (
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
                      className="h-7 w-7 flex items-center justify-center rounded-[6px] text-[#6b7a8d] hover:text-[#00b89c] hover:bg-[#e6f7f5]"
                    >
                      <Pencil size={14} strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => deleteMerchant(rule.id)}
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
        <div className="space-y-4">
          <Input
            label="Pattern"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="e.g. TRADER JOE"
            hint={isRegex ? 'Regex pattern (case-insensitive)' : 'Substring match (case-insensitive)'}
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isRegex} onChange={(e) => setIsRegex(e.target.checked)} className="rounded" />
            <span className="text-[13px] text-[#1a2332]">Use regex pattern</span>
          </label>
          <Select
            label="Category"
            options={categoryOptions}
            placeholder="Select category…"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          />
          <div className="flex justify-end pt-2">
            <Button loading={saving} onClick={save}>Create Rule</Button>
          </div>
        </div>
      </Modal>

      {/* Merchant Normalization modal */}
      <Modal
        open={showMerchantModal}
        onClose={closeMerchantModal}
        title={editingMerchant ? 'Edit Merchant Rule' : 'New Merchant Rule'}
      >
        <div className="space-y-4">
          <Input
            label="Pattern"
            value={mPattern}
            onChange={(e) => setMPattern(e.target.value)}
            placeholder="e.g. TRADER JOE"
            hint={mIsRegex ? 'Regex pattern (case-insensitive)' : 'Substring match (case-insensitive)'}
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={mIsRegex}
              onChange={(e) => setMIsRegex(e.target.checked)}
              className="rounded"
            />
            <span className="text-[13px] text-[#1a2332]">Use regex pattern</span>
          </label>
          <Input
            label="Display Name"
            value={mDisplayNameStr}
            onChange={(e) => setMDisplayNameStr(e.target.value)}
            placeholder="e.g. Trader Joe's"
          />
          <div className="flex justify-end pt-2">
            <Button
              loading={mSaving}
              onClick={saveMerchant}
              disabled={!mPattern.trim() || !mDisplayNameStr.trim()}
            >
              {editingMerchant ? 'Save Changes' : 'Create Rule'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
