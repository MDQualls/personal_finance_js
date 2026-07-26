import { PLAID_CATEGORY_MAP } from './plaidCategories'
import { SYSTEM_CATEGORIES } from '@/prisma/systemCategories'

describe('PLAID_CATEGORY_MAP', () => {
  const seededNames = new Set(SYSTEM_CATEGORIES.map((c) => c.name))

  it('every mapped category name exists in prisma/seed.ts', () => {
    // Regression guard: BANK_FEES → 'Bank Fee' was added to this map without a
    // matching seed entry, so resolveCategoryId() in app/api/plaid/sync/route.ts
    // silently fell back to Uncategorized on any fresh/re-seeded database. This
    // test fails loudly the next time a map value drifts from seed data instead
    // of only surfacing as a mysterious miscategorization months later.
    for (const [plaidKey, categoryName] of Object.entries(PLAID_CATEGORY_MAP)) {
      expect(seededNames.has(categoryName)).toBe(true)
      // Not a real assertion — just gives a useful failure message with the key
      if (!seededNames.has(categoryName)) {
        throw new Error(`PLAID_CATEGORY_MAP.${plaidKey} → '${categoryName}' has no matching seeded category`)
      }
    }
  })

  it('maps income correctly', () => {
    expect(PLAID_CATEGORY_MAP.INCOME).toBe('Income')
  })

  it('maps both transfer directions to Transfers', () => {
    expect(PLAID_CATEGORY_MAP.TRANSFER_IN).toBe('Transfers')
    expect(PLAID_CATEGORY_MAP.TRANSFER_OUT).toBe('Transfers')
  })

  it('maps bank fees to the Bank Fee category', () => {
    expect(PLAID_CATEGORY_MAP.BANK_FEES).toBe('Bank Fee')
  })

  it('deliberately omits categories with no reasonable local equivalent', () => {
    expect(PLAID_CATEGORY_MAP.LOAN_PAYMENTS).toBeUndefined()
    expect(PLAID_CATEGORY_MAP.GENERAL_SERVICES).toBeUndefined()
    expect(PLAID_CATEGORY_MAP.GOVERNMENT_AND_NON_PROFIT).toBeUndefined()
  })

  it('has no empty-string values', () => {
    for (const value of Object.values(PLAID_CATEGORY_MAP)) {
      expect(value.length).toBeGreaterThan(0)
    }
  })
})
