import { POST } from './route'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { mockSession, noSession } from '@/lib/__mocks__/auth'
import { plaidClient } from '@/lib/plaid'
import { decryptToken } from '@/lib/crypto'
import { mockPlaidItem } from '@/__tests__/factories/plaidItem'
import { mockPlaidAccount } from '@/__tests__/factories/plaidAccount'
import { mockCategory } from '@/__tests__/factories/category'

jest.mock('@/lib/plaid', () => ({
  plaidClient: {
    transactionsSync: jest.fn(),
    accountsBalanceGet: jest.fn(),
  },
}))

jest.mock('@/lib/crypto', () => ({
  decryptToken: jest.fn((stored: string) => stored.replace('encrypted:', '')),
}))

const ITEM_ID = 'cuid_plaid_item_1'

function makeRequest(plaidItemId: unknown) {
  return new Request('http://localhost/api/plaid/sync', {
    method: 'POST',
    body: JSON.stringify({ plaidItemId }),
  })
}

function emptySyncPage(overrides: Partial<{ added: unknown[]; modified: unknown[]; removed: unknown[]; has_more: boolean; next_cursor: string }> = {}) {
  return {
    data: {
      added: [],
      modified: [],
      removed: [],
      has_more: false,
      next_cursor: 'cursor-1',
      ...overrides,
    },
  }
}

beforeEach(() => {
  ;(plaidClient.accountsBalanceGet as jest.Mock).mockResolvedValue({
    data: { accounts: [{ balances: { current: null } }] },
  })
  prismaMock.merchantRule.findMany.mockResolvedValue([])
  prismaMock.plaidItem.update.mockResolvedValue(mockPlaidItem({ id: ITEM_ID }) as never)
})

describe('POST /api/plaid/sync', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()

    const res = await POST(makeRequest('cuid_plaid_item_1') as never)

    expect(res.status).toBe(401)
  })

  it('rejects a non-cuid plaidItemId', async () => {
    mockSession()

    const res = await POST(makeRequest('not-a-cuid') as never)

    expect(res.status).toBe(400)
  })

  it('returns 404 when the item does not exist', async () => {
    mockSession()
    prismaMock.plaidItem.findUnique.mockResolvedValue(null)

    const res = await POST(makeRequest(ITEM_ID) as never)

    expect(res.status).toBe(404)
  })

  it('returns 410 when the item has already been disconnected', async () => {
    mockSession()
    prismaMock.plaidItem.findUnique.mockResolvedValue(
      { ...mockPlaidItem({ id: ITEM_ID, accessToken: null }), accounts: [] } as never
    )

    const res = await POST(makeRequest(ITEM_ID) as never)

    expect(res.status).toBe(410)
    expect(plaidClient.transactionsSync).not.toHaveBeenCalled()
  })

  it('upserts an added expense transaction with the correct sign, needsReview, and mapped category', async () => {
    mockSession()
    const mappedAccount = mockPlaidAccount({ plaidAccountId: 'plaid_acct_1', accountId: 'cuid_account_1' })
    prismaMock.plaidItem.findUnique.mockResolvedValue(
      { ...mockPlaidItem({id: ITEM_ID, accessToken: 'encrypted:access-abc'}), accounts: [mappedAccount] } as never
    )
    ;(plaidClient.transactionsSync as jest.Mock).mockResolvedValue(
      emptySyncPage({
        added: [
          {
            transaction_id: 'ptx_1',
            account_id: 'plaid_acct_1',
            amount: 45, // Plaid positive = expense
            date: '2026-05-01',
            merchant_name: 'Trader Joes',
            name: 'TRADER JOES #123',
            personal_finance_category: { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_GROCERIES' },
          },
        ],
      })
    )
    prismaMock.category.findFirst.mockResolvedValue(mockCategory({ id: 'cuid_category_dining', name: 'Food & Dining' }) as never)
    prismaMock.transaction.upsert.mockResolvedValue({} as never)

    const res = await POST(makeRequest(ITEM_ID) as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual({ added: 1, modified: 0, removed: 0 })
    expect(decryptToken).toHaveBeenCalledWith('encrypted:access-abc')
    expect(prismaMock.transaction.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { plaidTransactionId: 'ptx_1' },
        create: expect.objectContaining({
          accountId: 'cuid_account_1',
          plaidTransactionId: 'ptx_1',
          amount: -4500,
          description: 'Trader Joes',
          categoryId: 'cuid_category_dining',
          needsReview: true,
        }),
      })
    )
    expect(prismaMock.category.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: 'Food & Dining', isActive: true } })
    )
  })

  it('converts a negative Plaid amount (income/credit) to positive local cents', async () => {
    mockSession()
    const mappedAccount = mockPlaidAccount({ plaidAccountId: 'plaid_acct_1', accountId: 'cuid_account_1' })
    prismaMock.plaidItem.findUnique.mockResolvedValue(
      { ...mockPlaidItem({id: ITEM_ID}), accounts: [mappedAccount] } as never
    )
    ;(plaidClient.transactionsSync as jest.Mock).mockResolvedValue(
      emptySyncPage({
        added: [
          {
            transaction_id: 'ptx_income_1',
            account_id: 'plaid_acct_1',
            amount: -1200,
            date: '2026-05-02',
            name: 'PAYROLL DEPOSIT',
            personal_finance_category: { primary: 'INCOME' },
          },
        ],
      })
    )
    prismaMock.category.findFirst.mockResolvedValue(mockCategory({ id: 'cuid_category_income', name: 'Income' }) as never)
    prismaMock.transaction.upsert.mockResolvedValue({} as never)

    await POST(makeRequest(ITEM_ID) as never)

    expect(prismaMock.transaction.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ amount: 120000 }),
      })
    )
  })

  it('skips transactions for Plaid accounts that are not yet mapped to a local account', async () => {
    mockSession()
    const unmappedAccount = mockPlaidAccount({ plaidAccountId: 'plaid_acct_unmapped', accountId: null })
    prismaMock.plaidItem.findUnique.mockResolvedValue(
      { ...mockPlaidItem({id: ITEM_ID}), accounts: [unmappedAccount] } as never
    )
    ;(plaidClient.transactionsSync as jest.Mock).mockResolvedValue(
      emptySyncPage({
        added: [
          {
            transaction_id: 'ptx_2',
            account_id: 'plaid_acct_unmapped',
            amount: 10,
            date: '2026-05-01',
            name: 'SOME CHARGE',
          },
        ],
      })
    )

    const res = await POST(makeRequest(ITEM_ID) as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.added).toBe(1)
    expect(prismaMock.transaction.upsert).not.toHaveBeenCalled()
  })

  it('falls back to Uncategorized when the primary category has no map entry', async () => {
    mockSession()
    const mappedAccount = mockPlaidAccount({ plaidAccountId: 'plaid_acct_1', accountId: 'cuid_account_1' })
    prismaMock.plaidItem.findUnique.mockResolvedValue(
      { ...mockPlaidItem({id: ITEM_ID}), accounts: [mappedAccount] } as never
    )
    ;(plaidClient.transactionsSync as jest.Mock).mockResolvedValue(
      emptySyncPage({
        added: [
          {
            transaction_id: 'ptx_3',
            account_id: 'plaid_acct_1',
            amount: 20,
            date: '2026-05-01',
            name: 'BANK FEE',
            personal_finance_category: { primary: 'BANK_FEES' },
          },
        ],
      })
    )
    prismaMock.category.findFirst.mockResolvedValue(mockCategory({ id: 'cuid_category_uncategorized', name: 'Uncategorized' }) as never)
    prismaMock.transaction.upsert.mockResolvedValue({} as never)

    await POST(makeRequest(ITEM_ID) as never)

    expect(prismaMock.category.findFirst).toHaveBeenCalledWith({ where: { name: 'Uncategorized', isSystem: true } })
    expect(prismaMock.transaction.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ categoryId: 'cuid_category_uncategorized' }),
      })
    )
  })

  it('falls back to Uncategorized when the transaction has no personal_finance_category at all', async () => {
    mockSession()
    const mappedAccount = mockPlaidAccount({ plaidAccountId: 'plaid_acct_1', accountId: 'cuid_account_1' })
    prismaMock.plaidItem.findUnique.mockResolvedValue(
      { ...mockPlaidItem({ id: ITEM_ID }), accounts: [mappedAccount] } as never
    )
    ;(plaidClient.transactionsSync as jest.Mock).mockResolvedValue(
      emptySyncPage({
        added: [
          { transaction_id: 'ptx_4', account_id: 'plaid_acct_1', amount: 5, date: '2026-05-01', name: 'UNKNOWN' },
        ],
      })
    )
    prismaMock.category.findFirst.mockResolvedValue(mockCategory({ id: 'cuid_category_uncategorized', name: 'Uncategorized' }) as never)
    prismaMock.transaction.upsert.mockResolvedValue({} as never)

    await POST(makeRequest(ITEM_ID) as never)

    expect(prismaMock.category.findFirst).toHaveBeenCalledTimes(1)
    expect(prismaMock.category.findFirst).toHaveBeenCalledWith({ where: { name: 'Uncategorized', isSystem: true } })
  })

  it('returns 500 when the Uncategorized system category is missing', async () => {
    mockSession()
    const mappedAccount = mockPlaidAccount({ plaidAccountId: 'plaid_acct_1', accountId: 'cuid_account_1' })
    prismaMock.plaidItem.findUnique.mockResolvedValue(
      { ...mockPlaidItem({ id: ITEM_ID }), accounts: [mappedAccount] } as never
    )
    ;(plaidClient.transactionsSync as jest.Mock).mockResolvedValue(
      emptySyncPage({
        added: [
          { transaction_id: 'ptx_5', account_id: 'plaid_acct_1', amount: 5, date: '2026-05-01', name: 'UNKNOWN' },
        ],
      })
    )
    prismaMock.category.findFirst.mockResolvedValue(null)

    const res = await POST(makeRequest(ITEM_ID) as never)

    expect(res.status).toBe(500)
  })

  it('soft-deletes removed transactions', async () => {
    mockSession()
    prismaMock.plaidItem.findUnique.mockResolvedValue({ ...mockPlaidItem({id: ITEM_ID}), accounts: [] } as never)
    ;(plaidClient.transactionsSync as jest.Mock).mockResolvedValue(
      emptySyncPage({ removed: [{ transaction_id: 'ptx_removed_1', account_id: 'plaid_acct_1' }] })
    )
    prismaMock.transaction.updateMany.mockResolvedValue({ count: 1 } as never)

    const res = await POST(makeRequest(ITEM_ID) as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.removed).toBe(1)
    expect(prismaMock.transaction.updateMany).toHaveBeenCalledWith({
      where: { plaidTransactionId: { in: ['ptx_removed_1'] } },
      data: { deletedAt: expect.any(Date) },
    })
  })

  it('does not call updateMany when nothing was removed', async () => {
    mockSession()
    prismaMock.plaidItem.findUnique.mockResolvedValue({ ...mockPlaidItem({id: ITEM_ID}), accounts: [] } as never)
    ;(plaidClient.transactionsSync as jest.Mock).mockResolvedValue(emptySyncPage())

    await POST(makeRequest(ITEM_ID) as never)

    expect(prismaMock.transaction.updateMany).not.toHaveBeenCalled()
  })

  it('paginates through multiple pages and persists the final cursor', async () => {
    mockSession()
    prismaMock.plaidItem.findUnique.mockResolvedValue(
      { ...mockPlaidItem({id: ITEM_ID, lastCursor: 'cursor-start'}), accounts: [] } as never
    )
    ;(plaidClient.transactionsSync as jest.Mock)
      .mockResolvedValueOnce(emptySyncPage({ has_more: true, next_cursor: 'cursor-page-2' }))
      .mockResolvedValueOnce(emptySyncPage({ has_more: false, next_cursor: 'cursor-final' }))

    await POST(makeRequest(ITEM_ID) as never)

    expect(plaidClient.transactionsSync).toHaveBeenCalledTimes(2)
    expect(plaidClient.transactionsSync).toHaveBeenNthCalledWith(1, expect.objectContaining({ cursor: 'cursor-start' }))
    expect(plaidClient.transactionsSync).toHaveBeenNthCalledWith(2, expect.objectContaining({ cursor: 'cursor-page-2' }))
    expect(prismaMock.plaidItem.update).toHaveBeenCalledWith({
      where: { id: ITEM_ID },
      data: { lastCursor: 'cursor-final', lastSyncedAt: expect.any(Date) },
    })
  })

  it('syncs balance for linked accounts and skips unlinked ones', async () => {
    mockSession()
    const linked = mockPlaidAccount({ plaidAccountId: 'plaid_acct_linked', accountId: 'cuid_account_1' })
    const unlinked = mockPlaidAccount({ plaidAccountId: 'plaid_acct_unlinked', accountId: null })
    prismaMock.plaidItem.findUnique.mockResolvedValue(
      { ...mockPlaidItem({id: ITEM_ID}), accounts: [linked, unlinked] } as never
    )
    ;(plaidClient.transactionsSync as jest.Mock).mockResolvedValue(emptySyncPage())
    ;(plaidClient.accountsBalanceGet as jest.Mock).mockResolvedValue({
      data: { accounts: [{ balances: { current: 543.21 } }] },
    })
    prismaMock.account.update.mockResolvedValue({} as never)

    await POST(makeRequest(ITEM_ID) as never)

    expect(plaidClient.accountsBalanceGet).toHaveBeenCalledTimes(1)
    expect(plaidClient.accountsBalanceGet).toHaveBeenCalledWith({
      access_token: expect.any(String),
      options: { account_ids: ['plaid_acct_linked'] },
    })
    expect(prismaMock.account.update).toHaveBeenCalledWith({
      where: { id: 'cuid_account_1' },
      data: { balance: 54321 },
    })
  })

  it('does not update balance when Plaid returns a null current balance', async () => {
    mockSession()
    const linked = mockPlaidAccount({ plaidAccountId: 'plaid_acct_linked', accountId: 'cuid_account_1' })
    prismaMock.plaidItem.findUnique.mockResolvedValue({ ...mockPlaidItem({id: ITEM_ID}), accounts: [linked] } as never)
    ;(plaidClient.transactionsSync as jest.Mock).mockResolvedValue(emptySyncPage())
    ;(plaidClient.accountsBalanceGet as jest.Mock).mockResolvedValue({
      data: { accounts: [{ balances: { current: null } }] },
    })

    await POST(makeRequest(ITEM_ID) as never)

    expect(prismaMock.account.update).not.toHaveBeenCalled()
  })

  it('returns 500 on unexpected error', async () => {
    mockSession()
    prismaMock.plaidItem.findUnique.mockRejectedValue(new Error('DB error'))

    const res = await POST(makeRequest(ITEM_ID) as never)

    expect(res.status).toBe(500)
  })

  it('marks the item ERROR and returns 409 when Plaid reports ITEM_LOGIN_REQUIRED', async () => {
    mockSession()
    prismaMock.plaidItem.findUnique.mockResolvedValue({ ...mockPlaidItem({ id: ITEM_ID }), accounts: [] } as never)
    const plaidError = {
      response: { data: { error_code: 'ITEM_LOGIN_REQUIRED', error_type: 'ITEM_ERROR' } },
    }
    ;(plaidClient.transactionsSync as jest.Mock).mockRejectedValue(plaidError)

    const res = await POST(makeRequest(ITEM_ID) as never)
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toBe('This connection needs to be reconnected')
    expect(prismaMock.plaidItem.update).toHaveBeenCalledWith({
      where: { id: ITEM_ID },
      data: { status: 'ERROR' },
    })
  })

  it('returns a generic 500 for a Plaid error code other than ITEM_LOGIN_REQUIRED', async () => {
    mockSession()
    prismaMock.plaidItem.findUnique.mockResolvedValue({ ...mockPlaidItem({ id: ITEM_ID }), accounts: [] } as never)
    const plaidError = {
      response: { data: { error_code: 'RATE_LIMIT_EXCEEDED', error_type: 'RATE_LIMIT_EXCEEDED' } },
    }
    ;(plaidClient.transactionsSync as jest.Mock).mockRejectedValue(plaidError)

    const res = await POST(makeRequest(ITEM_ID) as never)

    expect(res.status).toBe(500)
    expect(prismaMock.plaidItem.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ERROR' } })
    )
  })
})
