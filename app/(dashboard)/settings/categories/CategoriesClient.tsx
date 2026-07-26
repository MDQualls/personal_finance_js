'use client'

import { useState } from 'react'
import { Plus, Settings, Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
  parentId: string | null
  color: string
  icon: string
  isIncome: boolean
  isSystem: boolean
  children?: Category[]
}

interface CategoriesClientProps {
  categories: Category[]
}

const categoryFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color'),
  parentId: z.string(),
  type: z.enum(['expense', 'income']),
})

type CategoryFormValues = z.infer<typeof categoryFormSchema>

export function CategoriesClient({ categories }: CategoriesClientProps) {
  const router = useRouter()

  const [showAdd, setShowAdd] = useState(false)
  const [addError, setAddError] = useState('')

  const [editing, setEditing] = useState<Category | null>(null)
  const [editError, setEditError] = useState('')

  const addForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: { name: '', color: '#6b7a8d', parentId: '', type: 'expense' },
  })

  const editForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: { name: '', color: '#6b7a8d', parentId: '', type: 'expense' },
  })

  const parentOptions = categories.map((c) => ({ value: c.id, label: c.name }))

  function openAdd() {
    setAddError('')
    addForm.reset({ name: '', color: '#6b7a8d', parentId: '', type: 'expense' })
    setShowAdd(true)
  }

  function closeAdd() {
    setShowAdd(false)
  }

  function openEdit(cat: Category) {
    setEditError('')
    editForm.reset({
      name: cat.name,
      color: cat.color,
      parentId: cat.parentId ?? '',
      type: cat.isIncome ? 'income' : 'expense',
    })
    setEditing(cat)
  }

  async function saveEdit(values: CategoryFormValues) {
    if (!editing) return
    setEditError('')
    const res = await fetch(`/api/categories/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: values.name,
        color: values.color,
        isIncome: values.type === 'income',
        parentId: values.parentId === '' ? null : values.parentId,
      }),
    })
    if (!res.ok) {
      const body = await res.json()
      setEditError(typeof body.error === 'string' ? body.error : 'Failed to save')
      return
    }
    setEditing(null)
    router.refresh()
  }

  async function save(values: CategoryFormValues) {
    setAddError('')
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: values.name,
        color: values.color,
        isIncome: values.type === 'income',
        ...(values.parentId ? { parentId: values.parentId } : {}),
      }),
    })
    if (!res.ok) {
      const body = await res.json()
      setAddError(typeof body.error === 'string' ? body.error : 'Failed to save')
      return
    }
    setShowAdd(false)
    router.refresh()
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex justify-end">
        <Button onClick={openAdd}>
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
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Category">
        <form onSubmit={editForm.handleSubmit(saveEdit)} className="space-y-4">
          <Input
            label="Name"
            {...editForm.register('name')}
            error={editForm.formState.errors.name?.message}
            placeholder="Category name"
          />
          <div>
            <label htmlFor="edit-category-color" className="block text-[13px] font-medium font-heading text-[#1a2332] mb-1">Color</label>
            <div className="flex items-center gap-3">
              <input
                id="edit-category-color"
                type="color"
                {...editForm.register('color')}
                className="h-10 w-14 cursor-pointer rounded-[8px] border border-[#e8ecf0] p-1"
              />
              <span className="text-[13px] text-[#6b7a8d] font-mono">{editForm.watch('color')}</span>
            </div>
          </div>
          <div>
            <Select
              label="Parent Category"
              options={[
                { value: '', label: 'None (top-level)' },
                ...categories
                  .filter((c) => c.id !== editing?.id)
                  .map((c) => ({ value: c.id, label: c.name })),
              ]}
              {...editForm.register('parentId')}
              disabled={(editing?.children?.length ?? 0) > 0}
            />
            {(editing?.children?.length ?? 0) > 0 && (
              <p className="text-[12px] text-[#6b7a8d] mt-1">
                This category has subcategories and cannot be moved under another category.
              </p>
            )}
          </div>
          <div>
            <Select
              label="Type"
              options={[
                { value: 'expense', label: 'Expense' },
                { value: 'income', label: 'Income' },
              ]}
              {...editForm.register('type')}
            />
          </div>
          {editError && <p className="text-[13px] text-[#ef4444]">{editError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" loading={editForm.formState.isSubmitting}>Save Changes</Button>
          </div>
        </form>
      </Modal>

      {/* Add modal */}
      <Modal open={showAdd} onClose={closeAdd} title="New Category">
        <form onSubmit={addForm.handleSubmit(save)} className="space-y-4">
          <Input
            label="Name"
            {...addForm.register('name')}
            error={addForm.formState.errors.name?.message}
            placeholder="e.g. Groceries"
          />
          <Select
            label="Parent Category (optional)"
            options={[{ value: '', label: 'None (top-level)' }, ...parentOptions]}
            {...addForm.register('parentId')}
          />
          <div>
            <label htmlFor="new-category-color" className="block text-[13px] font-medium font-heading text-[#1a2332] mb-1">Color</label>
            <input id="new-category-color" type="color" {...addForm.register('color')} className="h-10 w-14 cursor-pointer rounded-[8px] border border-[#e8ecf0] p-1" />
          </div>
          <div>
            <Select
              label="Type"
              options={[
                { value: 'expense', label: 'Expense' },
                { value: 'income', label: 'Income' },
              ]}
              {...addForm.register('type')}
            />
          </div>
          {addError && <p className="text-[13px] text-[#ef4444]">{addError}</p>}
          <div className="flex justify-end pt-2">
            <Button type="submit" loading={addForm.formState.isSubmitting}>Create Category</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
