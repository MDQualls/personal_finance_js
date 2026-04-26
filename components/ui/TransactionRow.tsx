'use client'

import { useState } from 'react'
import { Trash2, Pencil, RotateCcw } from 'lucide-react'
import { formatCurrency } from '@/lib/money'
import { formatDisplay } from '@/lib/dates'
import type { Transaction } from '@/types'

interface TransactionRowProps {
  transaction: Transaction & {
    category?: { name: string; color: string; icon: string } | null
    tags?: { id: string; name: string; color: string }[]
  }
  onDelete?: (id: string) => void
  onEdit?: () => void
  onRestore?: (id: string) => void
}

export function TransactionRow({ transaction, onDelete, onEdit, onRestore }: TransactionRowProps) {
  const [deleting, setDeleting] = useState(false)
  const isPositive = transaction.amount > 0
  const isDeleted = !!transaction.deletedAt

  async function handleDelete() {
    if (!confirm('Delete this transaction?')) return
    setDeleting(true)
    await onDelete?.(transaction.id)
    setDeleting(false)
  }

  return (
    <div className={`group flex items-center justify-between px-5 py-3 hover:bg-[#f8fafc] transition-colors ${isDeleted ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div
          className="w-8 h-8 rounded-[8px] flex-shrink-0 flex items-center justify-center text-white text-[12px]"
          style={{ backgroundColor: transaction.category?.color ?? '#6b7a8d' }}
          title={transaction.category?.name}
        >
          {(transaction.category?.name ?? 'U')[0]}
        </div>

        <div className="min-w-0">
          <p className="text-[14px] font-medium text-[#1a2332] truncate">
            {transaction.description}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[12px] text-[#6b7a8d]">
              {formatDisplay(transaction.date)}
            </p>
            {transaction.category && (
              <span className="text-[12px] text-[#6b7a8d]">· {transaction.category.name}</span>
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
  )
}
