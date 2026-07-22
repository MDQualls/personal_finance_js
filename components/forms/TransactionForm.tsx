'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { toCents, toDollars, formatCurrency } from '@/lib/money'
import { formatDisplay } from '@/lib/dates'
import type { Account, Category, Transaction } from '@/types'

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

type InitialValues = {
  id: string
  accountId: string
  amount: number
  date: Date
  categoryId: string
  description: string
  notes: string | null
  isTransfer?: boolean
}

interface TransactionFormProps {
  accounts: Account[]
  categories: (Category & { children: Category[] })[]
  initialValues?: InitialValues
  onSuccess?: () => void
}

export function TransactionForm({ accounts, categories, initialValues, onSuccess }: TransactionFormProps) {
  const isEditing = !!initialValues
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkCandidates, setLinkCandidates] = useState<Transaction[]>([])
  const [linking, setLinking] = useState(false)

  async function openLinkModal() {
    if (!initialValues) return
    // Fetch transactions that are equal/opposite amount, different account, not yet a transfer
    const baseDate = new Date(initialValues.date).getTime()
    const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000
    const params = new URLSearchParams({
      limit: '200',
      excludeTransfers: 'true',
      from: new Date(baseDate - FIVE_DAYS).toISOString(),
      to: new Date(baseDate + FIVE_DAYS).toISOString(),
    })
    const res = await fetch(`/api/transactions?${params}`)
    const body = await res.json()
    const all: Transaction[] = body.data ?? []
    const targetAmount = -initialValues.amount // opposite sign
    const compatible = all.filter(
      (tx) =>
        tx.id !== initialValues.id &&
        tx.accountId !== initialValues.accountId &&
        tx.amount === targetAmount &&
        Math.abs(new Date(tx.date).getTime() - baseDate) <= FIVE_DAYS
    )
    setLinkCandidates(compatible)
    setShowLinkModal(true)
  }

  async function handleLinkTransfer(toTx: Transaction) {
    if (!initialValues) return
    setLinking(true)
    try {
      const fromId = initialValues.amount < 0 ? initialValues.id : toTx.id
      const toId = initialValues.amount < 0 ? toTx.id : initialValues.id
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromTransactionId: fromId, toTransactionId: toId }),
      })
      if (res.ok) {
        setShowLinkModal(false)
        onSuccess?.()
      }
    } finally {
      setLinking(false)
    }
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues
      ? {
          accountId: initialValues.accountId,
          amount: toDollars(initialValues.amount).toFixed(2),
          date: new Date(initialValues.date).toISOString().slice(0, 10),
          categoryId: initialValues.categoryId,
          description: initialValues.description,
          notes: initialValues.notes ?? '',
        }
      : { date: new Date().toISOString().slice(0, 10) },
  })

  async function onSubmit(values: FormValues) {
    const payload = {
      accountId: values.accountId,
      amount: toCents(parseFloat(values.amount)),
      date: new Date(values.date).toISOString(),
      categoryId: values.categoryId,
      description: values.description,
      notes: values.notes || undefined,
    }

    const res = await fetch(
      isEditing ? `/api/transactions/${initialValues.id}` : '/api/transactions',
      {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )

    if (!res.ok) {
      setError('root', { message: `Failed to ${isEditing ? 'update' : 'save'} transaction.` })
      return
    }

    onSuccess?.()
  }

  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }))

  const categoryGroups = categories.map((cat) => ({
    label: cat.name,
    options: [
      { value: cat.id, label: cat.name },
      ...cat.children.map((sub) => ({ value: sub.id, label: `  ${sub.name}` })),
    ],
  }))

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
        groups={categoryGroups}
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

      <div className="flex items-center justify-between pt-2">
        {isEditing && !initialValues?.isTransfer && (
          <button
            type="button"
            onClick={openLinkModal}
            className="flex items-center gap-1.5 text-[13px] text-[#6b7a8d] hover:text-[#00b89c] transition-colors"
          >
            <ArrowLeftRight size={14} strokeWidth={1.5} />
            Link as Transfer
          </button>
        )}
        <div className="ml-auto">
          <Button type="submit" loading={isSubmitting}>
            {isEditing ? 'Save Changes' : 'Save Transaction'}
          </Button>
        </div>
      </div>

      <Modal open={showLinkModal} onClose={() => setShowLinkModal(false)} title="Link as Transfer">
        {linkCandidates.length === 0 ? (
          <p className="text-[14px] text-[#6b7a8d] py-4 text-center">
            No compatible transactions found within ±5 days on a different account.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-[13px] text-[#6b7a8d] mb-3">
              Select the matching transaction to link as a transfer pair.
            </p>
            {linkCandidates.map((tx) => (
              <button
                key={tx.id}
                onClick={() => handleLinkTransfer(tx)}
                disabled={linking}
                className="w-full flex items-center justify-between p-3 rounded-[8px] border border-[#e8ecf0] hover:border-[#00b89c] hover:bg-[#e6f7f5] transition-colors text-left disabled:opacity-50"
              >
                <div>
                  <p className="text-[13px] font-medium text-[#1a2332]">{tx.description}</p>
                  <p className="text-[12px] text-[#6b7a8d]">
                    {tx.account?.name} · {formatDisplay(tx.date)}
                  </p>
                </div>
                <span className="text-[13px] font-semibold font-tabular text-[#22c55e]">
                  +{formatCurrency(tx.amount)}
                </span>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </form>
  )
}
