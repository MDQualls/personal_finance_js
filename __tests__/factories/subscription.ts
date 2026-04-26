import type { Subscription } from '@prisma/client'

let counter = 0

export function mockSubscription(overrides: Partial<Subscription> = {}): Subscription {
  counter++
  return {
    id: `cuid_subscription_${counter}`,
    name: `Test Subscription ${counter}`,
    amount: 1499, // $14.99
    frequency: 'MONTHLY',
    nextDueDate: new Date('2026-05-01T00:00:00Z'),
    categoryId: 'cuid_category_1',
    notes: null,
    isActive: true,
    alertDays: 3,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}
