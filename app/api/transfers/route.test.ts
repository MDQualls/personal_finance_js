import { POST } from './route'
import { DELETE } from './[id]/route'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { mockSession, noSession } from '@/lib/__mocks__/auth'
import { mockTransaction } from '@/__tests__/factories/transaction'

const FROM_TX = mockTransaction({ accountId: 'account_a', amount: -50000, date: new Date('2026-07-01T00:00:00Z') })
const TO_TX = mockTransaction({ accountId: 'account_b', amount: 50000, date: new Date('2026-07-01T00:00:00Z') })

const MOCK_TRANSFER = {
  id: 'transfer_1',
  fromTransactionId: FROM_TX.id,
  toTransactionId: TO_TX.id,
  note: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  fromTransaction: FROM_TX,
  toTransaction: TO_TX,
}

describe('POST /api/transfers', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns 401 when unauthenticated', async () => {
    noSession()
    const req = new Request('http://localhost/api/transfers', {
      method: 'POST',
      body: JSON.stringify({ fromTransactionId: FROM_TX.id, toTransactionId: TO_TX.id }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(401)
  })

  it('creates transfer and sets isTransfer on both transactions', async () => {
    mockSession()
    prismaMock.transaction.findUnique
      .mockResolvedValueOnce(FROM_TX)
      .mockResolvedValueOnce(TO_TX)
    prismaMock.$transaction.mockResolvedValue(MOCK_TRANSFER)

    const req = new Request('http://localhost/api/transfers', {
      method: 'POST',
      body: JSON.stringify({ fromTransactionId: FROM_TX.id, toTransactionId: TO_TX.id }),
    })
    const res = await POST(req as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.fromTransactionId).toBe(FROM_TX.id)
    expect(body.data.toTransactionId).toBe(TO_TX.id)
  })

  it('returns 422 when amounts do not match', async () => {
    mockSession()
    const badTo = mockTransaction({ accountId: 'account_b', amount: 99999 })
    prismaMock.transaction.findUnique
      .mockResolvedValueOnce(FROM_TX)
      .mockResolvedValueOnce(badTo)

    const req = new Request('http://localhost/api/transfers', {
      method: 'POST',
      body: JSON.stringify({ fromTransactionId: FROM_TX.id, toTransactionId: badTo.id }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toMatch(/equal and opposite/i)
  })

  it('returns 422 when transactions are on the same account', async () => {
    mockSession()
    const sameAccount = mockTransaction({ accountId: 'account_a', amount: 50000 })
    prismaMock.transaction.findUnique
      .mockResolvedValueOnce(FROM_TX)
      .mockResolvedValueOnce(sameAccount)

    const req = new Request('http://localhost/api/transfers', {
      method: 'POST',
      body: JSON.stringify({ fromTransactionId: FROM_TX.id, toTransactionId: sameAccount.id }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toMatch(/different accounts/i)
  })

  it('returns 422 when a transaction is already linked', async () => {
    mockSession()
    const alreadyLinked = mockTransaction({ accountId: 'account_b', amount: 50000, isTransfer: true })
    prismaMock.transaction.findUnique
      .mockResolvedValueOnce(FROM_TX)
      .mockResolvedValueOnce(alreadyLinked)

    const req = new Request('http://localhost/api/transfers', {
      method: 'POST',
      body: JSON.stringify({ fromTransactionId: FROM_TX.id, toTransactionId: alreadyLinked.id }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toMatch(/already linked/i)
  })
})

describe('DELETE /api/transfers/[id]', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('unlinks transfer and resets isTransfer on both transactions', async () => {
    mockSession()
    prismaMock.transfer.findUnique.mockResolvedValue(MOCK_TRANSFER)
    prismaMock.$transaction.mockResolvedValue([{ count: 2 }, MOCK_TRANSFER])

    const req = new Request('http://localhost/api/transfers/transfer_1', { method: 'DELETE' })
    const res = await DELETE(req as never, { params: { id: 'transfer_1' } })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.unlinked).toBe(true)
  })

  it('returns 404 for unknown transfer id', async () => {
    mockSession()
    prismaMock.transfer.findUnique.mockResolvedValue(null)

    const req = new Request('http://localhost/api/transfers/nonexistent', { method: 'DELETE' })
    const res = await DELETE(req as never, { params: { id: 'nonexistent' } })

    expect(res.status).toBe(404)
  })
})
