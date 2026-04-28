'use client'

import { useState } from 'react'
import { Plus, Settings, Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

type Category = {
  id: string
  name: string
  color: string
  icon: string
  isIncome: boolean
  isSystem: boolean
  children?: Category[]
}

interface CategoriesClientProps {
  categories: Category[]
}

export function CategoriesClient({ categories }: CategoriesClientProps) {
  const router = useRouter()

  // Add state
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#6b7a8d')
  const [parentId, setParentId] = useState('')
  const [isIncome, setIsIncome] = useState(false)
  const [saving, setSaving] = useState(false)

  // Edit state
  const [editing, setEditing] = useState<Category | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('#6b7a8d')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const parentOptions = categories.map((c) => ({ value: c.id, label: c.name }))

  function openEdit(cat: Category) {
    setEditing(cat)
    setEditName(cat.name)
    setEditColor(cat.color)
    setEditError('')
  }

  async function saveEdit() {
    if (!editing) return
    setEditSaving(true)
    setEditError('')
    const res = await fetch(`/api/categories/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, color: editColor }),
    })
    setEditSaving(false)
    if (!res.ok) {
      const body = await res.json()
      setEditError(typeof body.error === 'string' ? body.error : 'Failed to save')
      return
    }
    setEditing(null)
    router.refresh()
  }

  async function save() {
    setSaving(true)
    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        color,
        isIncome,
        ...(parentId ? { parentId } : {}),
      }),
    })
    setSaving(false)
    setShowAdd(false)
    router.refresh()
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowAdd(true)}>
          <Plus size={16} strokeWidth={1.5} />
          New Category
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card>
          <EmptyState
            icon={Settings}
            title="No categories"
            description="Categories are seeded on first run. Run: npx prisma db seed"
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => (
            <Card key={cat.id} padding={false}>
              <div className="px-5 py-3 flex items-center gap-3">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                <p className="text-[14px] font-semibold font-heading text-[#1a2332] flex-1">{cat.name}</p>
                {cat.isSystem && <Badge variant="default">System</Badge>}
                {cat.isIncome && <Badge variant="active">Income</Badge>}
                {!cat.isSystem && (
                  <button
                    onClick={() => openEdit(cat)}
                    className="ml-1 p-1 rounded-[6px] text-[#6b7a8d] hover:text-[#00b89c] hover:bg-[#e6f7f5] transition-colors"
                    aria-label={`Edit ${cat.name}`}
                  >
                    <Pencil size={14} strokeWidth={1.5} />
                  </button>
                )}
              </div>
              {(cat.children?.length ?? 0) > 0 && (
                <div className="border-t border-[#e8ecf0] divide-y divide-[#e8ecf0]">
                  {cat.children?.map((sub) => (
                    <div key={sub.id} className="flex items-center gap-3 pl-10 pr-5 py-2.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sub.color }} />
                      <p className="text-[13px] text-[#6b7a8d] flex-1">{sub.name}</p>
                      {sub.isSystem && <Badge variant="default">System</Badge>}
                      {!sub.isSystem && (
                        <button
                          onClick={() => openEdit(sub)}
                          className="ml-1 p-1 rounded-[6px] text-[#6b7a8d] hover:text-[#00b89c] hover:bg-[#e6f7f5] transition-colors"
                          aria-label={`Edit ${sub.name}`}
                        >
                          <Pencil size={14} strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit Category`}>
        <div className="space-y-4">
          <Input
            label="Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Category name"
          />
          <div>
            <label className="block text-[13px] font-medium font-heading text-[#1a2332] mb-1">Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={editColor}
                onChange={(e) => setEditColor(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded-[8px] border border-[#e8ecf0] p-1"
              />
              <span className="text-[13px] text-[#6b7a8d] font-mono">{editColor}</span>
            </div>
          </div>
          {editError && <p className="text-[13px] text-[#ef4444]">{editError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button loading={editSaving} onClick={saveEdit}>Save Changes</Button>
          </div>
        </div>
      </Modal>

      {/* Add modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New Category">
        <div className="space-y-4">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Groceries" />
          <Select
            label="Parent Category (optional)"
            options={[{ value: '', label: 'None (top-level)' }, ...parentOptions]}
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
          />
          <div>
            <label className="block text-[13px] font-medium font-heading text-[#1a2332] mb-1">Color</label>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded-[8px] border border-[#e8ecf0] p-1" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isIncome} onChange={(e) => setIsIncome(e.target.checked)} className="rounded" />
            <span className="text-[13px] text-[#1a2332]">This is an income category</span>
          </label>
          <div className="flex justify-end pt-2">
            <Button loading={saving} onClick={save}>Create Category</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
