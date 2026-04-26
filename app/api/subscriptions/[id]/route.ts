import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'

const UpdateSubscriptionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  amount: z.number().int().positive().optional(),
  frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
  nextDueDate: z.string().datetime().optional(),
  categoryId: z.string().min(1).optional(),
  notes: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
  alertDays: z.number().int().min(0).max(30).optional(),
})

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    await prisma.subscription.update({
      where: { id: params.id },
      data: { isActive: false },
    })
    return apiSuccess({ id: params.id })
  } catch (err) {
    console.error('[subscriptions:DELETE]', err)
    return apiError('Failed to cancel subscription', 500)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body: unknown = await req.json()
  const result = UpdateSubscriptionSchema.safeParse(body)
  if (!result.success) return apiError(result.error.format(), 400)

  const { nextDueDate, ...rest } = result.data

  try {
    const subscription = await prisma.subscription.update({
      where: { id: params.id },
      data: {
        ...rest,
        ...(nextDueDate ? { nextDueDate: new Date(nextDueDate) } : {}),
      },
      include: { category: true },
    })
    return apiSuccess(subscription)
  } catch (err) {
    console.error('[subscriptions:PATCH]', err)
    return apiError('Failed to update subscription', 500)
  }
}
