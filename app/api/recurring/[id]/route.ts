import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'

const UpdateRecurringRuleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  amount: z.number().int().optional(),
  frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
  accountId: z.string().cuid().optional(),
  categoryId: z.string().min(1).optional(),
  nextDate: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
  autoPost: z.boolean().optional(),
  notes: z.string().max(1000).nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body = UpdateRecurringRuleSchema.safeParse(await req.json())
  if (!body.success) return apiError(body.error.format(), 400)

  try {
    const rule = await prisma.recurringRule.update({
      where: { id: params.id },
      data: {
        ...body.data,
        ...(body.data.nextDate ? { nextDate: new Date(body.data.nextDate) } : {}),
      },
      include: { account: true, category: true },
    })
    return apiSuccess(rule)
  } catch (err) {
    console.error('[recurring:PATCH]', err)
    return apiError('Failed to update recurring rule', 500)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    await prisma.recurringRule.update({
      where: { id: params.id },
      data: { isActive: false },
    })
    return apiSuccess({ deactivated: true })
  } catch (err) {
    console.error('[recurring:DELETE]', err)
    return apiError('Failed to deactivate recurring rule', 500)
  }
}
