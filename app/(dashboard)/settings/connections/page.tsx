import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ConnectionsClient } from './ConnectionsClient'

export default async function ConnectionsSettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  const items = await prisma.plaidItem.findMany({
    include: { accounts: { include: { account: true } } },
    orderBy: { createdAt: 'desc' },
  })

  // Shape explicitly — accessToken must never reach the client bundle, even via Server Component props.
  const safeItems = items.map((item) => ({
    id: item.id,
    institutionName: item.institutionName,
    lastSyncedAt: item.lastSyncedAt ? item.lastSyncedAt.toISOString() : null,
    status: item.status,
    accounts: item.accounts.map((a) => ({
      id: a.id,
      name: a.name,
      mask: a.mask,
      accountId: a.accountId,
      account: a.account ? { id: a.account.id, name: a.account.name, balance: a.account.balance } : null,
    })),
  }))

  return <ConnectionsClient items={safeItems} />
}
