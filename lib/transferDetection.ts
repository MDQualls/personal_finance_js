import { differenceInCalendarDays } from 'date-fns'
import type { Transaction, TransferCandidate } from '@/types'

const TRANSFER_WINDOW_DAYS = 5
const TRANSFER_KEYWORDS = ['TRANSFER', 'ZELLE', 'ACH', 'PAYMENT', 'DEPOSIT', 'SAVINGS']
const SYSTEM_TRANSFERS_CATEGORY_ID = 'system_transfers'

function hasTransferKeyword(description: string): boolean {
  const upper = description.toUpperCase()
  return TRANSFER_KEYWORDS.some((kw) => upper.includes(kw))
}

function isTransferCategory(tx: Transaction): boolean {
  return tx.categoryId === SYSTEM_TRANSFERS_CATEGORY_ID
}

export function detectTransferCandidates(transactions: Transaction[]): TransferCandidate[] {
  const unlinked = transactions.filter((tx) => !tx.isTransfer && !tx.deletedAt)
  const candidates: TransferCandidate[] = []
  const used = new Set<string>()

  for (let i = 0; i < unlinked.length; i++) {
    const a = unlinked[i]
    if (used.has(a.id)) continue

    for (let j = i + 1; j < unlinked.length; j++) {
      const b = unlinked[j]
      if (used.has(b.id)) continue

      // Must be different accounts
      if (a.accountId === b.accountId) continue

      // Amounts must be equal and opposite
      if (a.amount + b.amount !== 0) continue

      const daysDiff = Math.abs(differenceInCalendarDays(new Date(a.date), new Date(b.date)))

      // Ensure from = negative (outgoing), to = positive (incoming)
      const from = a.amount < 0 ? a : b
      const to = a.amount > 0 ? a : b

      const isSameDay = daysDiff === 0
      const withinWindow = daysDiff <= TRANSFER_WINDOW_DAYS
      const fromHasKeyword = hasTransferKeyword(from.description)
      const toHasKeyword = hasTransferKeyword(to.description)
      const fromIsTransferCat = isTransferCategory(from)
      const toIsTransferCat = isTransferCategory(to)

      let confidence: 'high' | 'medium' | null = null
      let reason = ''

      if (fromIsTransferCat || toIsTransferCat) {
        // Transfers category always high confidence within window
        if (withinWindow) {
          confidence = 'high'
          reason = isSameDay
            ? 'Same day, equal/opposite amounts, categorized as Transfers'
            : `Within ${daysDiff} day${daysDiff === 1 ? '' : 's'}, equal/opposite amounts, categorized as Transfers`
        }
      } else if (isSameDay && (fromHasKeyword || toHasKeyword)) {
        confidence = 'high'
        reason = 'Same day, equal/opposite amounts, transfer keyword in description'
      } else if (isSameDay) {
        confidence = 'high'
        reason = 'Same day, equal/opposite amounts, different accounts'
      } else if (withinWindow) {
        confidence = 'medium'
        reason = `Within ${daysDiff} day${daysDiff === 1 ? '' : 's'}, equal/opposite amounts, different accounts`
      }

      if (confidence) {
        candidates.push({ confidence, fromTransaction: from, toTransaction: to, reason })
        used.add(a.id)
        used.add(b.id)
        break
      }
    }
  }

  // Sort: high confidence first, then by date descending
  return candidates.sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return a.confidence === 'high' ? -1 : 1
    }
    return new Date(b.fromTransaction.date).getTime() - new Date(a.fromTransaction.date).getTime()
  })
}
