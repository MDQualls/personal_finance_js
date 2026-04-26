import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'

const CreateTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6b7a8d'),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    const tags = await prisma.tag.findMany({ orderBy: { name: 'asc' } })
    return apiSuccess(tags)
  } catch (err) {
    console.error('[tags:GET]', err)
    return apiError('Failed to fetch tags', 500)
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body: unknown = await req.json()
  const result = CreateTagSchema.safeParse(body)
  if (!result.success) return apiError(result.error.format(), 400)

  try {
    const tag = await prisma.tag.create({ data: result.data })
    return apiSuccess(tag)
  } catch (err) {
    console.error('[tags:POST]', err)
    return apiError('Failed to create tag', 500)
  }
}
