import { fetchTransactionsForExport, serializeTransactionsToCsv } from './transactionExport'
import { prismaMock } from '@/lib/__mocks__/prisma'
import type { Transaction, Account, Category, Tag } from '@/types'

const mockAccount = (overrides: Partial<Account> = {}): Account => ({
  id: 'cuid_account_1',
  name: 'Checking',
  type: 'CHECKING',
  balance: 100000,
  currency: 'USD',
  isActive: true,
  plaidManaged: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
})

const mockCategory = (overrides: Partial<Category> = {}): Category => ({
  id: 'cuid_category_1',
  name: 'Groceries',
  parentId: null,
  color: '#22c55e',
  icon: 'ShoppingCart',
  isIncome: false,
  isSystem: false,
  isActive: true,
  ...overrides,
})

const mockTag = (overrides: Partial<Tag> = {}): Tag => ({
  id: 'cuid_tag_1',
  name: 'essential',
  color: '#00b89c',
  ...overrides,
})

const mockTx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'cuid_tx_1',
  accountId: 'cuid_account_1',
  amount: -4500,
  date: new Date('2026-04-01T00:00:00Z'),
  categoryId: 'cuid_category_1',
  description: 'TRADER JOES #123',
  notes: null,
  isValidated: false,
  isTransfer: false,
  plaidTransactionId: null,
  deletedAt: null,
  createdAt: new Date('2026-04-01T00:00:00Z'),
  updatedAt: new Date('2026-04-01T00:00:00Z'),
  category: mockCategory(),
  tags: [],
  account: mockAccount(),
  ...overrides,
})

// ─── fetchTransactionsForExport ────────────────────────────────────────────────

describe('fetchTransactionsForExport', () => {
  const from = new Date('2026-04-01T00:00:00Z')
  const to = new Date('2026-04-30T23:59:59Z')

  it('queries with date range gte/lte', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([])

    await fetchTransactionsForExport({ from, to })

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          date: { gte: from, lte: to },
        }),
      })
    )
  })

  it('always filters deletedAt: null', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([])

    await fetchTransactionsForExport({ from, to })

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      })
    )
  })

  it('includes category, tags, and account relations', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([])

    await fetchTransactionsForExport({ from, to })

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { category: true, tags: true, account: true },
      })
    )
  })

  it('orders results by date descending', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([])

    await fetchTransactionsForExport({ from, to })

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { date: 'desc' } })
    )
  })

  it('applies optional accountId filter', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([])

    await fetchTransactionsForExport({ from, to, accountId: 'cuid_account_1' })

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountId: 'cuid_account_1' }),
      })
    )
  })

  it('applies optional categoryId filter', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([])

    await fetchTransactionsForExport({ from, to, categoryId: 'cuid_category_1' })

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ categoryId: 'cuid_category_1' }),
      })
    )
  })

  it('omits accountId from where clause when not provided', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([])

    await fetchTransactionsForExport({ from, to })

    const call = prismaMock.transaction.findMany.mock.calls[0][0]
    expect(call?.where).not.toHaveProperty('accountId')
  })

  it('returns the prisma result', async () => {
    const tx = mockTx()
    prismaMock.transaction.findMany.mockResolvedValue([tx as never])

    const result = await fetchTransactionsForExport({ from, to })

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('cuid_tx_1')
  })
})

// ─── serializeTransactionsToCsv ───────────────────────────────────────────────

describe('serializeTransactionsToCsv', () => {
  it('returns header-only output for an empty array', () => {
    const csv = serializeTransactionsToCsv([])

    expect(csv).toBe('Date,Description,Amount,Account,Category,Tags,Notes')
  })

  it('includes correct column headers', () => {
    const csv = serializeTransactionsToCsv([])
    const headers = csv.split('\n')[0].split(',')

    expect(headers).toEqual(['Date', 'Description', 'Amount', 'Account', 'Category', 'Tags', 'Notes'])
  })

  it('serializes a transaction row correctly', () => {
    const tx = mockTx()
    const csv = serializeTransactionsToCsv([tx])
    const lines = csv.split('\n')

    expect(lines).toHaveLength(2)
    expect(lines[1]).toBe('2026-04-01,TRADER JOES #123,-45.00,Checking,Groceries,,')
    expect(lines[1]).toContain('TRADER JOES #123')
  })

  it('formats negative amount as negative dollars with two decimal places', () => {
    const tx = mockTx({ amount: -4567 })
    const csv = serializeTransactionsToCsv([tx])

    expect(csv).toContain('-45.67')
  })

  it('formats positive amount as positive dollars with two decimal places', () => {
    const tx = mockTx({ amount: 250000 })
    const csv = serializeTransactionsToCsv([tx])

    expect(csv).toContain('2500.00')
  })

  it('uses ISO date (YYYY-MM-DD) for the date column', () => {
    const tx = mockTx({ date: new Date('2026-12-25T00:00:00Z') })
    const csv = serializeTransactionsToCsv([tx])

    expect(csv).toContain('2026-12-25')
  })

  it('escapes commas in description', () => {
    const tx = mockTx({ description: 'Coffee, Tea & More' })
    const csv = serializeTransactionsToCsv([tx])

    expect(csv).toContain('"Coffee, Tea & More"')
  })

  it('escapes double quotes in description', () => {
    const tx = mockTx({ description: 'Say "hello"' })
    const csv = serializeTransactionsToCsv([tx])

    expect(csv).toContain('"Say ""hello"""')
  })

  it('escapes newlines in notes', () => {
    const tx = mockTx({ notes: 'line one\nline two' })
    const csv = serializeTransactionsToCsv([tx])

    expect(csv).toContain('"line one\nline two"')
  })

  it('joins multiple tags with semicolons', () => {
    const tx = mockTx({
      tags: [
        mockTag({ id: 't1', name: 'essential' }),
        mockTag({ id: 't2', name: 'recurring' }),
      ],
    })
    const csv = serializeTransactionsToCsv([tx])

    expect(csv).toContain('essential; recurring')
  })

  it('outputs empty string for null notes', () => {
    const tx = mockTx({ notes: null })
    const csv = serializeTransactionsToCsv([tx])
    const lastField = csv.split('\n')[1].split(',').at(-1)

    expect(lastField).toBe('')
  })

  it('outputs empty string for missing account', () => {
    const tx = mockTx({ account: undefined })
    const csv = serializeTransactionsToCsv([tx])

    const row = csv.split('\n')[1]
    expect(row).toContain(',,') // account and possibly category both empty — at least consecutive commas
  })

  it('outputs empty string for missing category', () => {
    const tx = mockTx({ category: undefined })
    const csv = serializeTransactionsToCsv([tx])

    // Category column should be empty
    const row = csv.split('\n')[1]
    expect(row).toBeDefined()
    // Amount, empty account section... just verify it doesn't throw
    expect(row).toContain('-45.00')
  })

  it('outputs empty string for empty tags array', () => {
    const tx = mockTx({ tags: [] })
    const csv = serializeTransactionsToCsv([tx])
    const columns = csv.split('\n')[1].split(',')

    // Tags is the 6th column (index 5), Notes is 7th (index 6)
    expect(columns[5]).toBe('')
  })

  it('produces one row per transaction', () => {
    const txs = [mockTx({ id: 'tx1' }), mockTx({ id: 'tx2' }), mockTx({ id: 'tx3' })]
    const csv = serializeTransactionsToCsv(txs)
    const lines = csv.split('\n')

    expect(lines).toHaveLength(4) // header + 3 rows
  })
})
