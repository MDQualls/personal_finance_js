import { GET, POST } from './route'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { mockSession, noSession } from '@/lib/__mocks__/auth'
import { mockBudget } from '@/__tests__/factories/budget'
import { mockCategory } from '@/__tests__/factories/category'

describe('GET /api/budgets', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()
    const res = await GET(new Request('http://localhost/api/budgets') as never)
    expect(res.status).toBe(401)
  })

  it('returns budgets enriched with a spent field', async () => {
    mockSession()
    const cat = mockCategory()
    const budget = mockBudget({ categoryId: cat.id, amount: 50000 })
    prismaMock.budget.findMany.mockResolvedValue([{ ...budget, category: cat }] as never)
    prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: -12500 } } as never)

    const res = await GET(new Request('http://localhost/api/budgets') as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data[0].spent).toBe(12500) // absolute value
  })

  it('returns spent = 0 when no transactions exist for the period', async () => {
    mockSession()
    const cat = mockCategory()
    const budget = mockBudget({ categoryId: cat.id, amount: 50000 })
    prismaMock.budget.findMany.mockResolvedValue([{ ...budget, category: cat }] as never)
    prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: null } } as never)

    const res = await GET(new Request('http://localhost/api/budgets') as never)
    const body = await res.json()

    expect(body.data[0].spent).toBe(0)
  })

  it('returns 500 on DB error', async () => {
    mockSession()
    prismaMock.budget.findMany.mockRejectedValue(new Error('DB error'))

    const res = await GET(new Request('http://localhost/api/budgets') as never)
    expect(res.status).toBe(500)
  })
})

describe('POST /api/budgets', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()
    const req = new Request('http://localhost/api/budgets', {
      method: 'POST',
      body: JSON.stringify({ categoryId: 'cuid_category_1', amount: 50000, period: 'MONTHLY', startDate: '2026-04-01T00:00:00.000Z' }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(401)
  })

  it('creates a budget with valid data', async () => {
    mockSession()
    const cat = mockCategory()
    const budget = mockBudget({ amount: 50000 })
    prismaMock.budget.create.mockResolvedValue({ ...budget, category: cat } as never)

    const req = new Request('http://localhost/api/budgets', {
      method: 'POST',
      body: JSON.stringify({
        categoryId: 'cuid_category_1',
        amount: 50000,
        period: 'MONTHLY',
        startDate: '2026-04-01T00:00:00.000Z',
      }),
    })
    const res = await POST(req as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.amount).toBe(50000)
  })

  it('returns 400 when amount is a float', async () => {
    mockSession()
    const req = new Request('http://localhost/api/budgets', {
      method: 'POST',
      body: JSON.stringify({ categoryId: 'cuid_category_1', amount: 500.50, period: 'MONTHLY', startDate: '2026-04-01T00:00:00.000Z' }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when categoryId is missing', async () => {
    mockSession()
    const req = new Request('http://localhost/api/budgets', {
      method: 'POST',
      body: JSON.stringify({ amount: 50000, period: 'MONTHLY', startDate: '2026-04-01T00:00:00.000Z' }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when period is invalid', async () => {
    mockSession()
    const req = new Request('http://localhost/api/budgets', {
      method: 'POST',
      body: JSON.stringify({ categoryId: 'cuid_category_1', amount: 50000, period: 'DAILY', startDate: '2026-04-01T00:00:00.000Z' }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('returns 500 on DB error', async () => {
    mockSession()
    prismaMock.budget.create.mockRejectedValue(new Error('DB error'))

    const req = new Request('http://localhost/api/budgets', {
      method: 'POST',
      body: JSON.stringify({ categoryId: 'cuid_category_1', amount: 50000, period: 'MONTHLY', startDate: '2026-04-01T00:00:00.000Z' }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(500)
  })
})
