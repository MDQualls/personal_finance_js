import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { startOfPeriod, endOfPeriod } from '@/lib/dates'
import type { BudgetPeriod } from '@prisma/client'

const CreateBudgetSchema = z.object({
  categoryId: z.string().cuid(),
  amount: z.number().int().positive(),
  period: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).default('MONTHLY'),
  startDate: z.string().datetime(),
  rollover: z.boolean().default(false),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    const budgets = await prisma.budget.findMany({
      include: { category: true },
      orderBy: { category: { name: 'asc' } },
    })

    const now = new Date()
    const enriched = await Promise.all(
      budgets.map(async (budget) => {
        const start = startOfPeriod(now, budget.period as BudgetPeriod)
        const end = endOfPeriod(now, budget.period as BudgetPeriod)

        const result = await prisma.transaction.aggregate({
          where: {
            categoryId: budget.categoryId,
            deletedAt: null,
            date: { gte: start, lte: end },
            amount: { lt: 0 },
          },
          _sum: { amount: true },
        })

        const spent = Math.abs(result._sum.amount ?? 0)
        return { ...budget, spent }
      })
    )

    return apiSuccess(enriched)
  } catch (err) {
    console.error('[budgets:GET]', err)
    return apiError('Failed to fetch budgets', 500)
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body: unknown = await req.json()
  const result = CreateBudgetSchema.safeParse(body)
  if (!result.success) return apiError(result.error.format(), 400)

  try {
    const budget = await prisma.budget.create({
      data: { ...result.data, startDate: new Date(result.data.startDate) },
      include: { category: true },
    })
    return apiSuccess(budget)
  } catch (err) {
    console.error('[budgets:POST]', err)
    return apiError('Failed to create budget', 500)
  }
}
