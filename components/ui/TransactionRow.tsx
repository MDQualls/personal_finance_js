'use client'

import { useState } from 'react'
import { Trash2, Pencil, RotateCcw, ArrowLeftRight, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { formatCurrency } from '@/lib/money'
import { formatDisplay } from '@/lib/dates'
import type { Transaction, Category } from '@/types'

interface TransactionRowProps {
  transaction: Transaction & {
    category?: { name: string; color: string; icon: string } | null
    tags?: { id: string; name: string; color: string }[]
    account?: { name: string } | null
  }
  onDelete?: (id: string) => void
  onEdit?: () => void
  onRestore?: (id: string) => void
  onValidate?: (id: string, isValidated: boolean) => Promise<void>
  onUnlink?: (id: string) => Promise<void>
  onApprove?: (id: string, categoryId: string) => Promise<void>
  reviewCategories?: (Category & { children: Category[] })[]
}

export function TransactionRow({
  transaction,
  onDelete,
  onEdit,
  onRestore,
  onValidate,
  onUnlink,
  onApprove,
  reviewCategories,
}: TransactionRowProps) {
  const [deleting, setDeleting] = useState(false)
  const [validating, setValidating] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [approving, setApproving] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [selectedCategoryId, setSelectedCategoryId] = useState(transaction.categoryId)
  const isPositive = transaction.amount > 0
  const isDeleted = !!transaction.deletedAt
  const isTransfer = transaction.isTransfer
  const isReview = !!onApprove && !!reviewCategories

  async function handleValidate(e: React.ChangeEvent<HTMLInputElement>) {
    if (!onValidate) return
    setValidating(true)
    await onValidate(transaction.id, e.target.checked)
    setValidating(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this transaction?')) return
    setDeleting(true)
    await onDelete?.(transaction.id)
    setDeleting(false)
  }

  async function handleUnlink() {
    if (!onUnlink) return
    setUnlinking(true)
    await onUnlink(transaction.id)
    setUnlinking(false)
  }

  async function handleApprove() {
    if (!onApprove) return
    setApproving(true)
    await onApprove(transaction.id, selectedCategoryId)
    setApproving(false)
  }

  return (
    <div className={isReview ? 'border-b border-[#e8ecf0] last:border-b-0' : undefined}>
    <div
      className={`group flex items-center justify-between px-5 py-3 transition-colors ${
        isTransfer
          ? 'opacity-60 hover:opacity-80'
          : transaction.isValidated
          ? 'bg-[#f0fdf9]'
          : 'hover:bg-[#f8fafc]'
      } ${isDeleted ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {isTransfer ? (
          <div
            className="w-8 h-8 rounded-[8px] flex-shrink-0 flex items-center justify-center bg-[#f4f6f9]"
            title="Transfer"
          >
            <ArrowLeftRight size={14} strokeWidth={1.5} className="text-[#6b7a8d]" />
          </div>
        ) : (
          <div
            className="w-8 h-8 rounded-[8px] flex-shrink-0 flex items-center justify-center text-white text-[12px]"
            style={{ backgroundColor: transaction.category?.color ?? '#6b7a8d' }}
            title={transaction.category?.name}
          >
            {(transaction.category?.name ?? 'U')[0]}
          </div>
        )}

        <div className="min-w-0">
          <p className="text-[14px] font-medium text-[#1a2332] truncate">
            {transaction.description}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[12px] text-[#6b7a8d]">
              {formatDisplay(transaction.date)}
            </p>
            {isTransfer ? (
              <span className="text-[12px] text-[#6b7a8d]">· Transfer</span>
            ) : (
              transaction.category && (
                <span className="text-[12px] text-[#6b7a8d]">· {transaction.category.name}</span>
              )
            )}
            {transaction.account && (
              <span className="text-[12px] text-[#6b7a8d]">· {transaction.account.name}</span>
            )}
            {isDeleted && transaction.deletedAt && (
              <span className="text-[11px] text-[#ef4444]">
                · Deleted {formatDisplay(transaction.deletedAt)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <p
          className={`text-[14px] font-semibold font-tabular ${
            isPositive ? 'text-[#22c55e]' : 'text-[#1a2332]'
          }`}
        >
          {isPositive ? '+' : ''}{formatCurrency(transaction.amount)}
        </p>

        {onValidate && !isDeleted && (
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={transaction.isValidated}
              onChange={handleValidate}
              disabled={validating}
              className="w-3.5 h-3.5 rounded accent-[#00b89c] cursor-pointer disabled:cursor-wait"
            />
            <span className="text-[12px] text-[#6b7a8d]">Validated</span>
          </label>
        )}

        {isReview && (
          <div className="flex items-center gap-2">
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="h-8 px-2 rounded-[6px] border border-[#e8ecf0] text-[12px] text-[#1a2332] bg-white outline-none focus:border-[#00b89c] cursor-pointer"
            >
              {reviewCategories!.map((c) => (
                <optgroup key={c.id} label={c.name}>
                  <option value={c.id}>{c.name}</option>
                  {c.children.map((sub) => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button
              onClick={handleApprove}
              disabled={approving}
              className="h-8 flex items-center gap-1.5 px-3 rounded-[6px] text-[12px] font-medium bg-[#00b89c] text-white hover:bg-[#009e87] transition-colors disabled:opacity-60 disabled:cursor-wait"
            >
              <Check size={13} strokeWidth={1.5} />
              Approve
            </button>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="h-8 w-8 flex items-center justify-center rounded-[6px] text-[#6b7a8d] hover:text-[#1a2332] hover:bg-[#f4f6f9] transition-colors"
              title={expanded ? 'Hide details' : 'Show details'}
            >
              {expanded ? <ChevronUp size={14} strokeWidth={1.5} /> : <ChevronDown size={14} strokeWidth={1.5} />}
            </button>
          </div>
        )}

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onRestore ? (
            <button
              onClick={() => onRestore(transaction.id)}
              className="h-7 flex items-center gap-1.5 px-2 rounded-[6px] text-[12px] font-medium text-[#00b89c] hover:bg-[#e6f7f5] transition-colors"
              title="Restore"
            >
              <RotateCcw size={13} strokeWidth={1.5} />
              Restore
            </button>
          ) : (
            <>
              {isTransfer && onUnlink && (
                <button
                  onClick={handleUnlink}
                  disabled={unlinking}
                  className="h-7 flex items-center gap-1.5 px-2 rounded-[6px] text-[12px] font-medium text-[#6b7a8d] hover:text-[#1a2332] hover:bg-[#f4f6f9] transition-colors disabled:cursor-wait"
                  title="Unlink transfer"
                >
                  <ArrowLeftRight size={13} strokeWidth={1.5} />
                  Unlink
                </button>
              )}
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="h-7 w-7 flex items-center justify-center rounded-[6px] text-[#6b7a8d] hover:text-[#1a2332] hover:bg-[#f4f6f9] transition-colors"
                  title="Edit"
                >
                  <Pencil size={14} strokeWidth={1.5} />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="h-7 w-7 flex items-center justify-center rounded-[6px] text-[#6b7a8d] hover:text-[#ef4444] hover:bg-[#fef2f2] transition-all"
                  title="Delete"
                >
                  <Trash2 size={14} strokeWidth={1.5} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>

    {isReview && expanded && (
      <div className="px-5 pb-3 -mt-1 space-y-1 bg-[#f8fafc] text-[12px] text-[#6b7a8d]">
        <p><span className="font-medium text-[#1a2332]">Account:</span> {transaction.account?.name ?? '—'}</p>
        <p><span className="font-medium text-[#1a2332]">Date:</span> {formatDisplay(transaction.date)}</p>
        <p><span className="font-medium text-[#1a2332]">Source:</span> {transaction.plaidTransactionId ? 'Plaid' : 'CSV Import'}</p>
        {transaction.notes && (
          <p><span className="font-medium text-[#1a2332]">Notes:</span> {transaction.notes}</p>
        )}
      </div>
    )}
    </div>
  )
}
