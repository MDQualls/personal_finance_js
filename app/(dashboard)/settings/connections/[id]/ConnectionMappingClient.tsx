'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

const ACCOUNT_TYPES = [
  { value: 'CHECKING', label: 'Checking' },
  { value: 'SAVINGS', label: 'Savings' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'LOAN', label: 'Loan' },
  { value: 'INVESTMENT', label: 'Investment' },
  { value: 'ASSET', label: 'Asset' },
  { value: 'LIABILITY', label: 'Liability' },
]

const CREATE_NEW = '__create_new__'

type PlaidAccountRow = {
  id: string
  name: string
  mask: string | null
  type: string
  subtype: string | null
  accountId: string | null
  linkedAccountName: string | null
}

type AvailableAccount = { id: string; name: string; type: string }

interface ConnectionMappingClientProps {
  institutionName: string
  plaidAccounts: PlaidAccountRow[]
  availableAccounts: AvailableAccount[]
}

export function ConnectionMappingClient({
  institutionName,
  plaidAccounts,
  availableAccounts,
}: ConnectionMappingClientProps) {
  const router = useRouter()
  const [selection, setSelection] = useState<Record<string, string>>({})
  const [newName, setNewName] = useState<Record<string, string>>({})
  const [newType, setNewType] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function save(plaidAccountId: string) {
    const choice = selection[plaidAccountId]
    if (!choice) return

    setSavingId(plaidAccountId)
    setErrors((prev) => ({ ...prev, [plaidAccountId]: '' }))

    const body =
      choice === CREATE_NEW
        ? { name: newName[plaidAccountId] ?? '', type: newType[plaidAccountId] ?? 'CHECKING' }
        : { accountId: choice }

    const res = await fetch(`/api/plaid/accounts/${plaidAccountId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    setSavingId(null)

    if (!res.ok) {
      const resBody = await res.json()
      setErrors((prev) => ({
        ...prev,
        [plaidAccountId]: typeof resBody.error === 'string' ? resBody.error : 'Failed to link account',
      }))
      return
    }

    router.refresh()
  }

  return (
    <div className="max-w-2xl space-y-4">
      <Link
        href="/settings/connections"
        className="inline-flex items-center gap-1 text-[13px] text-[#6b7a8d] hover:text-[#00b89c]"
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        Back to Connections
      </Link>

      <Card padding={false}>
        <div className="px-5 py-4 border-b border-[#e8ecf0]">
          <CardHeader title={institutionName} subtitle="Map each Plaid account to a local account" />
        </div>

        <div className="divide-y divide-[#e8ecf0]">
          {plaidAccounts.map((pa) => (
            <div key={pa.id} className="px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[14px] font-medium font-heading text-[#1a2332]">
                  {pa.name} {pa.mask ? `••${pa.mask}` : ''}
                </p>
                <span className="text-[12px] text-[#6b7a8d]">{pa.subtype ?? pa.type}</span>
              </div>

              {pa.accountId ? (
                <div className="flex items-center gap-2 text-[13px] text-[#00b89c]">
                  <Check size={14} strokeWidth={1.5} />
                  Linked to {pa.linkedAccountName}
                </div>
              ) : (
                <div className="space-y-2">
                  <Select
                    options={[
                      { value: '', label: 'Choose an account…' },
                      ...availableAccounts.map((a) => ({ value: a.id, label: a.name })),
                      { value: CREATE_NEW, label: '+ Create new account' },
                    ]}
                    value={selection[pa.id] ?? ''}
                    onChange={(e) => setSelection((prev) => ({ ...prev, [pa.id]: e.target.value }))}
                  />

                  {selection[pa.id] === CREATE_NEW && (
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Account name"
                        value={newName[pa.id] ?? ''}
                        onChange={(e) => setNewName((prev) => ({ ...prev, [pa.id]: e.target.value }))}
                      />
                      <Select
                        options={ACCOUNT_TYPES}
                        value={newType[pa.id] ?? 'CHECKING'}
                        onChange={(e) => setNewType((prev) => ({ ...prev, [pa.id]: e.target.value }))}
                      />
                    </div>
                  )}

                  {errors[pa.id] && <p className="text-[12px] text-[#ef4444]">{errors[pa.id]}</p>}

                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => save(pa.id)}
                      loading={savingId === pa.id}
                      disabled={!selection[pa.id] || (selection[pa.id] === CREATE_NEW && !newName[pa.id])}
                    >
                      Link Account
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
