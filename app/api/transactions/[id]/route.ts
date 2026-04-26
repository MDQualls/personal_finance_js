import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'

const UpdateTransactionSchema = z.object({
  accountId: z.string().cuid().optional(),
  amount: z.number().int().optional(),
  date: z.string().datetime().optional(),
  categoryId: z.string().cuid().optional(),
  description: z.string().min(1).max(255).optional(),
  notes: z.string().max(1000).nullable().optional(),
  tagIds: z.array(z.string().cuid()).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body: unknown = await req.json()
  const result = UpdateTransactionSchema.safeParse(body)
  if (!result.success) return apiError(result.error.format(), 400)

  const { tagIds, date, ...rest } = result.data

  try {
    const existing = await prisma.transaction.findUnique({ where: { id: params.id } })
    if (!existing) return apiError('Transaction not found', 404)
    if (existing.deletedAt) return apiError('Transaction has been deleted', 410)

    const transaction = await prisma.transaction.update({
      where: { id: params.id },
      data: {
        ...rest,
        ...(date ? { date: new Date(date) } : {}),
        ...(tagIds !== undefined
          ? { tags: { set: tagIds.map((id) => ({ id })) } }
          : {}),
      },
      include: { category: true, tags: true },
    })
    return apiSuccess(transaction)
  } catch (err) {
    console.error('[transactions:PATCH]', err)
    return apiError('Failed to update transaction', 500)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    const existing = await prisma.transaction.findUnique({ where: { id: params.id } })
    if (!existing) return apiError('Transaction not found', 404)
    if (existing.deletedAt) return apiError('Transaction already deleted', 410)

    await prisma.transaction.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    })
    return apiSuccess({ id: params.id })
  } catch (err) {
    console.error('[transactions:DELETE]', err)
    return apiError('Failed to delete transaction', 500)
  }
}
