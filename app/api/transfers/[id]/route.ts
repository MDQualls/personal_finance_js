import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'

const SYSTEM_UNCATEGORIZED_CATEGORY_ID = 'system_uncategorized'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const { id } = params

  try {
    const transfer = await prisma.transfer.findUnique({ where: { id } })
    if (!transfer) return apiError('Transfer not found', 404)

    await prisma.$transaction([
      prisma.transaction.updateMany({
        where: { id: { in: [transfer.fromTransactionId, transfer.toTransactionId] } },
        data: { isTransfer: false, categoryId: SYSTEM_UNCATEGORIZED_CATEGORY_ID },
      }),
      prisma.transfer.delete({ where: { id } }),
    ])

    return apiSuccess({ unlinked: true })
  } catch (err) {
    console.error('[transfers/[id]:DELETE]', err)
    return apiError('Failed to unlink transfer', 500)
  }
}
