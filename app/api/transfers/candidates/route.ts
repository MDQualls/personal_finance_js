import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { detectTransferCandidates } from '@/lib/transferDetection'
import { subDays } from 'date-fns'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    // Look back 90 days for candidates — keeps the result set manageable
    const since = subDays(new Date(), 90)

    const [transactions, dismissed] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          deletedAt: null,
          isTransfer: false,
          date: { gte: since },
        },
        include: { category: true, account: true, tags: true },
      }),
      prisma.dismissedTransferCandidate.findMany(),
    ])

    const dismissedPairs = new Set(dismissed.map((d) => `${d.fromTransactionId}:${d.toTransactionId}`))

    const candidates = detectTransferCandidates(transactions).filter(
      (c) => !dismissedPairs.has(`${c.fromTransaction.id}:${c.toTransaction.id}`)
    )

    return apiSuccess(candidates, { count: candidates.length })
  } catch (err) {
    console.error('[transfers/candidates:GET]', err)
    return apiError('Failed to fetch transfer candidates', 500)
  }
}
