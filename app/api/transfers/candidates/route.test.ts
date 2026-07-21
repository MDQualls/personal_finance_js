import { GET } from './route'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { mockSession, noSession } from '@/lib/__mocks__/auth'
import { mockTransaction } from '@/__tests__/factories/transaction'

const FROM_TX = mockTransaction({
  id: 'tx_from',
  accountId: 'account_a',
  amount: -50000,
  date: new Date('2026-07-01T00:00:00Z'),
  description: 'TRANSFER TO SAVINGS',
})
const TO_TX = mockTransaction({
  id: 'tx_to',
  accountId: 'account_b',
  amount: 50000,
  date: new Date('2026-07-01T00:00:00Z'),
  description: 'TRANSFER FROM CHECKING',
})

describe('GET /api/transfers/candidates', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns 401 when unauthenticated', async () => {
    noSession()
    const req = new Request('http://localhost/api/transfers/candidates')
    const res = await GET(req as never)

    expect(res.status).toBe(401)
  })

  it('returns detected candidates when none are dismissed', async () => {
    mockSession()
    prismaMock.transaction.findMany.mockResolvedValue([FROM_TX, TO_TX])
    prismaMock.dismissedTransferCandidate.findMany.mockResolvedValue([])

    const req = new Request('http://localhost/api/transfers/candidates')
    const res = await GET(req as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].fromTransaction.id).toBe('tx_from')
  })

  it('excludes a candidate pair the user previously dismissed', async () => {
    mockSession()
    prismaMock.transaction.findMany.mockResolvedValue([FROM_TX, TO_TX])
    prismaMock.dismissedTransferCandidate.findMany.mockResolvedValue([
      {
        id: 'dismiss_1',
        fromTransactionId: 'tx_from',
        toTransactionId: 'tx_to',
        createdAt: new Date(),
      },
    ])

    const req = new Request('http://localhost/api/transfers/candidates')
    const res = await GET(req as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(0)
  })
})
