import { GET } from './route'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { mockSession, noSession } from '@/lib/__mocks__/auth'
import { mockPlaidItem } from '@/__tests__/factories/plaidItem'

describe('GET /api/plaid/items', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()

    const req = new Request('http://localhost/api/plaid/items')
    const res = await GET(req as never)

    expect(res.status).toBe(401)
  })

  it('returns active items filtered by status', async () => {
    mockSession()
    prismaMock.plaidItem.findMany.mockResolvedValue([
      { ...mockPlaidItem(), accounts: [] },
    ] as never)

    const req = new Request('http://localhost/api/plaid/items')
    const res = await GET(req as never)

    expect(res.status).toBe(200)
    expect(prismaMock.plaidItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'ACTIVE' } })
    )
  })

  it('never returns accessToken in the response', async () => {
    mockSession()
    prismaMock.plaidItem.findMany.mockResolvedValue([
      { ...mockPlaidItem({ accessToken: 'super-secret-encrypted-token' }), accounts: [] },
    ] as never)

    const req = new Request('http://localhost/api/plaid/items')
    const res = await GET(req as never)
    const body = await res.json()

    expect(JSON.stringify(body)).not.toContain('super-secret-encrypted-token')
    expect(body.data[0].accessToken).toBeUndefined()
  })

  it('returns 500 on DB error', async () => {
    mockSession()
    prismaMock.plaidItem.findMany.mockRejectedValue(new Error('DB error'))

    const req = new Request('http://localhost/api/plaid/items')
    const res = await GET(req as never)

    expect(res.status).toBe(500)
  })
})
