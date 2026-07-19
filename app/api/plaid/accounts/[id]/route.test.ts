import { PATCH } from './route'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { mockSession, noSession } from '@/lib/__mocks__/auth'
import { mockPlaidAccount } from '@/__tests__/factories/plaidAccount'
import { mockAccount } from '@/__tests__/factories/account'

const PLAID_ACCOUNT_ID = 'cuid_plaid_account_1'
const params = { params: { id: PLAID_ACCOUNT_ID } }

describe('PATCH /api/plaid/accounts/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()

    const req = new Request(`http://localhost/api/plaid/accounts/${PLAID_ACCOUNT_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ accountId: 'cuid_account_1' }),
    })
    const res = await PATCH(req as never, params)

    expect(res.status).toBe(401)
  })

  it('rejects a payload matching neither union branch', async () => {
    mockSession()

    const req = new Request(`http://localhost/api/plaid/accounts/${PLAID_ACCOUNT_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ foo: 'bar' }),
    })
    const res = await PATCH(req as never, params)

    expect(res.status).toBe(400)
  })

  it('returns 404 when the Plaid account does not exist', async () => {
    mockSession()
    prismaMock.plaidAccount.findUnique.mockResolvedValue(null)

    const req = new Request(`http://localhost/api/plaid/accounts/${PLAID_ACCOUNT_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ accountId: 'cuid_account_1' }),
    })
    const res = await PATCH(req as never, params)

    expect(res.status).toBe(404)
  })

  describe('linking to an existing account', () => {
    it('returns 404 when the target account does not exist', async () => {
      mockSession()
      prismaMock.plaidAccount.findUnique.mockResolvedValue(mockPlaidAccount({ id: PLAID_ACCOUNT_ID }) as never)
      prismaMock.account.findUnique.mockResolvedValue(null)

      const req = new Request(`http://localhost/api/plaid/accounts/${PLAID_ACCOUNT_ID}`, {
        method: 'PATCH',
        body: JSON.stringify({ accountId: 'cuid_account_1' }),
      })
      const res = await PATCH(req as never, params)

      expect(res.status).toBe(404)
    })

    it('marks the existing account plaidManaged and links it', async () => {
      mockSession()
      prismaMock.plaidAccount.findUnique.mockResolvedValue(mockPlaidAccount({ id: PLAID_ACCOUNT_ID }) as never)
      prismaMock.account.findUnique.mockResolvedValue(mockAccount({ id: 'cuid_account_1' }) as never)
      prismaMock.account.update.mockResolvedValue(mockAccount({ id: 'cuid_account_1', plaidManaged: true }) as never)
      prismaMock.plaidAccount.update.mockResolvedValue(
        mockPlaidAccount({ id: PLAID_ACCOUNT_ID, accountId: 'cuid_account_1' }) as never
      )

      const req = new Request(`http://localhost/api/plaid/accounts/${PLAID_ACCOUNT_ID}`, {
        method: 'PATCH',
        body: JSON.stringify({ accountId: 'cuid_account_1' }),
      })
      const res = await PATCH(req as never, params)

      expect(res.status).toBe(200)
      expect(prismaMock.account.update).toHaveBeenCalledWith({
        where: { id: 'cuid_account_1' },
        data: { plaidManaged: true },
      })
      expect(prismaMock.plaidAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PLAID_ACCOUNT_ID },
          data: { accountId: 'cuid_account_1' },
        })
      )
      expect(prismaMock.account.create).not.toHaveBeenCalled()
    })
  })

  describe('creating a new account', () => {
    it('creates a plaidManaged account with zero balance and links it', async () => {
      mockSession()
      prismaMock.plaidAccount.findUnique.mockResolvedValue(mockPlaidAccount({ id: PLAID_ACCOUNT_ID }) as never)
      prismaMock.account.create.mockResolvedValue(
        mockAccount({ id: 'cuid_new_account', name: 'New Checking', plaidManaged: true, balance: 0 }) as never
      )
      prismaMock.plaidAccount.update.mockResolvedValue(
        mockPlaidAccount({ id: PLAID_ACCOUNT_ID, accountId: 'cuid_new_account' }) as never
      )

      const req = new Request(`http://localhost/api/plaid/accounts/${PLAID_ACCOUNT_ID}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: 'New Checking', type: 'CHECKING' }),
      })
      const res = await PATCH(req as never, params)

      expect(res.status).toBe(200)
      expect(prismaMock.account.create).toHaveBeenCalledWith({
        data: { name: 'New Checking', type: 'CHECKING', balance: 0, plaidManaged: true },
      })
      expect(prismaMock.plaidAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PLAID_ACCOUNT_ID },
          data: { accountId: 'cuid_new_account' },
        })
      )
      expect(prismaMock.account.findUnique).not.toHaveBeenCalled()
    })
  })

  it('returns 500 on DB error', async () => {
    mockSession()
    prismaMock.plaidAccount.findUnique.mockRejectedValue(new Error('DB error'))

    const req = new Request(`http://localhost/api/plaid/accounts/${PLAID_ACCOUNT_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ accountId: 'cuid_account_1' }),
    })
    const res = await PATCH(req as never, params)

    expect(res.status).toBe(500)
  })
})
