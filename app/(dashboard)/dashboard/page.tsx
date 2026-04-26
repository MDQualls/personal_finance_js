import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/money'
import { formatDisplay, startOfPeriod, endOfPeriod, daysUntil } from '@/lib/dates'
import { getBudgetAlerts } from '@/lib/alerts'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { BudgetProgress } from '@/components/ui/BudgetProgress'
import { TransactionRow } from '@/components/ui/TransactionRow'
import type { BudgetPeriod } from '@prisma/client'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  const now = new Date()
  const monthStart = startOfPeriod(now, 'MONTHLY')
  const monthEnd = endOfPeriod(now, 'MONTHLY')

  const [accounts, budgets, subscriptions, recentTx] = await Promise.all([
    prisma.account.findMany({ where: { isActive: true } }),
    prisma.budget.findMany({ include: { category: true } }),
    prisma.subscription.findMany({
      where: { isActive: true },
      orderBy: { nextDueDate: 'asc' },
      take: 5,
    }),
    prisma.transaction.findMany({
      where: { deletedAt: null },
      include: { category: true, tags: true },
      orderBy: { date: 'desc' },
      take: 5,
    }),
  ])

  const netWorth = accounts.reduce((sum, a) => {
    if (['CHECKING', 'SAVINGS', 'INVESTMENT', 'ASSET'].includes(a.type)) return sum + a.balance
    return sum - Math.abs(a.balance)
  }, 0)

  const enrichedBudgets = await Promise.all(
    budgets.map(async (budget) => {
      const start = startOfPeriod(now, budget.period as BudgetPeriod)
      const end = endOfPeriod(now, budget.period as BudgetPeriod)
      const result = await prisma.transaction.aggregate({
        where: { categoryId: budget.categoryId, deletedAt: null, date: { gte: start, lte: end }, amount: { lt: 0 } },
        _sum: { amount: true },
      })
      return { ...budget, spent: Math.abs(result._sum.amount ?? 0) }
    })
  )

  const budgetAlerts = getBudgetAlerts(enrichedBudgets)

  const incomeThisMonth = await prisma.transaction.aggregate({
    where: { deletedAt: null, date: { gte: monthStart, lte: monthEnd }, amount: { gt: 0 } },
    _sum: { amount: true },
  })
  const expensesThisMonth = await prisma.transaction.aggregate({
    where: { deletedAt: null, date: { gte: monthStart, lte: monthEnd }, amount: { lt: 0 } },
    _sum: { amount: true },
  })

  const totalIncome = incomeThisMonth._sum.amount ?? 0
  const totalExpenses = Math.abs(expensesThisMonth._sum.amount ?? 0)

  const upcomingBills = subscriptions
    .filter((s) => daysUntil(s.nextDueDate) >= 0 && daysUntil(s.nextDueDate) <= 7)

  return (
    <div className="space-y-6">
      {/* Top row — KPI cards */}
      <div className="grid grid-cols-3 gap-5">
        <Card>
          <p className="text-[13px] font-medium font-heading text-[#6b7a8d]">Net Worth</p>
          <p className={`text-[26px] font-semibold font-tabular mt-1 ${netWorth >= 0 ? 'text-[#1a2332]' : 'text-[#ef4444]'}`}>
            {formatCurrency(netWorth)}
          </p>
          <p className="text-[12px] text-[#6b7a8d] mt-1">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
        </Card>

        <Card>
          <p className="text-[13px] font-medium font-heading text-[#6b7a8d]">Income This Month</p>
          <p className="text-[26px] font-semibold font-tabular text-[#22c55e] mt-1">
            {formatCurrency(totalIncome)}
          </p>
          <p className="text-[12px] text-[#6b7a8d] mt-1">{formatDisplay(monthStart)}</p>
        </Card>

        <Card>
          <p className="text-[13px] font-medium font-heading text-[#6b7a8d]">Expenses This Month</p>
          <p className="text-[26px] font-semibold font-tabular text-[#ef4444] mt-1">
            {formatCurrency(totalExpenses)}
          </p>
          <p className="text-[12px] text-[#6b7a8d] mt-1">
            Net: {formatCurrency(totalIncome - totalExpenses)}
          </p>
        </Card>
      </div>

      {/* Second row */}
      <div className="grid grid-cols-3 gap-5">
        {/* Budget summary */}
        <div className="col-span-2">
          <Card>
            <CardHeader
              title="Budget Summary"
              action={<Link href="/budgets" className="text-[13px] text-[#00b89c] hover:underline">View All</Link>}
            />
            {enrichedBudgets.length === 0 ? (
              <p className="text-[13px] text-[#6b7a8d]">No budgets set yet.</p>
            ) : (
              <div className="space-y-4">
                {enrichedBudgets.slice(0, 5).map((b) => (
                  <BudgetProgress
                    key={b.id}
                    spent={b.spent}
                    limit={b.amount}
                    label={b.category.name}
                  />
                ))}
              </div>
            )}
            {budgetAlerts.length > 0 && (
              <div className="mt-4 rounded-[8px] bg-[#fef2f2] px-4 py-3">
                <p className="text-[13px] font-medium text-[#ef4444]">
                  {budgetAlerts.filter((a) => a.type === 'budget_over').length} over budget,{' '}
                  {budgetAlerts.filter((a) => a.type === 'budget_warning').length} near limit
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* Upcoming bills */}
        <Card>
          <CardHeader
            title="Upcoming Bills"
            subtitle="Next 7 days"
            action={<Link href="/calendar" className="text-[13px] text-[#00b89c] hover:underline">Calendar</Link>}
          />
          {upcomingBills.length === 0 ? (
            <p className="text-[13px] text-[#6b7a8d]">No bills due this week.</p>
          ) : (
            <div className="space-y-3">
              {upcomingBills.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-medium text-[#1a2332]">{sub.name}</p>
                    <p className="text-[12px] text-[#6b7a8d]">{formatDisplay(sub.nextDueDate)}</p>
                  </div>
                  <p className="text-[13px] font-semibold font-tabular text-[#1a2332]">
                    {formatCurrency(sub.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent transactions */}
      <Card padding={false}>
        <div className="px-5 py-4 border-b border-[#e8ecf0] flex items-center justify-between">
          <div>
            <h3 className="text-[16px] font-semibold font-heading text-[#1a2332]">Recent Transactions</h3>
          </div>
          <Link href="/transactions" className="text-[13px] text-[#00b89c] hover:underline">View All</Link>
        </div>
        {recentTx.length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px] text-[#6b7a8d]">No transactions yet.</div>
        ) : (
          <div className="divide-y divide-[#e8ecf0]">
            {recentTx.map((tx) => (
              <TransactionRow key={tx.id} transaction={tx as never} />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
