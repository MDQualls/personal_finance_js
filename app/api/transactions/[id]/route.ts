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
  categoryId: z.string().min(1).optional(),
  description: z.string().min(1).max(255).optional(),
  notes: z.string().max(1000).nullable().optional(),
  tagIds: z.array(z.string().cuid()).optional(),
  restore: z.boolean().optional(),
  needsReview: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body: unknown = await req.json()
  const result = UpdateTransactionSchema.safeParse(body)
  if (!result.success) return apiError(result.error.format(), 400)

  const { tagIds, date, restore, ...rest } = result.data

  try {
    const existing = await prisma.transaction.findUnique({ where: { id: params.id } })
    if (!existing) return apiError('Transaction not found', 404)
    if (existing.deletedAt && !restore) return apiError('Transaction has been deleted', 410)

    const newAccountId = rest.accountId ?? existing.accountId
    const newAmount = rest.amount ?? existing.amount

    const balanceOps: ReturnType<typeof prisma.account.update>[] = []
    if (restore) {
      balanceOps.push(
        prisma.account.update({ where: { id: existing.accountId }, data: { balance: { increment: existing.amount } } })
      )
    } else if (rest.amount !== undefined || rest.accountId !== undefined) {
      if (newAccountId === existing.accountId) {
        balanceOps.push(
          prisma.account.update({ where: { id: existing.accountId }, data: { balance: { increment: newAmount - existing.amount } } })
        )
      } else {
        balanceOps.push(
          prisma.account.update({ where: { id: existing.accountId }, data: { balance: { decrement: existing.amount } } }),
          prisma.account.update({ where: { id: newAccountId }, data: { balance: { increment: newAmount } } })
        )
      }
    }

    const [transaction] = await prisma.$transaction([
      prisma.transaction.update({
        where: { id: params.id },
        data: {
          ...rest,
          ...(date ? { date: new Date(date) } : {}),
          ...(restore ? { deletedAt: null } : {}),
          ...(tagIds !== undefined
            ? { tags: { set: tagIds.map((id) => ({ id })) } }
            : {}),
        },
        include: { category: true, tags: true, account: true },
      }),
      ...balanceOps,
    ])
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

    await prisma.$transaction([
      prisma.transaction.update({ where: { id: params.id }, data: { deletedAt: new Date() } }),
      prisma.account.update({ where: { id: existing.accountId }, data: { balance: { decrement: existing.amount } } }),
    ])
    return apiSuccess({ id: params.id })
  } catch (err) {
    console.error('[transactions:DELETE]', err)
    return apiError('Failed to delete transaction', 500)
  }
}
