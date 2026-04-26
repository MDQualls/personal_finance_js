import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'

const UpdateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(['CHECKING', 'SAVINGS', 'CREDIT_CARD', 'LOAN', 'INVESTMENT', 'ASSET', 'LIABILITY']).optional(),
  balance: z.number().int().optional(),
  currency: z.string().length(3).optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body: unknown = await req.json()
  const result = UpdateAccountSchema.safeParse(body)
  if (!result.success) return apiError(result.error.format(), 400)

  try {
    const account = await prisma.account.update({
      where: { id: params.id },
      data: result.data,
    })
    return apiSuccess(account)
  } catch (err) {
    console.error('[accounts:PATCH]', err)
    return apiError('Failed to update account', 500)
  }
}
