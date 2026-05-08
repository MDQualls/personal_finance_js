import type { RecurringRule } from '@/types'

export const mockRecurringRule = (overrides: Partial<RecurringRule> = {}): RecurringRule => ({
  id: 'cuid_rule_1',
  name: 'Monthly Paycheck',
  amount: 350000, // $3,500.00
  frequency: 'MONTHLY',
  accountId: 'cuid_account_1',
  categoryId: 'cuid_category_income',
  nextDate: new Date('2026-05-01T00:00:00Z'),
  type: 'INCOME',
  isActive: true,
  autoPost: true,
  notes: null,
  lastPostedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
}) as RecurringRule
