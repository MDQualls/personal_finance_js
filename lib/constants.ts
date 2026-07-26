// Seeded system category ids (prisma/seed.ts's `system_${name}` slug scheme).
// Single source of truth — these were previously redefined independently in 5
// different files with no compiler error if one drifted from the others.
export const SYSTEM_TRANSFERS_CATEGORY_ID = 'system_transfers'
export const SYSTEM_UNCATEGORIZED_CATEGORY_ID = 'system_uncategorized'
