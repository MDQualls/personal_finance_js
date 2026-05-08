'use client'

import { useState } from 'react'
import { Plus, CreditCard, Pencil, Archive, RotateCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { AccountForm } from '@/components/forms/AccountForm'
import { formatCurrency } from '@/lib/money'

type Account = {
  id: string
  name: string
  type: string
  balance: number
  currency: string
  isActive: boolean
}

interface AccountsClientProps {
  accounts: Account[]
  netWorth: number
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHECKING: 'Checking',
  SAVINGS: 'Savings',
  CREDIT_CARD: 'Credit Card',
  LOAN: 'Loan',
  INVESTMENT: 'Investment',
  ASSET: 'Asset',
  LIABILITY: 'Liability',
}

const ACCOUNT_TYPE_ORDER = [
  'CHECKING', 'SAVINGS', 'INVESTMENT', 'CREDIT_CARD', 'LOAN', 'ASSET', 'LIABILITY',
]

function getAccountTypeColor(type: string): string {
  const map: Record<string, string> = {
    CHECKING: '#3b82f6',
    SAVINGS: '#22c55e',
    CREDIT_CARD: '#ef4444',
    LOAN: '#f59e0b',
    INVESTMENT: '#8b5cf6',
    ASSET: '#00b89c',
    LIABILITY: '#6b7a8d',
  }
  return map[type] ?? '#6b7a8d'
}

export function AccountsClient({ accounts, netWorth }: AccountsClientProps) {
  const router = useRouter()
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const activeAccounts = accounts.filter((a) => a.isActive)
  const archivedAccounts = accounts.filter((a) => !a.isActive)

  const groupMap: Record<string, Account[]> = {}
  for (const account of activeAccounts) {
    if (!groupMap[account.type]) groupMap[account.type] = []
    groupMap[account.type].push(account)
  }
  const groups = ACCOUNT_TYPE_ORDER
    .filter((type) => groupMap[type]?.length)
    .map((type) => ({ type, label: ACCOUNT_TYPE_LABELS[type] ?? type, accounts: groupMap[type] }))

  async function handleArchive(account: Account) {
    if (!confirm(`Archive "${account.name}"? It will be hidden from projections and reports.`)) return
    await fetch(`/api/accounts/${account.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    })
    router.refresh()
  }

  async function handleRestore(account: Account) {
    await fetch(`/api/accounts/${account.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: true }),
    })
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Net worth banner */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium font-heading text-[#6b7a8d]">Net Worth</p>
            <p
              className={`text-[28px] font-semibold font-tabular mt-0.5 ${
                netWorth >= 0 ? 'text-[#1a2332]' : 'text-[#ef4444]'
              }`}
            >
              {formatCurrency(netWorth)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {archivedAccounts.length > 0 && (
              <Button variant="secondary" onClick={() => setShowArchived(!showArchived)}>
                {showArchived ? 'Hide Archived' : `Show Archived (${archivedAccounts.length})`}
              </Button>
            )}
            <Button onClick={() => setShowAdd(true)}>
              <Plus size={16} strokeWidth={1.5} />
              Add Account
            </Button>
          </div>
        </div>
      </Card>

      {/* Active account groups */}
      {activeAccounts.length === 0 ? (
        <Card>
          <EmptyState
            icon={CreditCard}
            title="No accounts yet"
            description="Add your checking, savings, or credit card accounts to get started."
            action={{ label: 'Add Account', onClick: () => setShowAdd(true) }}
          />
        </Card>
      ) : (
        groups.map(({ type, label, accounts: groupAccounts }) => (
          <Card key={type} padding={false}>
            <div className="px-5 py-4 border-b border-[#e8ecf0]">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getAccountTypeColor(type) }}
                />
                <h3 className="text-[13px] font-semibold font-heading text-[#1a2332]">{label}</h3>
                <Badge>{groupAccounts.length}</Badge>
              </div>
            </div>
            <div className="divide-y divide-[#e8ecf0]">
              {groupAccounts.map((account) => (
                <div key={account.id} className="group flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-[14px] font-medium text-[#1a2332]">{account.name}</p>
                    <p className="text-[12px] text-[#6b7a8d] mt-0.5">{account.currency}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditing(account)}
                        className="h-7 w-7 flex items-center justify-center rounded-[6px] text-[#6b7a8d] hover:text-[#1a2332] hover:bg-[#f4f6f9] transition-colors"
                        title="Edit"
                      >
                        <Pencil size={13} strokeWidth={1.5} />
                      </button>
                      <button
                        onClick={() => handleArchive(account)}
                        className="h-7 w-7 flex items-center justify-center rounded-[6px] text-[#6b7a8d] hover:text-[#f59e0b] hover:bg-[#fef9ec] transition-colors"
                        title="Archive"
                      >
                        <Archive size={13} strokeWidth={1.5} />
                      </button>
                    </div>
                    <p
                      className={`text-[16px] font-semibold font-tabular ${
                        account.balance < 0 ? 'text-[#ef4444]' : 'text-[#1a2332]'
                      }`}
                    >
                      {formatCurrency(account.balance, account.currency)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}

      {/* Archived accounts */}
      {showArchived && archivedAccounts.length > 0 && (
        <Card padding={false}>
          <div className="px-5 py-4 border-b border-[#e8ecf0]">
            <h3 className="text-[13px] font-semibold font-heading text-[#6b7a8d]">Archived Accounts</h3>
          </div>
          <div className="divide-y divide-[#e8ecf0]">
            {archivedAccounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-[14px] font-medium text-[#6b7a8d]">{account.name}</p>
                  <p className="text-[12px] text-[#b0bac6] mt-0.5">
                    {ACCOUNT_TYPE_LABELS[account.type] ?? account.type} · {account.currency}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleRestore(account)}
                    className="flex items-center gap-1.5 text-[12px] text-[#00b89c] hover:underline"
                  >
                    <RotateCcw size={12} strokeWidth={1.5} />
                    Restore
                  </button>
                  <p className="text-[14px] font-semibold font-tabular text-[#b0bac6]">
                    {formatCurrency(account.balance, account.currency)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Add modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Account">
        <AccountForm onSuccess={() => { setShowAdd(false); router.refresh() }} />
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Account">
        {editing && (
          <AccountForm
            initialValues={editing}
            onSuccess={() => { setEditing(null); router.refresh() }}
          />
        )}
      </Modal>
    </div>
  )
}
