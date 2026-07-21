'use client'

import { useState, useEffect } from 'react'
import { ArrowLeftRight, X } from 'lucide-react'
import { formatCurrency } from '@/lib/money'
import { formatDisplay } from '@/lib/dates'
import type { TransferCandidate } from '@/types'

interface Props {
  onTransferConfirmed?: () => void
}

export function TransferSuggestionsPanel({ onTransferConfirmed }: Props) {
  const [candidates, setCandidates] = useState<TransferCandidate[]>([])
  const [dismissed, setDismissed] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/transfers/candidates')
      .then((r) => r.json())
      .then((body) => { if (body.data) setCandidates(body.data) })
      .catch(() => {})
  }, [])

  if (dismissed || candidates.length === 0) return null

  function removeCandidate(fromId: string) {
    setCandidates((prev) => prev.filter((c) => c.fromTransaction.id !== fromId))
  }

  async function dismissCandidate(candidate: TransferCandidate) {
    removeCandidate(candidate.fromTransaction.id)
    try {
      await fetch('/api/transfers/candidates/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromTransactionId: candidate.fromTransaction.id,
          toTransactionId: candidate.toTransaction.id,
        }),
      })
    } catch {
      // best-effort — worst case the candidate reappears on next load
    }
  }

  async function confirmTransfer(candidate: TransferCandidate) {
    const key = candidate.fromTransaction.id
    setConfirming(key)
    try {
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromTransactionId: candidate.fromTransaction.id,
          toTransactionId: candidate.toTransaction.id,
        }),
      })
      if (res.ok) {
        removeCandidate(key)
        onTransferConfirmed?.()
      }
    } finally {
      setConfirming(null)
    }
  }

  return (
    <div className="bg-white rounded-[12px] border border-[#e8ecf0] shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowLeftRight size={16} strokeWidth={1.5} className="text-[#00b89c]" />
          <span className="text-[14px] font-semibold font-heading text-[#1a2332]">
            {candidates.length} possible transfer{candidates.length !== 1 ? 's' : ''} found
          </span>
          <span className="text-[12px] text-[#6b7a8d]">— review and confirm</span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="h-7 w-7 flex items-center justify-center rounded-[6px] text-[#6b7a8d] hover:text-[#1a2332] hover:bg-[#f4f6f9] transition-colors"
          title="Dismiss"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>

      <div className="space-y-2">
        {candidates.map((candidate) => (
          <div
            key={candidate.fromTransaction.id}
            className="flex items-center gap-3 p-3 rounded-[8px] bg-[#f4f6f9]"
          >
            {/* From transaction */}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-[#6b7a8d] mb-0.5">{candidate.fromTransaction.account?.name ?? 'Account'}</p>
              <p className="text-[13px] font-medium text-[#1a2332] truncate">{candidate.fromTransaction.description}</p>
              <p className="text-[12px] text-[#6b7a8d]">{formatDisplay(candidate.fromTransaction.date)}</p>
              <p className="text-[13px] font-semibold font-tabular text-[#1a2332]">
                {formatCurrency(candidate.fromTransaction.amount)}
              </p>
            </div>

            <ArrowLeftRight size={16} strokeWidth={1.5} className="text-[#6b7a8d] flex-shrink-0" />

            {/* To transaction */}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-[#6b7a8d] mb-0.5">{candidate.toTransaction.account?.name ?? 'Account'}</p>
              <p className="text-[13px] font-medium text-[#1a2332] truncate">{candidate.toTransaction.description}</p>
              <p className="text-[12px] text-[#6b7a8d]">{formatDisplay(candidate.toTransaction.date)}</p>
              <p className="text-[13px] font-semibold font-tabular text-[#22c55e]">
                +{formatCurrency(candidate.toTransaction.amount)}
              </p>
            </div>

            {/* Confidence + actions */}
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  candidate.confidence === 'high'
                    ? 'bg-[#e6f7f5] text-[#00b89c]'
                    : 'bg-[#fef9ec] text-[#d97706]'
                }`}
              >
                {candidate.confidence === 'high' ? 'High' : 'Likely'}
              </span>
              <p className="text-[11px] text-[#6b7a8d] text-right max-w-[140px]">{candidate.reason}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <button
                  onClick={() => confirmTransfer(candidate)}
                  disabled={confirming === candidate.fromTransaction.id}
                  className="h-7 px-3 rounded-[6px] text-[12px] font-medium bg-[#00b89c] text-white hover:bg-[#009e87] transition-colors disabled:opacity-50 disabled:cursor-wait"
                >
                  Confirm
                </button>
                <button
                  onClick={() => dismissCandidate(candidate)}
                  className="h-7 px-3 rounded-[6px] text-[12px] font-medium text-[#6b7a8d] hover:text-[#1a2332] hover:bg-white transition-colors"
                >
                  Not a Transfer
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
