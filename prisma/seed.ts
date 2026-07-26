import { PrismaClient } from '@prisma/client'
import { SYSTEM_CATEGORIES, SUBCATEGORIES } from './systemCategories'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding system categories...')

  for (const cat of SYSTEM_CATEGORIES) {
    // A category with this name may already exist under a different (e.g. manually
    // created, non-system) id — the DB enforces one top-level category name via a
    // partial unique index, so upserting blindly by our own id scheme would collide.
    // If the name already exists, leave that row as-is rather than erroring out.
    const existing = await prisma.category.findFirst({
      where: { name: { equals: cat.name, mode: 'insensitive' }, parentId: null },
    })
    const created =
      existing ??
      (await prisma.category.upsert({
        where: { id: `system_${cat.name.toLowerCase().replace(/[^a-z]/g, '_')}` },
        update: {},
        create: {
          id: `system_${cat.name.toLowerCase().replace(/[^a-z]/g, '_')}`,
          name: cat.name,
          color: cat.color,
          icon: cat.icon,
          isIncome: cat.isIncome,
          isSystem: cat.isSystem,
          isSavings: cat.isSavings,
          isActive: true,
        },
      }))

    const subs = SUBCATEGORIES[cat.name]
    if (subs) {
      for (const sub of subs) {
        const existingSub = await prisma.category.findFirst({
          where: { name: { equals: sub.name, mode: 'insensitive' }, parentId: created.id },
        })
        if (existingSub) continue

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
