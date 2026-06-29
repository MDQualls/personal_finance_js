'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { Account, Category } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  accounts: Account[]
  categories: (Category & { children: Category[] })[]
}

function currentMonthRange() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  }
}

export function ExportTransactionsModal({ open, onClose, accounts, categories }: Props) {
  const defaults = currentMonthRange()
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleClose() {
    setError(null)
    onClose()
  }

  async function handleExport() {
    if (!from || !to) {
      setError('Please select both a start and end date.')
      return
    }
    if (new Date(from) > new Date(to)) {
      setError('Start date must be before end date.')
      return
    }

    setError(null)
    setExporting(true)

    try {
      const params = new URLSearchParams({ from, to })
      if (accountId) params.set('accountId', accountId)
      if (categoryId) params.set('categoryId', categoryId)

      const res = await fetch(`/api/transactions/export?${params}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError((body as { error?: string }).error ?? 'Export failed. Please try again.')
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `transactions-${from}-to-${to}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      handleClose()
    } catch {
      setError('Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Export Transactions">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-[13px] font-medium font-heading text-[#1a2332]">
              Start Date
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full h-[40px] px-3 rounded-[8px] border border-[#e8ecf0] text-[13px] text-[#1a2332] outline-none focus:border-[#00b89c] focus:ring-1 focus:ring-[#00b89c] transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[13px] font-medium font-heading text-[#1a2332]">
              End Date
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full h-[40px] px-3 rounded-[8px] border border-[#e8ecf0] text-[13px] text-[#1a2332] outline-none focus:border-[#00b89c] focus:ring-1 focus:ring-[#00b89c] transition-colors"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium font-heading text-[#1a2332]">
            Account <span className="text-[#6b7a8d] font-normal">(optional)</span>
          </label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full h-[40px] px-3 rounded-[8px] border border-[#e8ecf0] text-[13px] text-[#1a2332] bg-white outline-none focus:border-[#00b89c] cursor-pointer"
          >
            <option value="">All Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium font-heading text-[#1a2332]">
            Category <span className="text-[#6b7a8d] font-normal">(optional)</span>
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full h-[40px] px-3 rounded-[8px] border border-[#e8ecf0] text-[13px] text-[#1a2332] bg-white outline-none focus:border-[#00b89c] cursor-pointer"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <optgroup key={c.id} label={c.name}>
                <option value={c.id}>{c.name}</option>
                {c.children.map((sub) => (
                  <option key={sub.id} value={sub.id}>&nbsp;&nbsp;{sub.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {error && (
          <p className="text-[13px] text-[#ef4444]">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" size="sm" onClick={handleClose} disabled={exporting}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleExport} loading={exporting}>
            <Download size={14} strokeWidth={1.5} />
            Export CSV
          </Button>
        </div>
      </div>
    </Modal>
  )
}
