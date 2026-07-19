import type { PlaidAccount } from '@prisma/client'

let counter = 0

export function mockPlaidAccount(overrides: Partial<PlaidAccount> = {}): PlaidAccount {
  counter++
  return {
    id: `cuid_plaid_account_${counter}`,
    plaidItemId: 'cuid_plaid_item_1',
    plaidAccountId: `plaid_acct_${counter}`,
    accountId: null,
    name: 'Test Checking',
    mask: '1234',
    officialName: null,
    type: 'depository',
    subtype: 'checking',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}
