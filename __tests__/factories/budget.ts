import type { Budget } from '@prisma/client'

let counter = 0

export function mockBudget(overrides: Partial<Budget> = {}): Budget {
  counter++
  return {
    id: `cuid_budget_${counter}`,
    categoryId: 'cuid_category_1',
    amount: 50000, // $500.00
    period: 'MONTHLY',
    startDate: new Date('2026-04-01T00:00:00Z'),
    rollover: false,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}
