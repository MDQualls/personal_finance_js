import type { Transaction } from '@prisma/client'

let counter = 0

export function mockTransaction(overrides: Partial<Transaction> = {}): Transaction {
  counter++
  return {
    id: `cuid_transaction_${counter}`,
    accountId: 'cuid_account_1',
    amount: -4500, // -$45.00
    date: new Date('2026-04-01T00:00:00Z'),
    categoryId: 'cuid_category_1',
    description: `MERCHANT ${counter}`,
    notes: null,
    deletedAt: null,
    createdAt: new Date('2026-04-01T00:00:00Z'),
    updatedAt: new Date('2026-04-01T00:00:00Z'),
    ...overrides,
  }
}
