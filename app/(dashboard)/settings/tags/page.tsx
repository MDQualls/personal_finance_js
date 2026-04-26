'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Tag } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'

type Tag = { id: string; name: string; color: string }

export default function TagsSettingsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editTag, setEditTag] = useState<Tag | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#6b7a8d')
  const [saving, setSaving] = useState(false)

  function load() {
    setLoading(true)
    fetch('/api/tags')
      .then((r) => r.json())
      .then((b) => { setTags(b.data ?? []); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  function openAdd() { setName(''); setColor('#6b7a8d'); setShowAdd(true) }
  function openEdit(tag: Tag) { setEditTag(tag); setName(tag.name); setColor(tag.color) }

  async function save() {
    setSaving(true)
    if (editTag) {
      await fetch(`/api/tags/${editTag.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
      })
      setEditTag(null)
    } else {
      await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
      })
      setShowAdd(false)
    }
    setSaving(false)
    load()
  }

  async function deleteTag(id: string) {
    if (!confirm('Delete this tag? It will be removed from all transactions.')) return
    await fetch(`/api/tags/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex justify-end">
        <Button onClick={openAdd}>
          <Plus size={16} strokeWidth={1.5} />
          New Tag
        </Button>
      </div>

      <Card padding={false}>
        <CardHeader title="Tags" subtitle="Free-form labels for transactions" />
        {loading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : tags.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="No tags yet"
            description="Create tags to label and filter transactions."
            action={{ label: 'New Tag', onClick: openAdd }}
          />
        ) : (
          <div className="divide-y divide-[#e8ecf0]">
            {tags.map((tag) => (
              <div key={tag.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                  <span className="text-[14px] text-[#1a2332]">{tag.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(tag)} className="h-7 w-7 flex items-center justify-center rounded-[6px] text-[#6b7a8d] hover:bg-[#f4f6f9]">
                    <Pencil size={14} strokeWidth={1.5} />
                  </button>
                  <button onClick={() => deleteTag(tag.id)} className="h-7 w-7 flex items-center justify-center rounded-[6px] text-[#6b7a8d] hover:text-[#ef4444] hover:bg-[#fef2f2]">
                    <Trash2 size={14} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={showAdd || !!editTag} onClose={() => { setShowAdd(false); setEditTag(null) }} title={editTag ? 'Edit Tag' : 'New Tag'}>
        <div className="space-y-4">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tax Deductible" />
          <div>
            <label className="block text-[13px] font-medium font-heading text-[#1a2332] mb-1">Color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded-[8px] border border-[#e8ecf0] p-1" />
              <span className="text-[13px] text-[#6b7a8d]">{color}</span>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button loading={saving} onClick={save}>{editTag ? 'Save Changes' : 'Create Tag'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
