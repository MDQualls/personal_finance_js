import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { monthlyEquivalent } from '@/lib/money'

const CreateSubscriptionSchema = z.object({
  name: z.string().min(1).max(100),
  amount: z.number().int().positive(),
  frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
  nextDueDate: z.string().datetime(),
  categoryId: z.string().min(1),
  notes: z.string().max(500).optional(),
  alertDays: z.number().int().min(0).max(30).default(3),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    const subscriptions = await prisma.subscription.findMany({
      include: { category: true },
      orderBy: { nextDueDate: 'asc' },
    })

    const enriched = subscriptions.map((sub) => ({
      ...sub,
      monthlyEquivalent: monthlyEquivalent(sub.amount, sub.frequency),
    }))

    const totalMonthly = enriched
      .filter((s) => s.isActive)
      .reduce((sum, s) => sum + s.monthlyEquivalent, 0)

    return apiSuccess(enriched, { totalMonthly, totalAnnual: totalMonthly * 12 })
  } catch (err) {
    console.error('[subscriptions:GET]', err)
    return apiError('Failed to fetch subscriptions', 500)
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body: unknown = await req.json()
  const result = CreateSubscriptionSchema.safeParse(body)
  if (!result.success) return apiError(result.error.format(), 400)

  try {
    const subscription = await prisma.subscription.create({
      data: { ...result.data, nextDueDate: new Date(result.data.nextDueDate) },
      include: { category: true },
    })
    return apiSuccess(subscription)
  } catch (err) {
    console.error('[subscriptions:POST]', err)
    return apiError('Failed to create subscription', 500)
  }
}
