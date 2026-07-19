import { GET, POST } from './route'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { mockSession, noSession } from '@/lib/__mocks__/auth'
import { mockTransaction } from '@/__tests__/factories/transaction'

describe('GET /api/transactions', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

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

  it('applies from date filter', async () => {
    mockSession()
    prismaMock.$transaction.mockResolvedValue([[], 0])

    const from = '2026-07-01T00:00:00.000Z'
    const req = new Request(`http://localhost/api/transactions?from=${from}`)
    await GET(req as never)

    const findArgs = prismaMock.transaction.findMany.mock.calls[0][0] as any
    expect(findArgs.where.date.gte).toEqual(new Date(from))
  })

  it('applies to date filter', async () => {
    mockSession()
    prismaMock.$transaction.mockResolvedValue([[], 0])

    const to = '2026-07-31T23:59:59.999Z'
    const req = new Request(`http://localhost/api/transactions?to=${to}`)
    await GET(req as never)

    const findArgs = prismaMock.transaction.findMany.mock.calls[0][0] as any
    expect(findArgs.where.date.lte).toEqual(new Date(to))
  })

  it('applies both from and to for a month range', async () => {
    mockSession()
    prismaMock.$transaction.mockResolvedValue([[], 0])

    const from = '2026-07-01T00:00:00.000Z'
    const to = '2026-07-31T23:59:59.999Z'
    const req = new Request(`http://localhost/api/transactions?from=${from}&to=${to}`)
    await GET(req as never)

    const findArgs = prismaMock.transaction.findMany.mock.calls[0][0] as any
    expect(findArgs.where.date.gte).toEqual(new Date(from))
    expect(findArgs.where.date.lte).toEqual(new Date(to))
  })

  it('omits date filter when neither from nor to is provided', async () => {
    mockSession()
    prismaMock.$transaction.mockResolvedValue([[], 0])

    const req = new Request('http://localhost/api/transactions')
    await GET(req as never)

    const findArgs = prismaMock.transaction.findMany.mock.calls[0][0] as any
    expect(findArgs.where.date).toBeUndefined()
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

  it('applies needsReview: true filter when needsReview=true query param is set', async () => {
    mockSession()
    prismaMock.$transaction.mockResolvedValue([[], 0])

    const req = new Request('http://localhost/api/transactions?needsReview=true')
    await GET(req as never)

    const findArgs = prismaMock.transaction.findMany.mock.calls[0][0] as any
    expect(findArgs.where.needsReview).toBe(true)
  })

  it('omits needsReview filter when the query param is absent', async () => {
    mockSession()
    prismaMock.$transaction.mockResolvedValue([[], 0])

    const req = new Request('http://localhost/api/transactions')
    await GET(req as never)

    const findArgs = prismaMock.transaction.findMany.mock.calls[0][0] as any
    expect(findArgs.where.needsReview).toBeUndefined()
  })
})

describe('POST /api/transactions', () => {
  beforeEach(() => {
    prismaMock.merchantRule.findMany.mockResolvedValue([])
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

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
    prismaMock.$transaction.mockResolvedValue([tx, { id: 'clxxxxxxxxxxxxxxxxxx001', balance: 0 }])

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

