'use client'

import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { toCents, toDollars } from '@/lib/money'
import type { Account, Category } from '@/types'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.string().refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, {
    message: 'Enter a positive amount',
  }),
  frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
  accountId: z.string().min(1, 'Account is required'),
  categoryId: z.string().min(1, 'Category is required'),
  nextDate: z.string().min(1, 'Next date is required'),
  autoPost: z.boolean(),
  notes: z.string().max(1000).optional(),
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
  accountId: string
  categoryId: string
  nextDate: Date
  type: 'INCOME' | 'EXPENSE'
  autoPost: boolean
  notes: string | null
  account?: { id: string; name: string }
}

interface Props {
  accounts: Account[]
  categories: (Category & { children: Category[] })[]
  initialValues?: InitialValues
  onSuccess?: () => void
}

export function RecurringRuleForm({ accounts, categories, initialValues, onSuccess }: Props) {
  const isEditing = !!initialValues

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues
      ? {
          name: initialValues.name,
          type: initialValues.type,
          amount: toDollars(Math.abs(initialValues.amount)).toFixed(2),
          frequency: initialValues.frequency as FormValues['frequency'],
          accountId: initialValues.accountId,
          categoryId: initialValues.categoryId,
          nextDate: new Date(initialValues.nextDate).toISOString().slice(0, 10),
          autoPost: initialValues.autoPost,
          notes: initialValues.notes ?? '',
        }
      : {
          type: 'EXPENSE',
          frequency: 'MONTHLY',
          autoPost: true,
          nextDate: new Date().toISOString().slice(0, 10),
        },
  })

  const autoPost = useWatch({ control, name: 'autoPost' })
  const selectedType = useWatch({ control, name: 'type' })

  // plaidManaged is a P4 field — always false until Plaid integration is added
  const isPlaidManaged = false

  useEffect(() => {
    if (isPlaidManaged && autoPost) {
      setValue('autoPost', false)
    }
  }, [isPlaidManaged, autoPost, setValue])

  async function onSubmit(values: FormValues) {
    const dollars = parseFloat(values.amount)
    const cents = toCents(dollars)
    const signedAmount = values.type === 'INCOME' ? cents : -cents

    const payload = {
      name: values.name,
      amount: signedAmount,
      frequency: values.frequency,
      accountId: values.accountId,
      categoryId: values.categoryId,
      nextDate: new Date(values.nextDate).toISOString(),
      type: values.type,
      autoPost: values.autoPost,
      notes: values.notes || undefined,
    }

    const res = await fetch(
      isEditing ? `/api/recurring/${initialValues.id}` : '/api/recurring',
      {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError('root', {
        message: typeof data?.error === 'string' ? data.error : `Failed to ${isEditing ? 'update' : 'create'} rule.`,
      })
      return
    }

    onSuccess?.()
  }

  const accountOptions = accounts
    .filter((a) => a.isActive !== false)
    .map((a) => ({ value: a.id, label: a.name }))

  const categoryGroups = categories.map((cat) => ({
    label: cat.name,
    options: [
      { value: cat.id, label: cat.name },
      ...cat.children.map((sub) => ({ value: sub.id, label: `  ${sub.name}` })),
    ],
  }))

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {errors.root && (
        <div className="rounded-[8px] bg-[#fef2f2] px-4 py-3 text-sm text-[#ef4444]">
          {errors.root.message}
        </div>
      )}

      <Input
        label="Name"
        placeholder="e.g. Monthly Paycheck, Rent Payment"
        error={errors.name?.message}
        {...register('name')}
      />

      {/* Type segmented control */}
      <div>
        <p className="text-[13px] font-medium font-heading text-[#1a2332] mb-1.5">Type</p>
        <div className="flex items-center gap-1 p-1 bg-[#f4f6f9] rounded-[8px] w-fit">
          {(['INCOME', 'EXPENSE'] as const).map((t) => (
            <label
              key={t}
              className="relative cursor-pointer"
            >
              <input type="radio" value={t} className="sr-only" {...register('type')} />
              <span
                className={`block px-4 py-1.5 rounded-[6px] text-[13px] font-medium font-heading transition-colors select-none
                  ${selectedType === t
                    ? 'bg-white text-[#1a2332] shadow-sm'
                    : 'text-[#6b7a8d] hover:text-[#1a2332]'
                  }`}
              >
                {t === 'INCOME' ? 'Income' : 'Expense'}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Amount"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0.00"
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
        <Select
          label="Account"
          options={accountOptions}
          placeholder="Select account…"
          error={errors.accountId?.message}
          {...register('accountId')}
        />
        <Select
          label="Category"
          groups={categoryGroups}
          placeholder="Select category…"
          error={errors.categoryId?.message}
          {...register('categoryId')}
        />
      </div>

      <Input
        label="Next Due Date"
        type="date"
        error={errors.nextDate?.message}
        {...register('nextDate')}
      />

      <div>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 rounded"
            disabled={isPlaidManaged}
            {...register('autoPost')}
          />
          <div>
            <span className="text-[13px] text-[#1a2332] font-medium">Auto-post transactions</span>
            <p className="text-[12px] text-[#6b7a8d] mt-0.5">
              Automatically create a transaction when this rule is due
            </p>
          </div>
        </label>
        {isPlaidManaged && (
          <div className="mt-2 flex items-start gap-2 rounded-[8px] bg-[#fef9ec] px-3 py-2.5 text-[12px] text-[#d97706]">
            <AlertTriangle size={14} strokeWidth={1.5} className="flex-shrink-0 mt-0.5" />
            <span>
              This account is managed by Plaid. Auto-post has been disabled to prevent duplicate
              transactions. This rule will still appear in cash flow projections.
            </span>
          </div>
        )}
      </div>

      <div>
        <label className="block text-[13px] font-medium font-heading text-[#1a2332] mb-1.5">
          Notes <span className="text-[#6b7a8d] font-normal">(optional)</span>
        </label>
        <textarea
          rows={2}
          placeholder="Any notes about this rule…"
          className="w-full rounded-[8px] border border-[#e8ecf0] px-3 py-2 text-[14px] text-[#1a2332] placeholder-[#b0bac6] focus:outline-none focus:border-[#00b89c] resize-none"
          {...register('notes')}
        />
        {errors.notes && (
          <p className="mt-1 text-[12px] text-[#ef4444]">{errors.notes.message}</p>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" loading={isSubmitting}>
          {isEditing ? 'Save Changes' : 'Add Rule'}
        </Button>
      </div>
    </form>
  )
}
