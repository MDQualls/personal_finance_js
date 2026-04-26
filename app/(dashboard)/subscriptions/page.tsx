import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { monthlyEquivalent, annualEquivalent } from '@/lib/money'
import { SubscriptionsClient } from './SubscriptionsClient'

export default async function SubscriptionsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  const [subscriptions, categories] = await Promise.all([
    prisma.subscription.findMany({
      include: { category: true },
      orderBy: { nextDueDate: 'asc' },
    }),
    prisma.category.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
  ])

  const enriched = subscriptions.map((s) => ({
    ...s,
    monthlyEquivalent: monthlyEquivalent(s.amount, s.frequency),
  }))

  const active = enriched.filter((s) => s.isActive)
  const totalMonthly = active.reduce((sum, s) => sum + s.monthlyEquivalent, 0)
  const totalAnnual = active.reduce((sum, s) => sum + annualEquivalent(s.amount, s.frequency), 0)

  return (
    <SubscriptionsClient
      subscriptions={enriched}
      categories={categories}
      totalMonthly={totalMonthly}
      totalAnnual={totalAnnual}
    />
  )
}
