import { POST } from './route'
import { mockSession, noSession } from '@/lib/__mocks__/auth'
import { plaidClient } from '@/lib/plaid'

jest.mock('@/lib/plaid', () => ({
  plaidClient: {
    linkTokenCreate: jest.fn(),
  },
}))

describe('POST /api/plaid/link-token', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()

    const req = new Request('http://localhost/api/plaid/link-token', { method: 'POST' })
    const res = await POST(req as never)

    expect(res.status).toBe(401)
  })

  it('returns a link token on success', async () => {
    mockSession()
    ;(plaidClient.linkTokenCreate as jest.Mock).mockResolvedValue({
      data: { link_token: 'link-sandbox-abc123' },
    })

    const req = new Request('http://localhost/api/plaid/link-token', { method: 'POST' })
    const res = await POST(req as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.linkToken).toBe('link-sandbox-abc123')
  })

  it('returns 500 when Plaid rejects the request', async () => {
    mockSession()
    ;(plaidClient.linkTokenCreate as jest.Mock).mockRejectedValue(new Error('Plaid error'))

    const req = new Request('http://localhost/api/plaid/link-token', { method: 'POST' })
    const res = await POST(req as never)

    expect(res.status).toBe(500)
  })
})
