import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'

const UpdateBudgetSchema = z.object({
  amount: z.number().int().positive().optional(),
  period: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
  rollover: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body: unknown = await req.json()
  const result = UpdateBudgetSchema.safeParse(body)
  if (!result.success) return apiError(result.error.format(), 400)

  try {
    const budget = await prisma.budget.update({
      where: { id: params.id },
      data: result.data,
      include: { category: true },
    })
    return apiSuccess(budget)
  } catch (err) {
    console.error('[budgets:PATCH]', err)
    return apiError('Failed to update budget', 500)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    await prisma.budget.delete({ where: { id: params.id } })
    return apiSuccess({ id: params.id })
  } catch (err) {
    console.error('[budgets:DELETE]', err)
    return apiError('Failed to delete budget', 500)
  }
}
