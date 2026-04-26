'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Upload, Search, Filter, ArrowLeftRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { TransactionRow } from '@/components/ui/TransactionRow'
import { TransactionForm } from '@/components/forms/TransactionForm'
import type { Transaction, Account, Category, Tag } from '@/types'

interface Props {
  accounts: Account[]
  categories: (Category & { children: Category[] })[]
  tags: Tag[]
}

export function TransactionsClient({ accounts, categories, tags }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [accountFilter, setAccountFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (search) params.set('search', search)
      if (accountFilter) params.set('accountId', accountFilter)
      if (categoryFilter) params.set('categoryId', categoryFilter)

      const res = await fetch(`/api/transactions?${params}`)
      const body = await res.json()
      if (res.ok) {
        setTransactions(body.data)
        setTotal(body.meta.total)
      }
    } finally {
      setLoading(false)
    }
  }, [page, search, accountFilter, categoryFilter])

  useEffect(() => { fetchTransactions() }, [fetchTransactions])

  async function handleDelete(id: string) {
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
    fetchTransactions()
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative">
            <Search size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7a8d]" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search transactions…"
              className="h-[36px] pl-8 pr-3 rounded-[8px] border border-[#e8ecf0] text-[13px] text-[#1a2332] placeholder:text-[#b0bac6] outline-none focus:border-[#00b89c] focus:ring-1 focus:ring-[#00b89c] w-[240px] transition-colors"
            />
          </div>

          <select
            value={accountFilter}
            onChange={(e) => { setAccountFilter(e.target.value); setPage(1) }}
            className="h-[36px] px-3 rounded-[8px] border border-[#e8ecf0] text-[13px] text-[#1a2332] bg-white outline-none focus:border-[#00b89c] cursor-pointer"
          >
            <option value="">All Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
            className="h-[36px] px-3 rounded-[8px] border border-[#e8ecf0] text-[13px] text-[#1a2332] bg-white outline-none focus:border-[#00b89c] cursor-pointer"
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

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => window.location.href = '/transactions/import'}>
            <Upload size={14} strokeWidth={1.5} />
            Import CSV
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus size={14} strokeWidth={1.5} />
            Add Transaction
          </Button>
        </div>
      </div>

      {/* Count */}
      {!loading && (
        <p className="text-[12px] text-[#6b7a8d]">
          {total.toLocaleString()} transaction{total !== 1 ? 's' : ''}
        </p>
      )}

      {/* List */}
      <Card padding={false}>
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="No transactions found"
            description="Add your first transaction or import from CSV."
            action={{ label: 'Add Transaction', onClick: () => setShowAdd(true) }}
          />
        ) : (
          <div className="divide-y divide-[#e8ecf0]">
            {transactions.map((tx) => (
              <TransactionRow key={tx.id} transaction={tx} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </Card>

      {/* Pagination */}
      {total > 50 && (
        <div className="flex justify-center gap-2">
          <Button variant="ghost" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <span className="text-[13px] text-[#6b7a8d] self-center">Page {page}</span>
          <Button variant="ghost" size="sm" disabled={transactions.length < 50} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Transaction">
        <TransactionForm
          accounts={accounts}
          categories={categories}
          onSuccess={() => { setShowAdd(false); fetchTransactions() }}
        />
      </Modal>
    </div>
  )
}
