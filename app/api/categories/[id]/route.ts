import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'

const UpdateCategorySchema = z.object({
  name: z.string().min(1).max(80).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(50).optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body: unknown = await req.json()
  const result = UpdateCategorySchema.safeParse(body)
  if (!result.success) return apiError(result.error.format(), 400)

  try {
    const existing = await prisma.category.findUnique({ where: { id: params.id } })
    if (!existing) return apiError('Category not found', 404)
    if (existing.isSystem) return apiError('System categories cannot be modified', 403)

    const category = await prisma.category.update({
      where: { id: params.id },
      data: result.data,
    })
    return apiSuccess(category)
  } catch (err) {
    console.error('[categories:PATCH]', err)
    return apiError('Failed to update category', 500)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    const existing = await prisma.category.findUnique({ where: { id: params.id } })
    if (!existing) return apiError('Category not found', 404)
    if (existing.isSystem) return apiError('System categories cannot be deleted', 403)

    const txCount = await prisma.transaction.count({
      where: { categoryId: params.id, deletedAt: null },
    })
    if (txCount > 0) return apiError('Cannot delete a category referenced by transactions. Archive it instead.', 409)

    await prisma.category.update({
      where: { id: params.id },
      data: { isActive: false },
    })
    return apiSuccess({ id: params.id })
  } catch (err) {
    console.error('[categories:DELETE]', err)
    return apiError('Failed to delete category', 500)
  }
}
