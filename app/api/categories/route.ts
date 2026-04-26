import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'

const CreateCategorySchema = z.object({
  name: z.string().min(1).max(80),
  parentId: z.string().cuid().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6b7a8d'),
  icon: z.string().max(50).default('tag'),
  isIncome: z.boolean().default(false),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true, parentId: null },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    })
    return apiSuccess(categories)
  } catch (err) {
    console.error('[categories:GET]', err)
    return apiError('Failed to fetch categories', 500)
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body: unknown = await req.json()
  const result = CreateCategorySchema.safeParse(body)
  if (!result.success) return apiError(result.error.format(), 400)

  try {
    const category = await prisma.category.create({ data: result.data })
    return apiSuccess(category)
  } catch (err) {
    console.error('[categories:POST]', err)
    return apiError('Failed to create category', 500)
  }
}
