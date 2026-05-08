import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AccountsClient } from './AccountsClient'

export default async function AccountsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  const accounts = await prisma.account.findMany({
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  })

  const netWorth = accounts
    .filter((a) => a.isActive)
    .reduce((sum, a) => {
      if (['CHECKING', 'SAVINGS', 'INVESTMENT', 'ASSET'].includes(a.type)) return sum + a.balance
      if (['CREDIT_CARD', 'LOAN', 'LIABILITY'].includes(a.type)) return sum - Math.abs(a.balance)
      return sum
    }, 0)

  return <AccountsClient accounts={accounts} netWorth={netWorth} />
}
