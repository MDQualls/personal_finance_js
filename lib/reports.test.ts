import { getCostFloor } from './reports'
import { prismaMock } from './__mocks__/prisma'
import { mockRecurringRule } from '@/__tests__/factories/recurringRule'
import { mockSubscription } from '@/__tests__/factories/subscription'

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
