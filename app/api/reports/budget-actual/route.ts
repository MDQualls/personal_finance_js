import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const now = new Date()
  const fromDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1)
  const toDate = to ? new Date(to) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  try {
    const budgets = await prisma.budget.findMany({
      where: { isActive: true },
      include: { category: true },
      orderBy: { category: { name: 'asc' } },
    })

    const rows = await Promise.all(
      budgets.map(async (budget) => {
        const result = await prisma.transaction.aggregate({
          where: {
            categoryId: budget.categoryId,
            deletedAt: null,
            isTransfer: false,
            needsReview: false,
            date: { gte: fromDate, lte: toDate },
            amount: { lt: 0 },
          },
          _sum: { amount: true },
        })

        const spent = Math.abs(result._sum.amount ?? 0)
        const percentage = budget.amount > 0 ? Math.round((spent / budget.amount) * 100) : 0

        return {
          categoryId: budget.categoryId,
          categoryName: budget.category.name,
          budgeted: budget.amount,
          spent,
          percentage,
          budgetType: budget.budgetType,
        }
      })
    )

    const sorted = rows.sort((a, b) => {
      const aIsAchievedGoal = a.budgetType === 'SAVINGS_GOAL' && a.percentage >= 100
      const bIsAchievedGoal = b.budgetType === 'SAVINGS_GOAL' && b.percentage >= 100
      if (aIsAchievedGoal && !bIsAchievedGoal) return 1
      if (!aIsAchievedGoal && bIsAchievedGoal) return -1
      return b.percentage - a.percentage
    })
    return apiSuccess(sorted)
  } catch (err) {
    console.error('[reports/budget-actual:GET]', err)
    return apiError('Failed to fetch budget vs. actual data', 500)
  }
}
