import { detectTransferCandidates } from './transferDetection'
import { mockTransaction } from '@/__tests__/factories/transaction'

const DATE = '2026-07-01T00:00:00Z'
const DATE_PLUS_3 = '2026-07-04T00:00:00Z'
const DATE_PLUS_6 = '2026-07-07T00:00:00Z'

describe('detectTransferCandidates', () => {
  it('detects high-confidence pair: same day, equal/opposite amounts, different accounts', () => {
    const from = mockTransaction({ accountId: 'account_a', amount: -50000, date: new Date(DATE) })
    const to = mockTransaction({ accountId: 'account_b', amount: 50000, date: new Date(DATE) })

    const result = detectTransferCandidates([from, to])

    expect(result).toHaveLength(1)
    expect(result[0].confidence).toBe('high')
    expect(result[0].fromTransaction.id).toBe(from.id)
    expect(result[0].toTransaction.id).toBe(to.id)
  })

  it('detects medium-confidence pair: within window, matching amounts, different accounts', () => {
    const from = mockTransaction({ accountId: 'account_a', amount: -50000, date: new Date(DATE) })
    const to = mockTransaction({ accountId: 'account_b', amount: 50000, date: new Date(DATE_PLUS_3) })

    const result = detectTransferCandidates([from, to])

    expect(result).toHaveLength(1)
    expect(result[0].confidence).toBe('medium')
  })

  it('does not match transactions on the same account', () => {
    const from = mockTransaction({ accountId: 'account_a', amount: -50000, date: new Date(DATE) })
    const to = mockTransaction({ accountId: 'account_a', amount: 50000, date: new Date(DATE) })

    const result = detectTransferCandidates([from, to])

    expect(result).toHaveLength(0)
  })

  it('does not match already-linked transactions (isTransfer: true)', () => {
    const from = mockTransaction({ accountId: 'account_a', amount: -50000, date: new Date(DATE), isTransfer: true })
    const to = mockTransaction({ accountId: 'account_b', amount: 50000, date: new Date(DATE), isTransfer: true })

    const result = detectTransferCandidates([from, to])

    expect(result).toHaveLength(0)
  })

  it('does not match transactions outside the 5-day window', () => {
    const from = mockTransaction({ accountId: 'account_a', amount: -50000, date: new Date(DATE) })
    const to = mockTransaction({ accountId: 'account_b', amount: 50000, date: new Date(DATE_PLUS_6) })

    const result = detectTransferCandidates([from, to])

    expect(result).toHaveLength(0)
  })

  it('sorts high confidence before medium', () => {
    const highFrom = mockTransaction({ accountId: 'account_a', amount: -10000, date: new Date(DATE) })
    const highTo = mockTransaction({ accountId: 'account_b', amount: 10000, date: new Date(DATE) })
    const medFrom = mockTransaction({ accountId: 'account_c', amount: -20000, date: new Date(DATE) })
    const medTo = mockTransaction({ accountId: 'account_d', amount: 20000, date: new Date(DATE_PLUS_3) })

    const result = detectTransferCandidates([medFrom, medTo, highFrom, highTo])

    expect(result).toHaveLength(2)
    expect(result[0].confidence).toBe('high')
    expect(result[1].confidence).toBe('medium')
  })

  it('returns empty array when no candidates exist', () => {
    const a = mockTransaction({ accountId: 'account_a', amount: -50000, date: new Date(DATE) })
    const b = mockTransaction({ accountId: 'account_b', amount: -30000, date: new Date(DATE) })

    const result = detectTransferCandidates([a, b])

    expect(result).toHaveLength(0)
  })

  it('treats transactions with Transfers category as high confidence', () => {
    const from = mockTransaction({
      accountId: 'account_a',
      amount: -50000,
      date: new Date(DATE_PLUS_3),
      categoryId: 'system_transfers',
    })
    const to = mockTransaction({
      accountId: 'account_b',
      amount: 50000,
      date: new Date(DATE),
      categoryId: 'system_transfers',
    })

    const result = detectTransferCandidates([from, to])

    expect(result).toHaveLength(1)
    expect(result[0].confidence).toBe('high')
  })

  it('requires exactly equal absolute amounts — no fuzzy matching', () => {
    const from = mockTransaction({ accountId: 'account_a', amount: -50000, date: new Date(DATE) })
    const to = mockTransaction({ accountId: 'account_b', amount: 50001, date: new Date(DATE) })

    const result = detectTransferCandidates([from, to])

    expect(result).toHaveLength(0)
  })
})
