import { getBudgetAlerts, getUpcomingSubscriptionAlerts, getLargeTransactionAlerts } from './alerts'

describe('getBudgetAlerts', () => {
  it('returns no alerts when all budgets are under 80%', () => {
    const budgets = [
      { id: '1', amount: 10000, spent: 7000, category: { name: 'Food' } },
    ]
    expect(getBudgetAlerts(budgets)).toHaveLength(0)
  })

  it('returns budget_warning when 80-99% spent', () => {
    const budgets = [
      { id: '1', amount: 10000, spent: 8500, category: { name: 'Food' } },
    ]
    const alerts = getBudgetAlerts(budgets)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].type).toBe('budget_warning')
    expect(alerts[0].categoryName).toBe('Food')
    expect(alerts[0].percentage).toBeCloseTo(85)
  })

  it('returns budget_over when 100%+ spent', () => {
    const budgets = [
      { id: '1', amount: 10000, spent: 12000, category: { name: 'Transport' } },
    ]
    const alerts = getBudgetAlerts(budgets)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].type).toBe('budget_over')
    expect(alerts[0].percentage).toBeCloseTo(120)
  })

  it('returns budget_over at exactly 100%', () => {
    const budgets = [
      { id: '1', amount: 10000, spent: 10000, category: { name: 'Transport' } },
    ]
    const alerts = getBudgetAlerts(budgets)
    expect(alerts[0].type).toBe('budget_over')
  })

  it('skips budgets with zero amount', () => {
    const budgets = [
      { id: '1', amount: 0, spent: 5000, category: { name: 'Food' } },
    ]
    expect(getBudgetAlerts(budgets)).toHaveLength(0)
  })

  it('returns alerts for multiple budgets', () => {
    const budgets = [
      { id: '1', amount: 10000, spent: 9000, category: { name: 'Food' } },   // 90% — warning
      { id: '2', amount: 5000, spent: 2000, category: { name: 'Gas' } },    // 40% — ok
      { id: '3', amount: 3000, spent: 3500, category: { name: 'Dining' } }, // 117% — over
    ]
    const alerts = getBudgetAlerts(budgets)
    expect(alerts).toHaveLength(2)
    expect(alerts.find((a) => a.budgetId === '1')?.type).toBe('budget_warning')
    expect(alerts.find((a) => a.budgetId === '3')?.type).toBe('budget_over')
  })
})

describe('getUpcomingSubscriptionAlerts', () => {
  function makeSubscription(overrides: {
    nextDueDate?: Date
    isActive?: boolean
    alertDays?: number
  }) {
    const nextDueDate = overrides.nextDueDate ?? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    return {
      id: '1',
      name: 'Netflix',
      amount: 1799,
      nextDueDate,
      isActive: overrides.isActive ?? true,
      alertDays: overrides.alertDays ?? 3,
    }
  }

  it('returns alert for subscription due within alertDays', () => {
    const sub = makeSubscription({ nextDueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) })
    const alerts = getUpcomingSubscriptionAlerts([sub])
    expect(alerts).toHaveLength(1)
    expect(alerts[0].type).toBe('subscription_due')
    expect(alerts[0].name).toBe('Netflix')
  })

  it('returns no alert for subscription due beyond alertDays', () => {
    const sub = makeSubscription({ nextDueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) })
    expect(getUpcomingSubscriptionAlerts([sub])).toHaveLength(0)
  })

  it('skips inactive subscriptions', () => {
    const sub = makeSubscription({ isActive: false })
    expect(getUpcomingSubscriptionAlerts([sub])).toHaveLength(0)
  })

  it('uses daysAheadOverride when provided', () => {
    const sub = makeSubscription({ nextDueDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000), alertDays: 3 })
    const alertsWith3 = getUpcomingSubscriptionAlerts([sub], 3)
    const alertsWith10 = getUpcomingSubscriptionAlerts([sub], 10)
    expect(alertsWith3).toHaveLength(0)
    expect(alertsWith10).toHaveLength(1)
  })

  it('skips overdue subscriptions', () => {
    const sub = makeSubscription({ nextDueDate: new Date('2020-01-01') })
    expect(getUpcomingSubscriptionAlerts([sub])).toHaveLength(0)
  })
})

describe('getLargeTransactionAlerts', () => {
  const transactions = [
    { id: '1', description: 'Small coffee', amount: -500 },
    { id: '2', description: 'Big purchase', amount: -25000 },
    { id: '3', description: 'Refund', amount: 15000 },
  ]

  it('flags transactions above threshold', () => {
    const alerts = getLargeTransactionAlerts(transactions, 10000)
    expect(alerts).toHaveLength(2)
    expect(alerts.map((a) => a.transactionId)).toContain('2')
    expect(alerts.map((a) => a.transactionId)).toContain('3')
  })

  it('does not flag transactions below threshold', () => {
    const alerts = getLargeTransactionAlerts(transactions, 30000)
    expect(alerts).toHaveLength(0)
  })

  it('includes correct threshold in alert', () => {
    const alerts = getLargeTransactionAlerts([transactions[1]], 10000)
    expect(alerts[0].threshold).toBe(10000)
    expect(alerts[0].type).toBe('large_transaction')
  })

  it('flags by absolute value (positive amounts too)', () => {
    const alerts = getLargeTransactionAlerts([{ id: '1', description: 'Paycheck', amount: 500000 }], 100000)
    expect(alerts).toHaveLength(1)
  })

  it('returns empty array when no transactions exceed threshold', () => {
    expect(getLargeTransactionAlerts([], 1000)).toHaveLength(0)
  })
})
