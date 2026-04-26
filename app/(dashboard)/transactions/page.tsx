import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TransactionsClient } from './TransactionsClient'

export default async function TransactionsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  const [accounts, categories, tags] = await Promise.all([
    prisma.account.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.category.findMany({
      where: { isActive: true, parentId: null },
      include: { children: { where: { isActive: true }, orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    }),
    prisma.tag.findMany({ orderBy: { name: 'asc' } }),
  ])

  return <TransactionsClient accounts={accounts} categories={categories} tags={tags} />
}
