import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ConnectionMappingClient } from './ConnectionMappingClient'

export default async function ConnectionMappingPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  const item = await prisma.plaidItem.findUnique({
    where: { id: params.id },
    include: { accounts: { include: { account: true } } },
  })
  if (!item) notFound()

  const availableAccounts = await prisma.account.findMany({
    where: { isActive: true, plaidAccount: null },
    orderBy: { name: 'asc' },
  })

  return (
    <ConnectionMappingClient
      institutionName={item.institutionName}
      plaidAccounts={item.accounts.map((a) => ({
        id: a.id,
        name: a.name,
        mask: a.mask,
        type: a.type,
        subtype: a.subtype,
        accountId: a.accountId,
        linkedAccountName: a.account?.name ?? null,
      }))}
      availableAccounts={availableAccounts.map((a) => ({ id: a.id, name: a.name, type: a.type }))}
    />
  )
}
