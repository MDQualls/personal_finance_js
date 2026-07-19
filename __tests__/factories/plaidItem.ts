import type { PlaidItem } from '@prisma/client'

let counter = 0

export function mockPlaidItem(overrides: Partial<PlaidItem> = {}): PlaidItem {
  counter++
  return {
    id: `cuid_plaid_item_${counter}`,
    accessToken: 'iv_base64:tag_base64:encrypted_base64',
    itemId: `plaid_item_id_${counter}`,
    institutionId: 'ins_1',
    institutionName: 'Test Bank',
    lastSyncedAt: null,
    lastCursor: null,
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}
