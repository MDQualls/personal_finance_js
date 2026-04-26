'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { toCents } from '@/lib/money'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  type: z.enum(['CHECKING', 'SAVINGS', 'CREDIT_CARD', 'LOAN', 'INVESTMENT', 'ASSET', 'LIABILITY'], {
    required_error: 'Account type is required',
  }),
  balance: z.string().refine((v) => !isNaN(parseFloat(v)), { message: 'Enter a valid amount' }),
  currency: z.string().length(3).default('USD'),
})

type FormValues = z.infer<typeof schema>

const ACCOUNT_TYPES = [
  { value: 'CHECKING', label: 'Checking' },
  { value: 'SAVINGS', label: 'Savings' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'LOAN', label: 'Loan' },
  { value: 'INVESTMENT', label: 'Investment' },
  { value: 'ASSET', label: 'Asset' },
  { value: 'LIABILITY', label: 'Liability' },
]

interface AccountFormProps {
  onSuccess?: () => void
}

export function AccountForm({ onSuccess }: AccountFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: values.name,
        type: values.type,
        balance: toCents(parseFloat(values.balance)),
        currency: values.currency,
      }),
    })

    if (!res.ok) {
      setError('root', { message: 'Failed to create account. Please try again.' })
      return
    }

    onSuccess?.()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {errors.root && (
        <div className="rounded-[8px] bg-[#fef2f2] px-4 py-3 text-sm text-[#ef4444]">
          {errors.root.message}
        </div>
      )}

      <Input
        label="Account Name"
        placeholder="e.g. Chase Checking"
        error={errors.name?.message}
        {...register('name')}
      />

      <Select
        label="Account Type"
        options={ACCOUNT_TYPES}
        placeholder="Select type…"
        error={errors.type?.message}
        {...register('type')}
      />

      <Input
        label="Opening Balance"
        type="number"
        step="0.01"
        placeholder="0.00"
        error={errors.balance?.message}
        hint="Enter current balance in dollars (e.g. 1234.56)"
        {...register('balance')}
      />

      <Input
        label="Currency"
        placeholder="USD"
        maxLength={3}
        error={errors.currency?.message}
        {...register('currency')}
      />

      <div className="flex justify-end gap-3 pt-2">
        <Button type="submit" loading={isSubmitting}>
          Add Account
        </Button>
      </div>
    </form>
  )
}
