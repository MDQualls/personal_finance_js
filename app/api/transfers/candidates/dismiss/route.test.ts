import { POST } from './route'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { mockSession, noSession } from '@/lib/__mocks__/auth'

describe('POST /api/transfers/candidates/dismiss', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns 401 when unauthenticated', async () => {
    noSession()
    const req = new Request('http://localhost/api/transfers/candidates/dismiss', {
      method: 'POST',
      body: JSON.stringify({ fromTransactionId: 'tx_a', toTransactionId: 'tx_b' }),
    })
    const res = await POST(req as never)

    expect(res.status).toBe(401)
  })

  it('returns 400 when the request body is invalid', async () => {
    mockSession()
    const req = new Request('http://localhost/api/transfers/candidates/dismiss', {
      method: 'POST',
      body: JSON.stringify({ fromTransactionId: '' }),
    })
    const res = await POST(req as never)

    expect(res.status).toBe(400)
  })

  it('upserts a dismissed candidate record for the pair', async () => {
    mockSession()
    prismaMock.dismissedTransferCandidate.upsert.mockResolvedValue({
      id: 'dismiss_1',
      fromTransactionId: 'tx_a',
      toTransactionId: 'tx_b',
      createdAt: new Date(),
    })

    const req = new Request('http://localhost/api/transfers/candidates/dismiss', {
      method: 'POST',
      body: JSON.stringify({ fromTransactionId: 'tx_a', toTransactionId: 'tx_b' }),
    })
    const res = await POST(req as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.dismissed).toBe(true)
    expect(prismaMock.dismissedTransferCandidate.upsert).toHaveBeenCalledWith({
      where: { fromTransactionId_toTransactionId: { fromTransactionId: 'tx_a', toTransactionId: 'tx_b' } },
      create: { fromTransactionId: 'tx_a', toTransactionId: 'tx_b' },
      update: {},
    })
  })

  it('returns 500 when the database write fails', async () => {
    mockSession()
    prismaMock.dismissedTransferCandidate.upsert.mockRejectedValue(new Error('db down'))

    const req = new Request('http://localhost/api/transfers/candidates/dismiss', {
      method: 'POST',
      body: JSON.stringify({ fromTransactionId: 'tx_a', toTransactionId: 'tx_b' }),
    })
    const res = await POST(req as never)

    expect(res.status).toBe(500)
  })
})
