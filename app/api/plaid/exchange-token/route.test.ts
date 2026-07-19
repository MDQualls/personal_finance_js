import { POST } from './route'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { mockSession, noSession } from '@/lib/__mocks__/auth'
import { plaidClient } from '@/lib/plaid'
import { encryptToken } from '@/lib/crypto'
import { mockPlaidItem } from '@/__tests__/factories/plaidItem'

jest.mock('@/lib/plaid', () => ({
  plaidClient: {
    itemPublicTokenExchange: jest.fn(),
  },
}))

jest.mock('@/lib/crypto', () => ({
  encryptToken: jest.fn((token: string) => `encrypted:${token}`),
}))

const VALID_PAYLOAD = {
  publicToken: 'public-sandbox-abc123',
  institutionId: 'ins_1',
  institutionName: 'Test Bank',
  accounts: [
    { id: 'plaid_acct_1', name: 'Checking', mask: '1234', type: 'depository', subtype: 'checking' },
  ],
}

describe('POST /api/plaid/exchange-token', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()

    const req = new Request('http://localhost/api/plaid/exchange-token', {
      method: 'POST',
      body: JSON.stringify(VALID_PAYLOAD),
    })
    const res = await POST(req as never)

    expect(res.status).toBe(401)
  })

  it('exchanges the public token, encrypts it, and creates a PlaidItem', async () => {
    mockSession()
    ;(plaidClient.itemPublicTokenExchange as jest.Mock).mockResolvedValue({
      data: { access_token: 'access-sandbox-abc', item_id: 'item-abc' },
    })
    prismaMock.plaidItem.create.mockResolvedValue(mockPlaidItem({ id: 'cuid_item_1' }) as never)

    const req = new Request('http://localhost/api/plaid/exchange-token', {
      method: 'POST',
      body: JSON.stringify(VALID_PAYLOAD),
    })
    const res = await POST(req as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.plaidItemId).toBe('cuid_item_1')
    expect(encryptToken).toHaveBeenCalledWith('access-sandbox-abc')
    expect(prismaMock.plaidItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accessToken: 'encrypted:access-sandbox-abc',
          itemId: 'item-abc',
          institutionId: 'ins_1',
          institutionName: 'Test Bank',
          accounts: {
            create: [
              {
                plaidAccountId: 'plaid_acct_1',
                name: 'Checking',
                mask: '1234',
                type: 'depository',
                subtype: 'checking',
              },
            ],
          },
        }),
      })
    )
  })

  it('rejects a payload missing required fields', async () => {
    mockSession()

    const req = new Request('http://localhost/api/plaid/exchange-token', {
      method: 'POST',
      body: JSON.stringify({ publicToken: '' }),
    })
    const res = await POST(req as never)

    expect(res.status).toBe(400)
  })

  it('returns 500 when Plaid rejects the exchange', async () => {
    mockSession()
    ;(plaidClient.itemPublicTokenExchange as jest.Mock).mockRejectedValue(new Error('Plaid error'))

    const req = new Request('http://localhost/api/plaid/exchange-token', {
      method: 'POST',
      body: JSON.stringify(VALID_PAYLOAD),
    })
    const res = await POST(req as never)

    expect(res.status).toBe(500)
  })
})
