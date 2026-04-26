import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'

const UpdateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body: unknown = await req.json()
  const result = UpdateTagSchema.safeParse(body)
  if (!result.success) return apiError(result.error.format(), 400)

  try {
    const tag = await prisma.tag.update({ where: { id: params.id }, data: result.data })
    return apiSuccess(tag)
  } catch (err) {
    console.error('[tags:PATCH]', err)
    return apiError('Failed to update tag', 500)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    await prisma.tag.delete({ where: { id: params.id } })
    return apiSuccess({ id: params.id })
  } catch (err) {
    console.error('[tags:DELETE]', err)
    return apiError('Failed to delete tag', 500)
  }
}
