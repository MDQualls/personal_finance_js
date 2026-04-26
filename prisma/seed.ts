import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SYSTEM_CATEGORIES = [
  // Income
  { name: 'Income', color: '#22c55e', icon: 'trending-up', isIncome: true, isSystem: true },

  // Housing
  { name: 'Housing', color: '#6366f1', icon: 'home', isIncome: false, isSystem: true },

  // Food
  { name: 'Food & Dining', color: '#f59e0b', icon: 'utensils', isIncome: false, isSystem: true },

  // Transport
  { name: 'Transportation', color: '#3b82f6', icon: 'car', isIncome: false, isSystem: true },

  // Health
  { name: 'Health & Medical', color: '#ef4444', icon: 'heart', isIncome: false, isSystem: true },

  // Entertainment
  { name: 'Entertainment', color: '#8b5cf6', icon: 'film', isIncome: false, isSystem: true },

  // Shopping
  { name: 'Shopping', color: '#ec4899', icon: 'shopping-bag', isIncome: false, isSystem: true },

  // Utilities
  { name: 'Utilities', color: '#14b8a6', icon: 'zap', isIncome: false, isSystem: true },

  // Subscriptions
  { name: 'Subscriptions', color: '#00b89c', icon: 'repeat', isIncome: false, isSystem: true },

  // Education
  { name: 'Education', color: '#f97316', icon: 'book', isIncome: false, isSystem: true },

  // Travel
  { name: 'Travel', color: '#06b6d4', icon: 'plane', isIncome: false, isSystem: true },

  // Personal Care
  { name: 'Personal Care', color: '#a855f7', icon: 'smile', isIncome: false, isSystem: true },

  // Savings & Investments
  { name: 'Savings & Investments', color: '#10b981', icon: 'piggy-bank', isIncome: false, isSystem: true },

  // Transfers
  { name: 'Transfers', color: '#64748b', icon: 'arrow-right-left', isIncome: false, isSystem: true },

  // Uncategorized
  { name: 'Uncategorized', color: '#9ca3af', icon: 'help-circle', isIncome: false, isSystem: true },
]

const SUBCATEGORIES: Record<string, { name: string; color: string; icon: string; isIncome: boolean }[]> = {
  'Income': [
    { name: 'Salary', color: '#22c55e', icon: 'briefcase', isIncome: true },
    { name: 'Freelance', color: '#4ade80', icon: 'laptop', isIncome: true },
    { name: 'Investment Returns', color: '#86efac', icon: 'trending-up', isIncome: true },
    { name: 'Other Income', color: '#bbf7d0', icon: 'plus-circle', isIncome: true },
  ],
  'Housing': [
    { name: 'Rent / Mortgage', color: '#6366f1', icon: 'home', isIncome: false },
    { name: 'Property Tax', color: '#818cf8', icon: 'file-text', isIncome: false },
    { name: 'Home Insurance', color: '#a5b4fc', icon: 'shield', isIncome: false },
    { name: 'Repairs & Maintenance', color: '#c7d2fe', icon: 'wrench', isIncome: false },
  ],
  'Food & Dining': [
    { name: 'Groceries', color: '#f59e0b', icon: 'shopping-cart', isIncome: false },
    { name: 'Dining Out', color: '#fbbf24', icon: 'utensils', isIncome: false },
    { name: 'Coffee & Drinks', color: '#fcd34d', icon: 'coffee', isIncome: false },
    { name: 'Delivery & Takeout', color: '#fde68a', icon: 'package', isIncome: false },
  ],
  'Transportation': [
    { name: 'Gas & Fuel', color: '#3b82f6', icon: 'fuel', isIncome: false },
    { name: 'Public Transit', color: '#60a5fa', icon: 'bus', isIncome: false },
    { name: 'Parking', color: '#93c5fd', icon: 'map-pin', isIncome: false },
    { name: 'Car Insurance', color: '#bfdbfe', icon: 'shield', isIncome: false },
    { name: 'Car Maintenance', color: '#dbeafe', icon: 'tool', isIncome: false },
    { name: 'Rideshare', color: '#eff6ff', icon: 'car', isIncome: false },
  ],
}

async function main() {
  console.log('Seeding system categories...')

  for (const cat of SYSTEM_CATEGORIES) {
    const created = await prisma.category.upsert({
      where: { id: `system_${cat.name.toLowerCase().replace(/[^a-z]/g, '_')}` },
      update: {},
      create: {
        id: `system_${cat.name.toLowerCase().replace(/[^a-z]/g, '_')}`,
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        isIncome: cat.isIncome,
        isSystem: cat.isSystem,
        isActive: true,
      },
    })

    const subs = SUBCATEGORIES[cat.name]
    if (subs) {
      for (const sub of subs) {
        await prisma.category.upsert({
          where: {
            id: `system_${created.name.toLowerCase().replace(/[^a-z]/g, '_')}_${sub.name.toLowerCase().replace(/[^a-z]/g, '_')}`,
          },
          update: {},
          create: {
            id: `system_${created.name.toLowerCase().replace(/[^a-z]/g, '_')}_${sub.name.toLowerCase().replace(/[^a-z]/g, '_')}`,
            name: sub.name,
            parentId: created.id,
            color: sub.color,
            icon: sub.icon,
            isIncome: sub.isIncome,
            isSystem: true,
            isActive: true,
          },
        })
      }
    }
  }

  console.log('Seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
