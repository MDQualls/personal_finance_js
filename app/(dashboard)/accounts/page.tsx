import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AccountsClient } from './AccountsClient'

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHECKING: 'Checking',
  SAVINGS: 'Savings',
  CREDIT_CARD: 'Credit Card',
  LOAN: 'Loan',
  INVESTMENT: 'Investment',
  ASSET: 'Asset',
  LIABILITY: 'Liability',
}

const ACCOUNT_TYPE_ORDER = [
  'CHECKING', 'SAVINGS', 'INVESTMENT', 'CREDIT_CARD', 'LOAN', 'ASSET', 'LIABILITY',
]

export default async function AccountsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  })

  const netWorth = accounts.reduce((sum, a) => {
    if (['CHECKING', 'SAVINGS', 'INVESTMENT', 'ASSET'].includes(a.type)) return sum + a.balance
    if (['CREDIT_CARD', 'LOAN', 'LIABILITY'].includes(a.type)) return sum - Math.abs(a.balance)
    return sum
  }, 0)

  const groups: Record<string, typeof accounts> = {}
  for (const account of accounts) {
    if (!groups[account.type]) groups[account.type] = []
    groups[account.type].push(account)
  }

  const sortedGroups = ACCOUNT_TYPE_ORDER
    .filter((type) => groups[type]?.length)
    .map((type) => ({ type, label: ACCOUNT_TYPE_LABELS[type], accounts: groups[type] }))

  return (
    <AccountsClient
      groups={sortedGroups}
      netWorth={netWorth}
    />
  )
}
