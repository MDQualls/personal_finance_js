import { getCostFloor, getExpenseSplit, getSpendingComparison } from './reports'
import { prismaMock } from './__mocks__/prisma'
import { mockRecurringRule } from '@/__tests__/factories/recurringRule'
import { mockSubscription } from '@/__tests__/factories/subscription'
import { mockTransaction } from '@/__tests__/factories/transaction'
import { mockCategory } from '@/__tests__/factories/category'

const FROM = new Date('2026-07-01T00:00:00Z')
const TO = new Date('2026-07-31T23:59:59Z')

const txWithCategory = (categoryId: string, amount: number, categoryOverrides = {}) => ({
  ...mockTransaction({ categoryId, amount }),
  category: mockCategory({ id: categoryId, name: `Category ${categoryId}`, color: '#000000', ...categoryOverrides }),
})

describe('getCostFloor', () => {
  it('sums monthly-equivalent active EXPENSE recurring rules and active subscriptions', async () => {
    prismaMock.recurringRule.findMany.mockResolvedValue([
      mockRecurringRule({ amount: -150000, frequency: 'MONTHLY', type: 'EXPENSE' }) as never, // $1,500/mo
      mockRecurringRule({ amount: -30000, frequency: 'WEEKLY', type: 'EXPENSE' }) as never, // ~$130/mo
    ])
    prismaMock.subscription.findMany.mockResolvedValue([
      mockSubscription({ amount: 1599, frequency: 'MONTHLY' }) as never, // $15.99/mo
      mockSubscription({ amount: 12000, frequency: 'YEARLY' }) as never, // $10/mo
    ])

    const result = await getCostFloor()

    const expectedWeekly = Math.round((30000 * 52) / 12)
    const expectedRecurring = 150000 + expectedWeekly
    const expectedSubscriptions = 1599 + Math.round(12000 / 12)

    expect(result.recurringExpenses).toBe(expectedRecurring)
    expect(result.subscriptions).toBe(expectedSubscriptions)
    expect(result.totalMonthly).toBe(expectedRecurring + expectedSubscriptions)
  })

  it('only queries active EXPENSE recurring rules and active subscriptions', async () => {
    prismaMock.recurringRule.findMany.mockResolvedValue([])
    prismaMock.subscription.findMany.mockResolvedValue([])

    await getCostFloor()

    expect(prismaMock.recurringRule.findMany).toHaveBeenCalledWith({
      where: { isActive: true, type: 'EXPENSE' },
    })
    expect(prismaMock.subscription.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
    })
  })

  it('treats a negative EXPENSE amount as a positive monthly cost', async () => {
    prismaMock.recurringRule.findMany.mockResolvedValue([
      mockRecurringRule({ amount: -50000, frequency: 'MONTHLY', type: 'EXPENSE' }) as never,
    ])
    prismaMock.subscription.findMany.mockResolvedValue([])

    const result = await getCostFloor()

    expect(result.recurringExpenses).toBe(50000)
  })

  it('returns all zeros when there are no active recurring rules or subscriptions', async () => {
    prismaMock.recurringRule.findMany.mockResolvedValue([])
    prismaMock.subscription.findMany.mockResolvedValue([])

    const result = await getCostFloor()

    expect(result).toEqual({ recurringExpenses: 0, subscriptions: 0, totalMonthly: 0 })
  })
})

describe('getExpenseSplit', () => {
  it('classifies a transaction as fixed when its category has an active EXPENSE recurring rule', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      txWithCategory('cuid_category_rent', -150000),
    ] as never)
    prismaMock.recurringRule.findMany.mockResolvedValue([
      { categoryId: 'cuid_category_rent' },
    ] as never)
    prismaMock.subscription.findMany.mockResolvedValue([])

    const result = await getExpenseSplit(FROM, TO)

    expect(result.fixed.total).toBe(150000)
    expect(result.variable.total).toBe(0)
    expect(result.fixed.categories).toEqual([
      { categoryId: 'cuid_category_rent', categoryName: 'Category cuid_category_rent', color: '#000000', amount: 150000, percentage: 100 },
    ])
  })

  it('classifies a transaction as fixed when its category has an active subscription', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      txWithCategory('cuid_category_streaming', -1599),
    ] as never)
    prismaMock.recurringRule.findMany.mockResolvedValue([])
    prismaMock.subscription.findMany.mockResolvedValue([
      { categoryId: 'cuid_category_streaming' },
    ] as never)

    const result = await getExpenseSplit(FROM, TO)

    expect(result.fixed.total).toBe(1599)
    expect(result.variable.total).toBe(0)
  })

  it('classifies a transaction as variable when its category has no active recurring rule or subscription', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      txWithCategory('cuid_category_dining', -4500),
    ] as never)
    prismaMock.recurringRule.findMany.mockResolvedValue([])
    prismaMock.subscription.findMany.mockResolvedValue([])

    const result = await getExpenseSplit(FROM, TO)

    expect(result.fixed.total).toBe(0)
    expect(result.variable.total).toBe(4500)
  })

  it('does not treat a category as fixed from an inactive recurring rule or subscription', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      txWithCategory('cuid_category_rent', -150000),
    ] as never)
    // Simulates the query already filtering to isActive: true — an inactive rule on this
    // category would never appear in what findMany resolves to, so it stays variable.
    prismaMock.recurringRule.findMany.mockResolvedValue([])
    prismaMock.subscription.findMany.mockResolvedValue([])

    const result = await getExpenseSplit(FROM, TO)

    expect(result.variable.total).toBe(150000)
  })

  it('computes percentages relative to the combined fixed + variable total', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      txWithCategory('cuid_category_rent', -75000),
      txWithCategory('cuid_category_dining', -25000),
    ] as never)
    prismaMock.recurringRule.findMany.mockResolvedValue([{ categoryId: 'cuid_category_rent' }] as never)
    prismaMock.subscription.findMany.mockResolvedValue([])

    const result = await getExpenseSplit(FROM, TO)

    expect(result.fixed.percentage).toBe(75)
    expect(result.variable.percentage).toBe(25)
  })

  it('aggregates multiple transactions in the same category into one bucket entry', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      txWithCategory('cuid_category_dining', -2000),
      txWithCategory('cuid_category_dining', -3000),
    ] as never)
    prismaMock.recurringRule.findMany.mockResolvedValue([])
    prismaMock.subscription.findMany.mockResolvedValue([])

    const result = await getExpenseSplit(FROM, TO)

    expect(result.variable.categories).toHaveLength(1)
    expect(result.variable.categories[0].amount).toBe(5000)
  })

  it('queries transactions scoped to the given date range, non-transfer, approved, expense-only', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([])
    prismaMock.recurringRule.findMany.mockResolvedValue([])
    prismaMock.subscription.findMany.mockResolvedValue([])

    await getExpenseSplit(FROM, TO)

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          isTransfer: false,
          needsReview: false,
          date: { gte: FROM, lte: TO },
          amount: { lt: 0 },
        },
      })
    )
  })

  it('returns zeroed buckets with no categories when there are no expense transactions', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([])
    prismaMock.recurringRule.findMany.mockResolvedValue([])
    prismaMock.subscription.findMany.mockResolvedValue([])

    const result = await getExpenseSplit(FROM, TO)

    expect(result).toEqual({
      fixed: { total: 0, percentage: 0, categories: [] },
      variable: { total: 0, percentage: 0, categories: [] },
    })
  })
})

describe('getSpendingComparison', () => {
  const ANCHOR = new Date('2026-07-15T00:00:00Z')

  it('always compares full calendar months regardless of the anchor date within the month', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([])

    await getSpendingComparison(ANCHOR)

    expect(prismaMock.transaction.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          date: {
            gte: new Date('2026-07-01T00:00:00.000Z'),
            lte: new Date('2026-07-31T23:59:59.999Z'),
          },
        }),
      })
    )
    expect(prismaMock.transaction.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          date: {
            gte: new Date('2026-06-01T00:00:00.000Z'),
            lte: new Date('2026-06-30T23:59:59.999Z'),
          },
        }),
      })
    )
  })

  it('computes delta and percentChange for a category present in both periods', async () => {
    prismaMock.transaction.findMany
      .mockResolvedValueOnce([txWithCategory('cuid_category_groceries', -55000, { name: 'Groceries' })] as never)
      .mockResolvedValueOnce([txWithCategory('cuid_category_groceries', -50000, { name: 'Groceries' })] as never)

    const [result] = await getSpendingComparison(ANCHOR)

    expect(result).toEqual({
      categoryId: 'cuid_category_groceries',
      categoryName: 'Groceries',
      color: '#000000',
      currentAmount: 55000,
      priorAmount: 50000,
      delta: 5000,
      percentChange: 10,
    })
  })

  it('sets percentChange to null for a category with no spending in the prior period ("new")', async () => {
    prismaMock.transaction.findMany
      .mockResolvedValueOnce([txWithCategory('cuid_category_new', -10000, { name: 'New Thing' })] as never)
      .mockResolvedValueOnce([])

    const [result] = await getSpendingComparison(ANCHOR)

    expect(result.priorAmount).toBe(0)
    expect(result.delta).toBe(10000)
    expect(result.percentChange).toBeNull()
  })

  it('includes a category that had spending last period but none this period', async () => {
    prismaMock.transaction.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([txWithCategory('cuid_category_gone', -20000, { name: 'Gone Now' })] as never)

    const [result] = await getSpendingComparison(ANCHOR)

    expect(result.currentAmount).toBe(0)
    expect(result.priorAmount).toBe(20000)
    expect(result.delta).toBe(-20000)
    expect(result.percentChange).toBe(-100)
  })

  it('sorts results by current-period amount descending', async () => {
    prismaMock.transaction.findMany
      .mockResolvedValueOnce([
        txWithCategory('cuid_category_small', -1000, { name: 'Small' }),
        txWithCategory('cuid_category_big', -90000, { name: 'Big' }),
      ] as never)
      .mockResolvedValueOnce([])

    const result = await getSpendingComparison(ANCHOR)

    expect(result.map((r) => r.categoryName)).toEqual(['Big', 'Small'])
  })
})
