import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { RulesClient } from './RulesClient'

export default async function RulesSettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  const [rules, categoryTree, merchantRules] = await Promise.all([
    prisma.autoRule.findMany({ orderBy: { priority: 'asc' } }),
    prisma.category.findMany({
      where: { isActive: true, parentId: null },
      include: { children: { where: { isActive: true }, orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    }),
    prisma.merchantRule.findMany({ orderBy: { createdAt: 'asc' } }),
  ])

  const categories = categoryTree.flatMap((cat) => [
    { id: cat.id, name: cat.name },
    ...cat.children.map((sub) => ({ id: sub.id, name: sub.name })),
  ])

  return <RulesClient rules={rules} categories={categories} merchantRules={merchantRules} />
}
