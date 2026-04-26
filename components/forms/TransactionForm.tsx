'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { toCents } from '@/lib/money'
import type { Account, Category } from '@/types'

const schema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  amount: z.string().refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) !== 0, {
    message: 'Enter a non-zero amount',
  }),
  date: z.string().min(1, 'Date is required'),
  categoryId: z.string().min(1, 'Category is required'),
  description: z.string().min(1, 'Description is required').max(255),
  notes: z.string().max(1000).optional(),
})

type FormValues = z.infer<typeof schema>

interface TransactionFormProps {
  accounts: Account[]
  categories: (Category & { children: Category[] })[]
  onSuccess?: () => void
}

export function TransactionForm({ accounts, categories, onSuccess }: TransactionFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { date: new Date().toISOString().slice(0, 10) },
  })

  async function onSubmit(values: FormValues) {
    const amount = parseFloat(values.amount)
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: values.accountId,
        amount: toCents(amount),
        date: new Date(values.date).toISOString(),
        categoryId: values.categoryId,
        description: values.description,
        notes: values.notes || undefined,
      }),
    })

    if (!res.ok) {
      setError('root', { message: 'Failed to save transaction.' })
      return
    }

    onSuccess?.()
  }

  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }))

  const categoryOptions: { value: string; label: string }[] = []
  for (const cat of categories) {
    categoryOptions.push({ value: cat.id, label: cat.name })
    for (const sub of cat.children) {
      categoryOptions.push({ value: sub.id, label: `  ${sub.name}` })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {errors.root && (
        <div className="rounded-[8px] bg-[#fef2f2] px-4 py-3 text-sm text-[#ef4444]">
          {errors.root.message}
        </div>
      )}

      <Select
        label="Account"
        options={accountOptions}
        placeholder="Select account…"
        error={errors.accountId?.message}
        {...register('accountId')}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Amount"
          type="number"
          step="0.01"
          placeholder="-45.00"
          error={errors.amount?.message}
          hint="Negative = expense, positive = income"
          {...register('amount')}
        />
        <Input
          label="Date"
          type="date"
          error={errors.date?.message}
          {...register('date')}
        />
      </div>

      <Select
        label="Category"
        options={categoryOptions}
        placeholder="Select category…"
        error={errors.categoryId?.message}
        {...register('categoryId')}
      />

      <Input
        label="Description"
        placeholder="e.g. Trader Joe's"
        error={errors.description?.message}
        {...register('description')}
      />

      <div>
        <label className="block text-[13px] font-medium font-heading text-[#1a2332] mb-1">
          Notes (optional)
        </label>
        <textarea
          className="w-full px-3 py-2 rounded-[8px] border border-[#e8ecf0] text-[14px] text-[#1a2332] outline-none focus:border-[#00b89c] focus:ring-1 focus:ring-[#00b89c] resize-none"
          rows={2}
          placeholder="Any additional notes…"
          {...register('notes')}
        />
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" loading={isSubmitting}>Save Transaction</Button>
      </div>
    </form>
  )
}
