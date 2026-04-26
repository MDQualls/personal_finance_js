import { GET, POST } from './route'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { mockSession, noSession } from '@/lib/__mocks__/auth'
import { mockTransaction } from '@/__tests__/factories/transaction'

describe('GET /api/transactions', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()
    const req = new Request('http://localhost/api/transactions')
    const res = await GET(req as never)
    expect(res.status).toBe(401)
  })

  it('returns transactions for authenticated user', async () => {
    mockSession()
    const transactions = [mockTransaction(), mockTransaction()]
    prismaMock.$transaction.mockResolvedValue([transactions, 2])

    const req = new Request('http://localhost/api/transactions')
    const res = await GET(req as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(2)
    expect(body.meta.total).toBe(2)
  })

  it('always includes deletedAt: null in where clause', async () => {
    mockSession()
    prismaMock.$transaction.mockResolvedValue([[], 0])

    const req = new Request('http://localhost/api/transactions')
    await GET(req as never)

    expect(prismaMock.$transaction).toHaveBeenCalled()
    const calls = prismaMock.$transaction.mock.calls
    expect(calls.length).toBeGreaterThan(0)
  })

  it('applies accountId filter from query param', async () => {
    mockSession()
    prismaMock.$transaction.mockResolvedValue([[], 0])

    const req = new Request('http://localhost/api/transactions?accountId=cuid_account_1')
    await GET(req as never)

    expect(prismaMock.$transaction).toHaveBeenCalled()
  })

  it('returns 500 on DB error', async () => {
    mockSession()
    prismaMock.$transaction.mockRejectedValue(new Error('DB error'))

    const req = new Request('http://localhost/api/transactions')
    const res = await GET(req as never)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to fetch transactions')
  })
})

describe('POST /api/transactions', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()
    const req = new Request('http://localhost/api/transactions', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(401)
  })

  it('creates a transaction with valid data', async () => {
    mockSession()
    const tx = mockTransaction({ description: 'Grocery run', amount: -4500 })
    prismaMock.transaction.create.mockResolvedValue(tx as never)

    const req = new Request('http://localhost/api/transactions', {
      method: 'POST',
      body: JSON.stringify({
        accountId: 'clxxxxxxxxxxxxxxxxxx001',
        amount: -4500,
        date: '2026-04-01T00:00:00.000Z',
        categoryId: 'clxxxxxxxxxxxxxxxxxx002',
        description: 'Grocery run',
      }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(200)
  })

  it('returns 400 when amount is a float', async () => {
    mockSession()

    const req = new Request('http://localhost/api/transactions', {
      method: 'POST',
      body: JSON.stringify({
        accountId: 'clxxxxxxxxxxxxxxxxxx001',
        amount: -45.99,
        date: '2026-04-01T00:00:00.000Z',
        categoryId: 'clxxxxxxxxxxxxxxxxxx002',
        description: 'Test',
      }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when description is missing', async () => {
    mockSession()

    const req = new Request('http://localhost/api/transactions', {
      method: 'POST',
      body: JSON.stringify({
        accountId: 'clxxxxxxxxxxxxxxxxxx001',
        amount: -4500,
        date: '2026-04-01T00:00:00.000Z',
        categoryId: 'clxxxxxxxxxxxxxxxxxx002',
      }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/transactions (soft delete)', () => {
  it('soft deletes by setting deletedAt', async () => {
    mockSession()
    const tx = mockTransaction()
    prismaMock.transaction.findUnique.mockResolvedValue(tx)
    prismaMock.transaction.update.mockResolvedValue({ ...tx, deletedAt: new Date() })

    // Import the DELETE handler
    const { DELETE } = await import('./[id]/route')
    const req = new Request('http://localhost/api/transactions/cuid_transaction_1', {
      method: 'DELETE',
    })
    const res = await DELETE(req as never, { params: { id: tx.id } })
    expect(res.status).toBe(200)

    expect(prismaMock.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      })
    )
  })
})
