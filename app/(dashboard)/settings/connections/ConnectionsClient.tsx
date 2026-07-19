'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Landmark, RefreshCw, Unplug, Settings2 } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/money'
import { ConnectAccountButton } from '@/components/plaid/ConnectAccountButton'

type ConnectionStatus = 'ACTIVE' | 'ERROR' | 'DISCONNECTED'

type ConnectionAccount = {
  id: string
  name: string
  mask: string | null
  accountId: string | null
  account: { id: string; name: string; balance: number } | null
}

type Connection = {
  id: string
  institutionName: string
  lastSyncedAt: string | null
  status: ConnectionStatus
  accounts: ConnectionAccount[]
}

interface ConnectionsClientProps {
  items: Connection[]
}

const STATUS_BADGE: Record<ConnectionStatus, { variant: 'active' | 'over-budget' | 'cancelled'; label: string }> = {
  ACTIVE: { variant: 'active', label: 'Active' },
  ERROR: { variant: 'over-budget', label: 'Needs Attention' },
  DISCONNECTED: { variant: 'cancelled', label: 'Disconnected' },
}

export function ConnectionsClient({ items }: ConnectionsClientProps) {
  const router = useRouter()
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<Record<string, string>>({})
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function syncNow(plaidItemId: string) {
    setSyncingId(plaidItemId)
    setError('')

    const res = await fetch('/api/plaid/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plaidItemId }),
    })

    setSyncingId(null)

    if (!res.ok) {
      setError('Sync failed')
      return
    }

    const body = await res.json()
    setSyncResult((prev) => ({
      ...prev,
      [plaidItemId]: `Added ${body.data.added}, modified ${body.data.modified}, removed ${body.data.removed}`,
    }))
    router.refresh()
  }

  async function disconnect(plaidItemId: string) {
    if (
      !confirm(
        'Disconnect this institution? Transactions already imported will stay, but new ones will stop syncing.'
      )
    ) {
      return
    }

    setDisconnectingId(plaidItemId)
    setError('')

    const res = await fetch(`/api/plaid/items/${plaidItemId}`, { method: 'DELETE' })

    setDisconnectingId(null)

    if (!res.ok) {
      setError('Failed to disconnect')
      return
    }

    router.refresh()
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex justify-end">
        <ConnectAccountButton
          onConnected={(plaidItemId) => router.push(`/settings/connections/${plaidItemId}`)}
        />
      </div>

      {error && <p className="text-[13px] text-[#ef4444]">{error}</p>}

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={Landmark}
            title="No connected accounts"
            description="Connect a bank account with Plaid to automatically import transactions."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const unmapped = item.accounts.filter((a) => !a.accountId).length

            return (
              <Card key={item.id}>
                <CardHeader
                  title={item.institutionName}
                  subtitle={
                    item.lastSyncedAt
                      ? `Last synced ${new Date(item.lastSyncedAt).toLocaleString()}`
                      : 'Never synced'
                  }
                  action={
                    <Badge variant={STATUS_BADGE[item.status].variant}>
                      {STATUS_BADGE[item.status].label}
                    </Badge>
                  }
                />

                <div className="space-y-1.5 mb-4">
                  {item.accounts.map((a) => (
                    <div key={a.id} className="flex items-center justify-between text-[13px]">
                      <span className="text-[#1a2332]">
                        {a.name} {a.mask ? `••${a.mask}` : ''}
                      </span>
                      {a.account ? (
                        <span className="text-[#6b7a8d] tabular-nums">{formatCurrency(a.account.balance)}</span>
                      ) : (
                        <Badge variant="paused">Not linked</Badge>
                      )}
                    </div>
                  ))}
                </div>

                {syncResult[item.id] && (
                  <p className="text-[12px] text-[#6b7a8d] mb-3">{syncResult[item.id]}</p>
                )}

                <div className="flex items-center gap-2">
                  {item.status === 'ACTIVE' && (
                    <Button size="sm" onClick={() => syncNow(item.id)} loading={syncingId === item.id}>
                      <RefreshCw size={14} strokeWidth={1.5} />
                      Sync Now
                    </Button>
                  )}
                  <Link href={`/settings/connections/${item.id}`}>
                    <Button size="sm" variant="secondary">
                      <Settings2 size={14} strokeWidth={1.5} />
                      {unmapped > 0 ? `Map Accounts (${unmapped})` : 'Manage'}
                    </Button>
                  </Link>
                  {item.status !== 'DISCONNECTED' && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => disconnect(item.id)}
                      loading={disconnectingId === item.id}
                    >
                      <Unplug size={14} strokeWidth={1.5} />
                      Disconnect
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
