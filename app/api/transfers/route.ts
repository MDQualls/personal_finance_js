import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { differenceInCalendarDays } from 'date-fns'

const TRANSFER_WINDOW_DAYS = 5
const SYSTEM_TRANSFERS_CATEGORY_ID = 'system_transfers'

const CreateTransferSchema = z.object({
  fromTransactionId: z.string().min(1),
  toTransactionId: z.string().min(1),
  note: z.string().max(500).optional(),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body: unknown = await req.json()
  const result = CreateTransferSchema.safeParse(body)
  if (!result.success) return apiError(result.error.format(), 400)

  const { fromTransactionId, toTransactionId, note } = result.data

  try {
    const [fromTx, toTx] = await Promise.all([
      prisma.transaction.findUnique({ where: { id: fromTransactionId } }),
      prisma.transaction.findUnique({ where: { id: toTransactionId } }),
    ])

    if (!fromTx || fromTx.deletedAt) return apiError('From transaction not found', 422)
    if (!toTx || toTx.deletedAt) return apiError('To transaction not found', 422)
    if (fromTx.accountId === toTx.accountId) return apiError('Transactions must be on different accounts', 422)
    if (fromTx.amount + toTx.amount !== 0) return apiError('Transaction amounts must be equal and opposite', 422)
    if (fromTx.isTransfer || toTx.isTransfer) return apiError('One or both transactions are already linked as a transfer', 422)

    const daysDiff = Math.abs(differenceInCalendarDays(new Date(fromTx.date), new Date(toTx.date)))
    if (daysDiff > TRANSFER_WINDOW_DAYS) {
      return apiError(`Transactions must be within ${TRANSFER_WINDOW_DAYS} days of each other`, 422)
    }

    const transfer = await prisma.$transaction(async (tx) => {
      const created = await tx.transfer.create({
        data: { fromTransactionId, toTransactionId, note },
        include: {
          fromTransaction: { include: { category: true, account: true } },
          toTransaction: { include: { category: true, account: true } },
        },
      })

      await tx.transaction.updateMany({
        where: { id: { in: [fromTransactionId, toTransactionId] } },
        data: { isTransfer: true, categoryId: SYSTEM_TRANSFERS_CATEGORY_ID },
      })

      return created
    })

    return apiSuccess(transfer)
  } catch (err) {
    console.error('[transfers:POST]', err)
    return apiError('Failed to create transfer', 500)
  }
}
