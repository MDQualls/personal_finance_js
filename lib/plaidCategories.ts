// Maps Plaid's personal_finance_category.primary values (its 16-value taxonomy) to the
// local Category names seeded in prisma/seed.ts. Primary values with no reasonable local
// equivalent (LOAN_PAYMENTS, BANK_FEES, GENERAL_SERVICES, GOVERNMENT_AND_NON_PROFIT) are
// deliberately omitted — they fall back to Uncategorized in the sync route rather than
// being forced into a misleading bucket. Expand this map as real transaction categories
// are observed from connected banks.
export const PLAID_CATEGORY_MAP: Record<string, string> = {
  INCOME: 'Income',
  TRANSFER_IN: 'Transfers',
  TRANSFER_OUT: 'Transfers',
  ENTERTAINMENT: 'Entertainment',
  FOOD_AND_DRINK: 'Food & Dining',
  GENERAL_MERCHANDISE: 'Shopping',
  HOME_IMPROVEMENT: 'Housing',
  MEDICAL: 'Health & Medical',
  PERSONAL_CARE: 'Personal Care',
  TRANSPORTATION: 'Transportation',
  TRAVEL: 'Travel',
  RENT_AND_UTILITIES: 'Housing',
}
