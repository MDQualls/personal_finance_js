import { postDueRecurringRules } from './recurringEngine'
import { prismaMock } from './__mocks__/prisma'
import { mockRecurringRule } from '@/__tests__/factories/recurringRule'

// Simulate prisma.$transaction calling the callback with the tx mock
function setupTransaction() {
  ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) => {
    return fn(prismaMock)
  })
}

const pastDate = new Date('2026-04-01T00:00:00Z')  // clearly in the past
const futureDate = new Date('2099-01-01T00:00:00Z')

describe('postDueRecurringRules', () => {
  it('creates a transaction for a due rule', async () => {
    setupTransaction()
    const rule = mockRecurringRule({ nextDate: pastDate })
    prismaMock.recurringRule.findMany.mockResolvedValue([rule as never])
    prismaMock.transaction.create.mockResolvedValue({} as never)
    prismaMock.recurringRule.update.mockResolvedValue({} as never)

    await postDueRecurringRules()

    expect(prismaMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: rule.accountId,
          categoryId: rule.categoryId,
          amount: rule.amount,
          description: rule.name,
        }),
      })
    )
  })

  it('increments account balance by the rule amount', async () => {
    setupTransaction()
    const rule = mockRecurringRule({ nextDate: pastDate, amount: -24037 })
    prismaMock.recurringRule.findMany.mockResolvedValue([rule as never])
    prismaMock.transaction.create.mockResolvedValue({} as never)
    prismaMock.account.update.mockResolvedValue({} as never)
    prismaMock.recurringRule.update.mockResolvedValue({} as never)

    await postDueRecurringRules()

    expect(prismaMock.account.update).toHaveBeenCalledWith({
      where: { id: rule.accountId },
      data: { balance: { increment: rule.amount } },
    })
  })

  it('advances nextDate by one frequency period after posting', async () => {
    setupTransaction()
    const rule = mockRecurringRule({ nextDate: pastDate, frequency: 'MONTHLY' })
    prismaMock.recurringRule.findMany.mockResolvedValue([rule as never])
    prismaMock.transaction.create.mockResolvedValue({} as never)
    prismaMock.recurringRule.update.mockResolvedValue({} as never)

    await postDueRecurringRules()

    expect(prismaMock.recurringRule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: rule.id },
        data: expect.objectContaining({
          nextDate: expect.any(Date),
          lastPostedAt: expect.any(Date),
        }),
      })
    )

    const updateCall = (prismaMock.recurringRule.update as jest.Mock).mock.calls[0][0]
    const advancedDate: Date = updateCall.data.nextDate
    // Monthly from 2026-04-01 should advance to 2026-05-01
    expect(advancedDate.getFullYear()).toBe(2026)
    expect(advancedDate.getMonth()).toBe(4) // May = month index 4
  })

  it('skips rules where isActive = false', async () => {
    // The query filters by isActive: true, so findMany returns empty when all inactive
    prismaMock.recurringRule.findMany.mockResolvedValue([])

    const result = await postDueRecurringRules()

    expect(result.posted).toBe(0)
    expect(prismaMock.transaction.create).not.toHaveBeenCalled()
  })

  it('skips rules where autoPost = false', async () => {
    // The query filters by autoPost: true, so findMany returns empty for manual rules
    prismaMock.recurringRule.findMany.mockResolvedValue([])

    const result = await postDueRecurringRules()

    expect(result.posted).toBe(0)
    expect(prismaMock.transaction.create).not.toHaveBeenCalled()
  })

  it('skips rules where nextDate is in the future', async () => {
    prismaMock.recurringRule.findMany.mockResolvedValue([])

    const result = await postDueRecurringRules()

    expect(result.posted).toBe(0)
    expect(prismaMock.transaction.create).not.toHaveBeenCalled()
  })

  it('filters query by isActive, autoPost, and nextDate lte today', async () => {
    prismaMock.recurringRule.findMany.mockResolvedValue([])

    await postDueRecurringRules()

    expect(prismaMock.recurringRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          autoPost: true,
          nextDate: expect.objectContaining({ lte: expect.any(Date) }),
        }),
      })
    )
  })

  it('reports errors without stopping other rules from posting', async () => {
    setupTransaction()
    const failingRule = mockRecurringRule({ id: 'rule_fail', name: 'Failing Rule', nextDate: pastDate })
    const successRule = mockRecurringRule({ id: 'rule_ok', name: 'OK Rule', nextDate: pastDate })

    prismaMock.recurringRule.findMany.mockResolvedValue([failingRule, successRule] as never)

    let callCount = 0
    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) => {
      callCount++
      if (callCount === 1) throw new Error('DB error')
      return fn(prismaMock)
    })

    prismaMock.transaction.create.mockResolvedValue({} as never)
    prismaMock.recurringRule.update.mockResolvedValue({} as never)

    const result = await postDueRecurringRules()

    expect(result.posted).toBe(1)
    expect(result.skipped).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('Failing Rule')
  })

  it('returns correct posted and skipped counts', async () => {
    setupTransaction()
    const rules = [
      mockRecurringRule({ id: 'r1', nextDate: pastDate }),
      mockRecurringRule({ id: 'r2', nextDate: pastDate }),
    ]
    prismaMock.recurringRule.findMany.mockResolvedValue(rules as never)
    prismaMock.transaction.create.mockResolvedValue({} as never)
    prismaMock.recurringRule.update.mockResolvedValue({} as never)

    const result = await postDueRecurringRules()

    expect(result.posted).toBe(2)
    expect(result.skipped).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  it('rolls back if nextDate update fails inside transaction', async () => {
    const rule = mockRecurringRule({ nextDate: pastDate })
    prismaMock.recurringRule.findMany.mockResolvedValue([rule as never])
    // Simulate transaction throwing (rollback occurs automatically with prisma.$transaction)
    ;(prismaMock.$transaction as jest.Mock).mockRejectedValue(new Error('rollback'))

    const result = await postDueRecurringRules()

    expect(result.posted).toBe(0)
    expect(result.skipped).toBe(1)
    expect(result.errors[0]).toContain(rule.name)
  })
})
