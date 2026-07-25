// Maps Plaid's personal_finance_category.primary values (its 16-value taxonomy) to the
// local Category names seeded in prisma/seed.ts. Primary values with no reasonable local
// equivalent (LOAN_PAYMENTS, GENERAL_SERVICES, GOVERNMENT_AND_NON_PROFIT) are deliberately
// omitted — they fall back to Uncategorized in the sync route rather than being forced into
// a misleading bucket. Expand this map as real transaction categories are observed from
// connected banks.
//
// BANK_FEES was added after Phase 10 review: real synced "WIRE FEE" transactions landed in
// Uncategorized and had to be manually recategorized to the existing "Bank Fee" category
// every time — a genuine repeated pattern, not a one-off.
export const PLAID_CATEGORY_MAP: Record<string, string> = {
  INCOME: 'Income',
  TRANSFER_IN: 'Transfers',
  TRANSFER_OUT: 'Transfers',
  BANK_FEES: 'Bank Fee',
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
