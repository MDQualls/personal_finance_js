import { projectBalance } from './projection'

function daysFromNow(n: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + n)
  return d
}

describe('projectBalance', () => {
  it('returns one entry per day for the given window', () => {
    const result = projectBalance(100000, [], [], 30)
    expect(result).toHaveLength(31) // today + 30 days
  })

  it('starts at the given balance with no rules', () => {
    const result = projectBalance(50000, [], [], 7)
    expect(result[0].balance).toBe(50000)
    expect(result[7].balance).toBe(50000)
  })

  it('marks days with negative balance as belowZero', () => {
    const result = projectBalance(-1000, [], [], 3)
    expect(result[0].belowZero).toBe(true)
    expect(result[1].belowZero).toBe(true)
  })

  it('marks positive balance days as not belowZero', () => {
    const result = projectBalance(100000, [], [], 3)
    expect(result[0].belowZero).toBe(false)
  })

  it('applies an income rule on its next date', () => {
    const nextDate = daysFromNow(3)
    const result = projectBalance(
      10000,
      [{ name: 'Paycheck', amount: 200000, frequency: 'MONTHLY', nextDate, type: 'INCOME' }],
      [],
      7
    )
    expect(result[2].balance).toBe(10000) // day before
    expect(result[3].balance).toBe(210000) // day of
  })

  it('applies an expense rule on its next date', () => {
    const nextDate = daysFromNow(2)
    const result = projectBalance(
      50000,
      [{ name: 'Rent', amount: 150000, frequency: 'MONTHLY', nextDate, type: 'EXPENSE' }],
      [],
      7
    )
    expect(result[1].balance).toBe(50000)
    expect(result[2].balance).toBe(-100000)
    expect(result[2].belowZero).toBe(true)
  })

  it('applies a subscription as an expense', () => {
    const nextDueDate = daysFromNow(1)
    const result = projectBalance(
      10000,
      [],
      [{ name: 'Netflix', amount: 1799, frequency: 'MONTHLY', nextDueDate, isActive: true }],
      7
    )
    expect(result[0].balance).toBe(10000)
    expect(result[1].balance).toBe(10000 - 1799)
  })

  it('skips inactive subscriptions', () => {
    const nextDueDate = daysFromNow(1)
    const result = projectBalance(
      10000,
      [],
      [{ name: 'Old Sub', amount: 5000, frequency: 'MONTHLY', nextDueDate, isActive: false }],
      7
    )
    expect(result[1].balance).toBe(10000)
  })

  it('applies weekly rules every 7 days', () => {
    const nextDate = daysFromNow(0)
    const result = projectBalance(
      0,
      [{ name: 'Weekly Paycheck', amount: 100000, frequency: 'WEEKLY', nextDate, type: 'INCOME' }],
      [],
      14
    )
    // Day 0: +100000, Day 7: +100000
    expect(result[0].balance).toBe(100000)
    expect(result[7].balance).toBe(200000)
  })

  it('applies biweekly rules every 14 days', () => {
    const nextDate = daysFromNow(0)
    const result = projectBalance(
      0,
      [{ name: 'Biweekly Pay', amount: 200000, frequency: 'BIWEEKLY', nextDate, type: 'INCOME' }],
      [],
      28
    )
    expect(result[0].balance).toBe(200000)
    expect(result[7].balance).toBe(200000) // no event on day 7
    expect(result[14].balance).toBe(400000) // event on day 14
  })

  it('accumulates multiple events on the same day', () => {
    const nextDate = daysFromNow(2)
    const result = projectBalance(
      10000,
      [
        { name: 'Rule A', amount: 5000, frequency: 'MONTHLY', nextDate, type: 'INCOME' },
        { name: 'Rule B', amount: 3000, frequency: 'MONTHLY', nextDate, type: 'EXPENSE' },
      ],
      [],
      5
    )
    expect(result[2].balance).toBe(10000 + 5000 - 3000)
    expect(result[2].events).toHaveLength(2)
  })

  it('balance crosses zero mid-period correctly', () => {
    const sub1 = daysFromNow(1)
    const sub2 = daysFromNow(3)
    const result = projectBalance(
      5000,
      [],
      [
        { name: 'Sub1', amount: 3000, frequency: 'MONTHLY', nextDueDate: sub1, isActive: true },
        { name: 'Sub2', amount: 5000, frequency: 'MONTHLY', nextDueDate: sub2, isActive: true },
      ],
      5
    )
    expect(result[1].balance).toBe(2000) // 5000 - 3000
    expect(result[1].belowZero).toBe(false)
    expect(result[3].balance).toBe(-3000) // 2000 - 5000
    expect(result[3].belowZero).toBe(true)
  })

  it('handles zero starting balance', () => {
    const result = projectBalance(0, [], [], 3)
    expect(result[0].balance).toBe(0)
    expect(result[0].belowZero).toBe(false)
  })

  it('handles negative starting balance', () => {
    const result = projectBalance(-5000, [], [], 3)
    expect(result[0].belowZero).toBe(true)
  })

  it('returns empty events array when no events on a day', () => {
    const result = projectBalance(10000, [], [], 3)
    expect(result[0].events).toHaveLength(0)
  })
})
