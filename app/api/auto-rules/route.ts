import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'

const CreateAutoRuleSchema = z.object({
  pattern: z.string().min(1).max(200),
  isRegex: z.boolean().default(false),
  categoryId: z.string().min(1),
  tagId: z.string().cuid().optional(),
  priority: z.number().int().min(0).default(0),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    const rules = await prisma.autoRule.findMany({ orderBy: { priority: 'asc' } })
    return apiSuccess(rules)
  } catch (err) {
    console.error('[auto-rules:GET]', err)
    return apiError('Failed to fetch auto rules', 500)
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body: unknown = await req.json()
  const result = CreateAutoRuleSchema.safeParse(body)
  if (!result.success) return apiError(result.error.format(), 400)

  try {
    const rule = await prisma.autoRule.create({ data: result.data })
    return apiSuccess(rule)
  } catch (err) {
    console.error('[auto-rules:POST]', err)
    return apiError('Failed to create auto rule', 500)
  }
}
