'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Zap } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'

type AutoRule = { id: string; pattern: string; isRegex: boolean; categoryId: string; priority: number }
type Category = { id: string; name: string }

export default function RulesSettingsPage() {
  const [rules, setRules] = useState<AutoRule[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [pattern, setPattern] = useState('')
  const [isRegex, setIsRegex] = useState(false)
  const [categoryId, setCategoryId] = useState('')
  const [saving, setSaving] = useState(false)

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

  useEffect(() => { load() }, [])

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

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }))

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex justify-end">
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
    </div>
  )
}
