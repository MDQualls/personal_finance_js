'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { toCents, toDollars } from '@/lib/money'
import type { Category } from '@/types'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  amount: z.string().refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, {
    message: 'Enter a positive amount',
  }),
  frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
  nextDueDate: z.string().min(1, 'Due date is required'),
  categoryId: z.string().min(1, 'Category is required'),
  notes: z.string().max(500).optional(),
  alertDays: z.string().optional(),
  isActive: z.boolean().optional(),
})

type FormValues = z.infer<typeof schema>

const FREQ_OPTIONS = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BIWEEKLY', label: 'Every 2 weeks' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'YEARLY', label: 'Yearly' },
]

type InitialValues = {
  id: string
  name: string
  amount: number
  frequency: string
  nextDueDate: Date
  categoryId: string
  notes: string | null
  alertDays: number
  isActive: boolean
}

interface SubscriptionFormProps {
  categories: Category[]
  initialValues?: InitialValues
  onSuccess?: () => void
}

export function SubscriptionForm({ categories, initialValues, onSuccess }: SubscriptionFormProps) {
  const isEditing = !!initialValues

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues
      ? {
          name: initialValues.name,
          amount: toDollars(initialValues.amount).toFixed(2),
          frequency: initialValues.frequency as FormValues['frequency'],
          nextDueDate: new Date(initialValues.nextDueDate).toISOString().slice(0, 10),
          categoryId: initialValues.categoryId,
          notes: initialValues.notes ?? '',
          alertDays: String(initialValues.alertDays),
          isActive: initialValues.isActive,
        }
      : {
          frequency: 'MONTHLY',
          alertDays: '3',
          nextDueDate: new Date().toISOString().slice(0, 10),
          isActive: true,
        },
  })

  async function onSubmit(values: FormValues) {
    const payload = {
      name: values.name,
      amount: toCents(parseFloat(values.amount)),
      frequency: values.frequency,
      nextDueDate: new Date(values.nextDueDate).toISOString(),
      categoryId: values.categoryId,
      notes: values.notes || undefined,
      alertDays: parseInt(values.alertDays ?? '3', 10),
      ...(isEditing ? { isActive: values.isActive } : {}),
    }

    const res = await fetch(
      isEditing ? `/api/subscriptions/${initialValues.id}` : '/api/subscriptions',
      {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )

    if (!res.ok) {
      setError('root', { message: `Failed to ${isEditing ? 'update' : 'create'} subscription.` })
      return
    }

    onSuccess?.()
  }

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }))

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {errors.root && (
        <div className="rounded-[8px] bg-[#fef2f2] px-4 py-3 text-sm text-[#ef4444]">
          {errors.root.message}
        </div>
      )}

      <Input label="Name" placeholder="e.g. Netflix" error={errors.name?.message} {...register('name')} />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Amount"
          type="number"
          step="0.01"
          placeholder="14.99"
          error={errors.amount?.message}
          {...register('amount')}
        />
        <Select
          label="Frequency"
          options={FREQ_OPTIONS}
          error={errors.frequency?.message}
          {...register('frequency')}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Next Due Date"
          type="date"
          error={errors.nextDueDate?.message}
          {...register('nextDueDate')}
        />
        <Input
          label="Alert Days Before"
          type="number"
          min="0"
          max="30"
          error={errors.alertDays?.message}
          {...register('alertDays')}
        />
      </div>

      <Select
        label="Category"
        options={categoryOptions}
        placeholder="Select category…"
        error={errors.categoryId?.message}
        {...register('categoryId')}
      />

      {isEditing && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="rounded" {...register('isActive')} />
          <span className="text-[13px] text-[#1a2332]">Active</span>
        </label>
      )}

      <div className="flex justify-end pt-2">
        <Button type="submit" loading={isSubmitting}>
          {isEditing ? 'Save Changes' : 'Add Subscription'}
        </Button>
      </div>
    </form>
  )
}
