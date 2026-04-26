import type { Account } from '@prisma/client'

let counter = 0

export function mockAccount(overrides: Partial<Account> = {}): Account {
  counter++
  return {
    id: `cuid_account_${counter}`,
    name: `Test Account ${counter}`,
    type: 'CHECKING',
    balance: 100000, // $1,000.00
    currency: 'USD',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}
