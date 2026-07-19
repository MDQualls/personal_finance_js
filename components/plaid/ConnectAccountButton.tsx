'use client'

import { useEffect, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { Button } from '@/components/ui/Button'

type ConnectAccountButtonProps =
  | { mode?: 'connect'; onConnected: (plaidItemId: string) => void }
  | { mode: 'reconnect'; plaidItemId: string; onReconnected: () => void }

export function ConnectAccountButton(props: ConnectAccountButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (publicToken, metadata) => {
      setLoading(true)
      setError('')

      if (props.mode === 'reconnect') {
        // Update mode: the item's access_token is unchanged, so there's nothing to exchange —
        // just clear the ERROR status that the sync route set when it hit ITEM_LOGIN_REQUIRED.
        const res = await fetch(`/api/plaid/items/${props.plaidItemId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'ACTIVE' }),
        })

        setLoading(false)
        setLinkToken(null)

        if (!res.ok) {
          setError('Failed to reconnect account')
          return
        }

        props.onReconnected()
        return
      }

      const res = await fetch('/api/plaid/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicToken,
          institutionId: metadata.institution?.institution_id ?? '',
          institutionName: metadata.institution?.name ?? 'Unknown Institution',
          accounts: metadata.accounts.map((a) => ({
            id: a.id,
            name: a.name,
            mask: a.mask || null,
            type: a.type,
            subtype: a.subtype || null,
          })),
        }),
      })

      setLoading(false)
      setLinkToken(null)

      if (!res.ok) {
        setError('Failed to connect account')
        return
      }

      const body = await res.json()
      props.onConnected(body.data.plaidItemId)
    },
    onExit: () => {
      setLinkToken(null)
      setLoading(false)
    },
  })

  // Open automatically once the widget has finished loading, right after a token is fetched —
  // avoids a double-click flow (fetch token, then a second click to open).
  useEffect(() => {
    if (linkToken && ready) open()
  }, [linkToken, ready, open])

  async function startLink() {
    setLoading(true)
    setError('')

    const res = await fetch('/api/plaid/link-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(props.mode === 'reconnect' ? { plaidItemId: props.plaidItemId } : {}),
    })
    if (!res.ok) {
      setLoading(false)
      setError('Failed to start connection')
      return
    }

    const body = await res.json()
    setLinkToken(body.data.linkToken)
  }

  return (
    <div>
      {props.mode === 'reconnect' ? (
        <Button size="sm" onClick={startLink} loading={loading}>
          Reconnect
        </Button>
      ) : (
        <Button onClick={startLink} loading={loading}>
          Connect Bank Account
        </Button>
      )}
      {error && <p className="text-[13px] text-[#ef4444] mt-2">{error}</p>}
    </div>
  )
}
