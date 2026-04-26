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
  categoryId: z.string().min(1, 'Category is required'),
  amount: z.string().refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, {
    message: 'Enter a positive amount',
  }),
  period: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
  rollover: z.boolean().optional(),
})

type FormValues = z.infer<typeof schema>

const PERIOD_OPTIONS = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'YEARLY', label: 'Yearly' },
]

type InitialValues = {
  id: string
  amount: number
  period: string
  rollover: boolean
  categoryId: string
  category: { id: string; name: string; color: string }
}

interface BudgetFormProps {
  categories: Category[]
  initialValues?: InitialValues
  onSuccess?: () => void
}

export function BudgetForm({ categories, initialValues, onSuccess }: BudgetFormProps) {
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
          categoryId: initialValues.categoryId,
          amount: toDollars(initialValues.amount).toFixed(2),
          period: initialValues.period as FormValues['period'],
          rollover: initialValues.rollover,
        }
      : { period: 'MONTHLY' },
  })

  async function onSubmit(values: FormValues) {
    const payload = {
      categoryId: values.categoryId,
      amount: toCents(parseFloat(values.amount)),
      period: values.period,
      rollover: values.rollover ?? false,
      ...(!isEditing ? { startDate: new Date().toISOString() } : {}),
    }

    const res = await fetch(isEditing ? `/api/budgets/${initialValues.id}` : '/api/budgets', {
      method: isEditing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      setError('root', { message: `Failed to ${isEditing ? 'update' : 'create'} budget.` })
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

      <Select
        label="Category"
        options={categoryOptions}
        placeholder="Select category…"
        error={errors.categoryId?.message}
        {...register('categoryId')}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Budget Amount"
          type="number"
          step="0.01"
          placeholder="500.00"
          error={errors.amount?.message}
          {...register('amount')}
        />
        <Select
          label="Period"
          options={PERIOD_OPTIONS}
          error={errors.period?.message}
          {...register('period')}
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" className="rounded" {...register('rollover')} />
        <span className="text-[13px] text-[#1a2332]">Roll over unused amount each period</span>
      </label>

      <div className="flex justify-end pt-2">
        <Button type="submit" loading={isSubmitting}>
          {isEditing ? 'Save Changes' : 'Create Budget'}
        </Button>
      </div>
    </form>
  )
}
