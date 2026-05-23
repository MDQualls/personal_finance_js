import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { projectBalance } from '@/lib/projection'
import { CashFlowClient } from './CashFlowClient'

const VALID_WINDOWS = [30, 60, 90] as const
type Window = typeof VALID_WINDOWS[number]

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: { days?: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  const raw = parseInt(searchParams.days ?? '30', 10)
  const days: Window = (VALID_WINDOWS as readonly number[]).includes(raw) ? (raw as Window) : 30

  const [accounts, recurringRules, subscriptions] = await Promise.all([
    prisma.account.findMany({ where: { isActive: true } }),
    prisma.recurringRule.findMany(),
    prisma.subscription.findMany({ where: { isActive: true } }),
  ])

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0)

  const data = projectBalance(
    totalBalance,
    recurringRules.map((r) => ({
      name: r.name,
      amount: r.amount,
      frequency: r.frequency,
      nextDate: r.nextDate,
      type: r.type,
    })),
    subscriptions.map((s) => ({
      name: s.name,
      amount: s.amount,
      frequency: s.frequency,
      nextDueDate: s.nextDueDate,
      isActive: s.isActive,
    })),
    days
  )

  return (
    <CashFlowClient
      data={data}
      days={days}
      accounts={accounts.map((a) => ({ name: a.name, balance: a.balance }))}
    />
  )
}
