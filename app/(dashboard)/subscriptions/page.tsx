import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { monthlyEquivalent, annualEquivalent } from '@/lib/money'
import { addFrequency } from '@/lib/dates'
import type { Frequency } from '@/lib/dates'
import { SubscriptionsClient } from './SubscriptionsClient'

// Advance a past nextDueDate forward by its frequency until it lands in the future.
// No transaction is created — subscriptions are reference-only tracking.
// Uses UTC calendar days throughout to avoid timezone drift in Docker (which runs UTC).
function advanceToNextOccurrence(nextDueDate: Date, frequency: Frequency): Date {
  const todayUTC = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
  let date = new Date(nextDueDate)
  while (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) < todayUTC) {
    date = addFrequency(date, frequency)
  }
  return date
}

export default async function SubscriptionsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  const [subscriptions, categories] = await Promise.all([
    prisma.subscription.findMany({
      include: { category: true },
      orderBy: { nextDueDate: 'asc' },
    }),
    prisma.category.findMany({
      where: { isActive: true, parentId: null },
      include: { children: { where: { isActive: true }, orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    }),
  ])

  // Auto-advance overdue active subscriptions and persist the updated dates.
  const todayUTC = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
  const overdueActive = subscriptions.filter((s) => {
    if (!s.isActive) return false
    const dueUTC = Date.UTC(s.nextDueDate.getUTCFullYear(), s.nextDueDate.getUTCMonth(), s.nextDueDate.getUTCDate())
    return dueUTC < todayUTC
  })
  if (overdueActive.length > 0) {
    await Promise.all(
      overdueActive.map((s) => {
        const advanced = advanceToNextOccurrence(s.nextDueDate, s.frequency as Frequency)
        s.nextDueDate = advanced  // mutate in place so enriched picks up the new date
        return prisma.subscription.update({
          where: { id: s.id },
          data: { nextDueDate: advanced },
        })
      })
    )
  }

  const enriched = subscriptions
    .map((s) => ({
      ...s,
      monthlyEquivalent: monthlyEquivalent(s.amount, s.frequency),
    }))
    .sort((a, b) => a.nextDueDate.getTime() - b.nextDueDate.getTime())

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
