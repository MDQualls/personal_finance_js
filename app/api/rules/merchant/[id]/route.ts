import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'

const UpdateMerchantRuleSchema = z.object({
  pattern: z.string().min(1).max(255).optional(),
  isRegex: z.boolean().optional(),
  displayName: z.string().min(1).max(255).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body: unknown = await req.json()
  const result = UpdateMerchantRuleSchema.safeParse(body)
  if (!result.success) return apiError(result.error.format(), 400)

  try {
    const rule = await prisma.merchantRule.update({
      where: { id: params.id },
      data: result.data,
    })
    return apiSuccess(rule)
  } catch (err) {
    console.error('[merchant-rules:PATCH]', err)
    return apiError('Failed to update merchant rule', 500)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    await prisma.merchantRule.delete({ where: { id: params.id } })
    return apiSuccess({ id: params.id })
  } catch (err) {
    console.error('[merchant-rules:DELETE]', err)
    return apiError('Failed to delete merchant rule', 500)
  }
}
