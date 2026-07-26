import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { computeNetWorth } from '@/lib/reports'
import { AccountsClient } from './AccountsClient'

export default async function AccountsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  const accounts = await prisma.account.findMany({
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  })

  const { netWorth } = computeNetWorth(accounts.filter((a) => a.isActive))

  return <AccountsClient accounts={accounts} netWorth={netWorth} />
}
