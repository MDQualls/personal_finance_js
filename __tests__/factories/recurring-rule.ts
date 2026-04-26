import type { RecurringRule } from '@prisma/client'

let counter = 0

export function mockRecurringRule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  counter++
  return {
    id: `cuid_rule_${counter}`,
    name: `Test Rule ${counter}`,
    amount: 300000, // $3,000.00 — e.g. monthly income
    frequency: 'MONTHLY',
    accountId: 'cuid_account_1',
    categoryId: 'cuid_category_1',
    nextDate: new Date('2026-05-01T00:00:00Z'),
    type: 'INCOME',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}
