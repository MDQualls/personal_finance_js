'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Tag as TagIcon } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'

type Tag = { id: string; name: string; color: string }

interface Props {
  tags: Tag[]
}

const tagFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color'),
})

type TagFormValues = z.infer<typeof tagFormSchema>

export function TagsClient({ tags }: Props) {
  const router = useRouter()
  const [showAdd, setShowAdd] = useState(false)
  const [editTag, setEditTag] = useState<Tag | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TagFormValues>({
    resolver: zodResolver(tagFormSchema),
    defaultValues: { name: '', color: '#6b7a8d' },
  })
  const color = watch('color')

  function openAdd() { reset({ name: '', color: '#6b7a8d' }); setShowAdd(true) }
  function openEdit(tag: Tag) { setEditTag(tag); reset({ name: tag.name, color: tag.color }) }
  function closeModal() { setShowAdd(false); setEditTag(null) }

  async function save(values: TagFormValues) {
    if (editTag) {
      await fetch(`/api/tags/${editTag.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
    } else {
      await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
    }
    closeModal()
    router.refresh()
  }

  async function deleteTag(id: string) {
    if (!confirm('Delete this tag? It will be removed from all transactions.')) return
    await fetch(`/api/tags/${id}`, { method: 'DELETE' })
    router.refresh()
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
        {tags.length === 0 ? (
          <EmptyState
            icon={TagIcon}
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
                  <button onClick={() => openEdit(tag)} aria-label="Edit" className="h-7 w-7 flex items-center justify-center rounded-[6px] text-[#6b7a8d] hover:bg-[#f4f6f9]">
                    <Pencil size={14} strokeWidth={1.5} />
                  </button>
                  <button onClick={() => deleteTag(tag.id)} aria-label="Delete" className="h-7 w-7 flex items-center justify-center rounded-[6px] text-[#6b7a8d] hover:text-[#ef4444] hover:bg-[#fef2f2]">
                    <Trash2 size={14} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={showAdd || !!editTag} onClose={closeModal} title={editTag ? 'Edit Tag' : 'New Tag'}>
        <form onSubmit={handleSubmit(save)} className="space-y-4">
          <Input
            label="Name"
            {...register('name')}
            error={errors.name?.message}
            placeholder="e.g. Tax Deductible"
          />
          <div>
            <label htmlFor="tag-color" className="block text-[13px] font-medium font-heading text-[#1a2332] mb-1">Color</label>
            <div className="flex items-center gap-3">
              <input id="tag-color" type="color" {...register('color')} className="h-10 w-14 cursor-pointer rounded-[8px] border border-[#e8ecf0] p-1" />
              <span className="text-[13px] text-[#6b7a8d]">{color}</span>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button type="submit" loading={isSubmitting}>{editTag ? 'Save Changes' : 'Create Tag'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
