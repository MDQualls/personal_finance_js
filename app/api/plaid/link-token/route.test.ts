import { POST } from './route'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { mockSession, noSession } from '@/lib/__mocks__/auth'
import { plaidClient } from '@/lib/plaid'
import { decryptToken } from '@/lib/crypto'
import { mockPlaidItem } from '@/__tests__/factories/plaidItem'

jest.mock('@/lib/plaid', () => ({
  plaidClient: {
    linkTokenCreate: jest.fn(),
  },
}))

jest.mock('@/lib/crypto', () => ({
  decryptToken: jest.fn((stored: string) => stored.replace('encrypted:', '')),
}))

function makeRequest(body: unknown = {}) {
  return new Request('http://localhost/api/plaid/link-token', { method: 'POST', body: JSON.stringify(body) })
}

describe('POST /api/plaid/link-token', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()

    const res = await POST(makeRequest() as never)

    expect(res.status).toBe(401)
  })

  it('returns a link token on success', async () => {
    mockSession()
    ;(plaidClient.linkTokenCreate as jest.Mock).mockResolvedValue({
      data: { link_token: 'link-sandbox-abc123' },
    })

    const res = await POST(makeRequest() as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.linkToken).toBe('link-sandbox-abc123')
  })

  it('returns 500 when Plaid rejects the request', async () => {
    mockSession()
    ;(plaidClient.linkTokenCreate as jest.Mock).mockRejectedValue(new Error('Plaid error'))

    const res = await POST(makeRequest() as never)

    expect(res.status).toBe(500)
  })

  it('rejects a non-cuid plaidItemId', async () => {
    mockSession()

    const res = await POST(makeRequest({ plaidItemId: 'not-a-cuid' }) as never)

    expect(res.status).toBe(400)
  })

  it('returns 404 when the item to reconnect does not exist', async () => {
    mockSession()
    prismaMock.plaidItem.findUnique.mockResolvedValue(null)

    const res = await POST(makeRequest({ plaidItemId: 'cuid_plaid_item_1' }) as never)

    expect(res.status).toBe(404)
  })

  it('enters Link update mode with the decrypted access_token when plaidItemId is given', async () => {
    mockSession()
    prismaMock.plaidItem.findUnique.mockResolvedValue(
      mockPlaidItem({ id: 'cuid_plaid_item_1', accessToken: 'encrypted:access-sandbox-abc' }) as never
    )
    ;(plaidClient.linkTokenCreate as jest.Mock).mockResolvedValue({
      data: { link_token: 'link-sandbox-update-mode' },
    })

    const res = await POST(makeRequest({ plaidItemId: 'cuid_plaid_item_1' }) as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.linkToken).toBe('link-sandbox-update-mode')
    expect(decryptToken).toHaveBeenCalledWith('encrypted:access-sandbox-abc')
    expect(plaidClient.linkTokenCreate).toHaveBeenCalledWith(
      expect.objectContaining({ access_token: 'access-sandbox-abc' })
    )
    expect(plaidClient.linkTokenCreate).toHaveBeenCalledWith(
      expect.not.objectContaining({ products: expect.anything() })
    )
  })
})
