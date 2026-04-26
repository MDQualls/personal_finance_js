import { GET, POST } from './route'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { mockSession, noSession } from '@/lib/__mocks__/auth'
import { mockSubscription } from '@/__tests__/factories/subscription'
import { mockCategory } from '@/__tests__/factories/category'

describe('GET /api/subscriptions', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()
    const res = await GET(new Request('http://localhost/api/subscriptions') as never)
    expect(res.status).toBe(401)
  })

  it('returns subscriptions with monthlyEquivalent and totals in meta', async () => {
    mockSession()
    const cat = mockCategory()
    const sub = mockSubscription({ amount: 1200, frequency: 'MONTHLY', isActive: true })
    prismaMock.subscription.findMany.mockResolvedValue([{ ...sub, category: cat }] as never)

    const res = await GET(new Request('http://localhost/api/subscriptions') as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data[0].monthlyEquivalent).toBe(1200)
    expect(body.meta.totalMonthly).toBe(1200)
    expect(body.meta.totalAnnual).toBe(14400)
  })

  it('excludes inactive subscriptions from totals', async () => {
    mockSession()
    const cat = mockCategory()
    const active = mockSubscription({ amount: 1000, frequency: 'MONTHLY', isActive: true })
    const cancelled = mockSubscription({ amount: 5000, frequency: 'MONTHLY', isActive: false })
    prismaMock.subscription.findMany.mockResolvedValue([
      { ...active, category: cat },
      { ...cancelled, category: cat },
    ] as never)

    const res = await GET(new Request('http://localhost/api/subscriptions') as never)
    const body = await res.json()

    expect(body.meta.totalMonthly).toBe(1000)
    expect(body.data).toHaveLength(2) // both returned, filter is on totals only
  })

  it('returns 500 on DB error', async () => {
    mockSession()
    prismaMock.subscription.findMany.mockRejectedValue(new Error('DB error'))

    const res = await GET(new Request('http://localhost/api/subscriptions') as never)
    expect(res.status).toBe(500)
  })
})

describe('POST /api/subscriptions', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()
    const req = new Request('http://localhost/api/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ name: 'Netflix', amount: 1499, frequency: 'MONTHLY', nextDueDate: '2026-05-01T00:00:00.000Z', categoryId: 'cuid_category_1' }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(401)
  })

  it('creates a subscription with valid data', async () => {
    mockSession()
    const cat = mockCategory()
    const sub = mockSubscription({ name: 'Netflix' })
    prismaMock.subscription.create.mockResolvedValue({ ...sub, category: cat } as never)

    const req = new Request('http://localhost/api/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Netflix',
        amount: 1499,
        frequency: 'MONTHLY',
        nextDueDate: '2026-05-01T00:00:00.000Z',
        categoryId: 'cuid_category_1',
      }),
    })
    const res = await POST(req as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.name).toBe('Netflix')
  })

  it('returns 400 with invalid frequency', async () => {
    mockSession()
    const req = new Request('http://localhost/api/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ name: 'Netflix', amount: 1499, frequency: 'DAILY', nextDueDate: '2026-05-01T00:00:00.000Z', categoryId: 'cuid_category_1' }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is missing', async () => {
    mockSession()
    const req = new Request('http://localhost/api/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ amount: 1499, frequency: 'MONTHLY', nextDueDate: '2026-05-01T00:00:00.000Z', categoryId: 'cuid_category_1' }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('returns 500 on DB error', async () => {
    mockSession()
    prismaMock.subscription.create.mockRejectedValue(new Error('DB error'))

    const req = new Request('http://localhost/api/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ name: 'Netflix', amount: 1499, frequency: 'MONTHLY', nextDueDate: '2026-05-01T00:00:00.000Z', categoryId: 'cuid_category_1' }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(500)
  })
})
