'use client'

import { useState } from 'react'
import { Plus, CreditCard } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
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

type AccountGroup = {
  type: string
  label: string
  accounts: Account[]
}

interface AccountsClientProps {
  groups: AccountGroup[]
  netWorth: number
}

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

export function AccountsClient({ groups, netWorth }: AccountsClientProps) {
  const [showAdd, setShowAdd] = useState(false)

  const totalAccounts = groups.reduce((sum, g) => sum + g.accounts.length, 0)

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
          <Button onClick={() => setShowAdd(true)}>
            <Plus size={16} strokeWidth={1.5} />
            Add Account
          </Button>
        </div>
      </Card>

      {/* Account groups */}
      {totalAccounts === 0 ? (
        <Card>
          <EmptyState
            icon={CreditCard}
            title="No accounts yet"
            description="Add your checking, savings, or credit card accounts to get started."
            action={{ label: 'Add Account', onClick: () => setShowAdd(true) }}
          />
        </Card>
      ) : (
        groups.map(({ type, label, accounts }) => (
          <Card key={type} padding={false}>
            <div className="px-5 py-4 border-b border-[#e8ecf0]">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getAccountTypeColor(type) }}
                />
                <h3 className="text-[13px] font-semibold font-heading text-[#1a2332]">{label}</h3>
                <Badge>{accounts.length}</Badge>
              </div>
            </div>

            <div className="divide-y divide-[#e8ecf0]">
              {accounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-[14px] font-medium text-[#1a2332]">{account.name}</p>
                    <p className="text-[12px] text-[#6b7a8d] mt-0.5">{account.currency}</p>
                  </div>
                  <p
                    className={`text-[16px] font-semibold font-tabular ${
                      account.balance < 0 ? 'text-[#ef4444]' : 'text-[#1a2332]'
                    }`}
                  >
                    {formatCurrency(account.balance, account.currency)}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Account">
        <AccountForm onSuccess={() => { setShowAdd(false); window.location.reload() }} />
      </Modal>
    </div>
  )
}
