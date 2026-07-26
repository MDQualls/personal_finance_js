import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ImportClient } from './ImportClient'

export default async function ImportPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  })

  return <ImportClient accounts={accounts} />
}
