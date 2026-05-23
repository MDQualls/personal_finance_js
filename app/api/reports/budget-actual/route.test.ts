import { GET } from './route'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { mockSession, noSession } from '@/lib/__mocks__/auth'
import { mockCategory } from '@/__tests__/factories/category'

const mockBudget = (overrides = {}) => ({
  id: 'cuid_budget_1',
  categoryId: 'cuid_category_1',
  amount: 50000, // $500.00
  period: 'MONTHLY' as const,
  budgetType: 'SPENDING_LIMIT' as const,
  startDate: new Date('2026-05-01T00:00:00Z'),
  rollover: false,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  category: mockCategory({ id: 'cuid_category_1', name: 'Groceries' }),
  ...overrides,
})

describe('GET /api/reports/budget-actual', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()
    const res = await GET(new Request('http://localhost/api/reports/budget-actual') as never)
    expect(res.status).toBe(401)
  })

  it('returns budget vs actual rows with correct shape', async () => {
    mockSession()
    prismaMock.budget.findMany.mockResolvedValue([mockBudget()] as never)
    prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: -30000 } } as never)

    const res = await GET(new Request('http://localhost/api/reports/budget-actual') as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0]).toMatchObject({
      categoryId: 'cuid_category_1',
      categoryName: 'Groceries',
      budgeted: 50000,
      spent: 30000,
      percentage: 60,
    })
  })

  it('returns percentage 100 when exactly at budget', async () => {
    mockSession()
    prismaMock.budget.findMany.mockResolvedValue([mockBudget()] as never)
    prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: -50000 } } as never)

    const res = await GET(new Request('http://localhost/api/reports/budget-actual') as never)
    const body = await res.json()

    expect(body.data[0].percentage).toBe(100)
  })

  it('returns percentage over 100 when over budget', async () => {
    mockSession()
    prismaMock.budget.findMany.mockResolvedValue([mockBudget()] as never)
    prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: -65000 } } as never)

    const res = await GET(new Request('http://localhost/api/reports/budget-actual') as never)
    const body = await res.json()

    expect(body.data[0].percentage).toBe(130)
  })

  it('returns 0 spent when no transactions in period', async () => {
    mockSession()
    prismaMock.budget.findMany.mockResolvedValue([mockBudget()] as never)
    prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: null } } as never)

    const res = await GET(new Request('http://localhost/api/reports/budget-actual') as never)
    const body = await res.json()

    expect(body.data[0].spent).toBe(0)
    expect(body.data[0].percentage).toBe(0)
  })

  it('sorts results by percentage descending', async () => {
    mockSession()
    const groceries = mockBudget({ id: 'b1', categoryId: 'c1', amount: 50000, category: mockCategory({ id: 'c1', name: 'Groceries' }) })
    const dining = mockBudget({ id: 'b2', categoryId: 'c2', amount: 20000, category: mockCategory({ id: 'c2', name: 'Dining' }) })
    prismaMock.budget.findMany.mockResolvedValue([groceries, dining] as never)
    // Groceries: 60% — Dining: 90%
    prismaMock.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { amount: -30000 } } as never)
      .mockResolvedValueOnce({ _sum: { amount: -18000 } } as never)

    const res = await GET(new Request('http://localhost/api/reports/budget-actual') as never)
    const body = await res.json()

    expect(body.data[0].categoryName).toBe('Dining')
    expect(body.data[1].categoryName).toBe('Groceries')
  })

  it('returns empty array when no active budgets exist', async () => {
    mockSession()
    prismaMock.budget.findMany.mockResolvedValue([] as never)

    const res = await GET(new Request('http://localhost/api/reports/budget-actual') as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(0)
  })

  it('only queries active budgets', async () => {
    mockSession()
    prismaMock.budget.findMany.mockResolvedValue([] as never)

    await GET(new Request('http://localhost/api/reports/budget-actual') as never)

    expect(prismaMock.budget.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true }) })
    )
  })

  it('filters transactions to the provided date range', async () => {
    mockSession()
    prismaMock.budget.findMany.mockResolvedValue([mockBudget()] as never)
    prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: null } } as never)

    const url = 'http://localhost/api/reports/budget-actual?from=2026-05-01T00:00:00Z&to=2026-05-31T23:59:59Z'
    await GET(new Request(url) as never)

    expect(prismaMock.transaction.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          date: expect.objectContaining({
            gte: new Date('2026-05-01T00:00:00Z'),
            lte: new Date('2026-05-31T23:59:59Z'),
          }),
        }),
      })
    )
  })

  it('includes budgetType in each row', async () => {
    mockSession()
    prismaMock.budget.findMany.mockResolvedValue([mockBudget()] as never)
    prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amount: -30000 } } as never)

    const res = await GET(new Request('http://localhost/api/reports/budget-actual') as never)
    const body = await res.json()

    expect(body.data[0].budgetType).toBe('SPENDING_LIMIT')
  })

  it('sorts savings goals at 100%+ below spending budgets at 100%+', async () => {
    mockSession()
    const spendingBudget = mockBudget({
      id: 'b1', categoryId: 'c1', amount: 10000,
      budgetType: 'SPENDING_LIMIT',
      category: mockCategory({ id: 'c1', name: 'Food' }),
    })
    const savingsBudget = mockBudget({
      id: 'b2', categoryId: 'c2', amount: 10000,
      budgetType: 'SAVINGS_GOAL',
      category: mockCategory({ id: 'c2', name: 'Savings' }),
    })
    prismaMock.budget.findMany.mockResolvedValue([savingsBudget, spendingBudget] as never)
    // Both at 110%
    prismaMock.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { amount: -11000 } } as never)
      .mockResolvedValueOnce({ _sum: { amount: -11000 } } as never)

    const res = await GET(new Request('http://localhost/api/reports/budget-actual') as never)
    const body = await res.json()

    expect(body.data[0].categoryName).toBe('Food')
    expect(body.data[1].categoryName).toBe('Savings')
  })

  it('returns 500 on DB error', async () => {
    mockSession()
    prismaMock.budget.findMany.mockRejectedValue(new Error('DB error'))

    const res = await GET(new Request('http://localhost/api/reports/budget-actual') as never)
    expect(res.status).toBe(500)
  })
})
