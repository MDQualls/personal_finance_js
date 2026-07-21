import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'

const DismissCandidateSchema = z.object({
  fromTransactionId: z.string().min(1),
  toTransactionId: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body: unknown = await req.json()
  const result = DismissCandidateSchema.safeParse(body)
  if (!result.success) return apiError(result.error.format(), 400)

  const { fromTransactionId, toTransactionId } = result.data

  try {
    await prisma.dismissedTransferCandidate.upsert({
      where: { fromTransactionId_toTransactionId: { fromTransactionId, toTransactionId } },
      create: { fromTransactionId, toTransactionId },
      update: {},
    })

    return apiSuccess({ dismissed: true })
  } catch (err) {
    console.error('[transfers/candidates/dismiss:POST]', err)
    return apiError('Failed to dismiss transfer candidate', 500)
  }
}
