import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { monthlyEquivalent } from '@/lib/money'
import { RecurringClient } from './RecurringClient'

export default async function RecurringPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  const [rules, accounts, categories] = await Promise.all([
    prisma.recurringRule.findMany({
      where: { isActive: true },
      include: { account: true, category: true },
      orderBy: { nextDate: 'asc' },
    }),
    prisma.account.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.category.findMany({
      where: { isActive: true, parentId: null },
      include: { children: { where: { isActive: true }, orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    }),
  ])

  const enriched = rules.map((r) => ({
    ...r,
    monthlyEquivalent: monthlyEquivalent(Math.abs(r.amount), r.frequency),
  }))

  const income = enriched.filter((r) => r.type === 'INCOME')
  const expenses = enriched.filter((r) => r.type === 'EXPENSE')

  const monthlyIncome = income.reduce((sum, r) => sum + r.monthlyEquivalent, 0)
  const monthlyExpenses = expenses.reduce((sum, r) => sum + r.monthlyEquivalent, 0)

  return (
    <RecurringClient
      rules={enriched}
      accounts={accounts}
      categories={categories}
      monthlyIncome={monthlyIncome}
      monthlyExpenses={monthlyExpenses}
    />
  )
}
