import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CategoriesClient } from './CategoriesClient'

export default async function CategoriesSettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  const categories = await prisma.category.findMany({
    where: { isActive: true, parentId: null },
    include: { children: { where: { isActive: true }, orderBy: { name: 'asc' } } },
    orderBy: { name: 'asc' },
  })

  return <CategoriesClient categories={categories} />
}
