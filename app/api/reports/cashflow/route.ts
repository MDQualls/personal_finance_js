import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { projectBalance } from '@/lib/projection'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get('accountId')
  const days = Math.min(parseInt(searchParams.get('days') ?? '30', 10), 90)

  try {
    const [accounts, recurringRules, subscriptions] = await Promise.all([
      prisma.account.findMany({
        where: { isActive: true, ...(accountId ? { id: accountId } : {}) },
      }),
      prisma.recurringRule.findMany(),
      prisma.subscription.findMany({ where: { isActive: true } }),
    ])

    const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0)

    const projection = projectBalance(
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

    return apiSuccess(projection, {
      accounts: accounts.map((a) => ({ id: a.id, name: a.name, balance: a.balance })),
      days,
    })
  } catch (err) {
    console.error('[reports/cashflow:GET]', err)
    return apiError('Failed to fetch cash flow data', 500)
  }
}
