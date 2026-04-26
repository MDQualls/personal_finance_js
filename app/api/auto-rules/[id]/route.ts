import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'

const UpdateAutoRuleSchema = z.object({
  pattern: z.string().min(1).max(200).optional(),
  isRegex: z.boolean().optional(),
  categoryId: z.string().min(1).optional(),
  tagId: z.string().cuid().nullable().optional(),
  priority: z.number().int().min(0).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body: unknown = await req.json()
  const result = UpdateAutoRuleSchema.safeParse(body)
  if (!result.success) return apiError(result.error.format(), 400)

  try {
    const rule = await prisma.autoRule.update({ where: { id: params.id }, data: result.data })
    return apiSuccess(rule)
  } catch (err) {
    console.error('[auto-rules:PATCH]', err)
    return apiError('Failed to update auto rule', 500)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    await prisma.autoRule.delete({ where: { id: params.id } })
    return apiSuccess({ id: params.id })
  } catch (err) {
    console.error('[auto-rules:DELETE]', err)
    return apiError('Failed to delete auto rule', 500)
  }
}
