import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'

const CreateMerchantRuleSchema = z.object({
  pattern: z.string().min(1).max(255),
  isRegex: z.boolean().default(false),
  displayName: z.string().min(1).max(255),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    const rules = await prisma.merchantRule.findMany({ orderBy: { createdAt: 'asc' } })
    return apiSuccess(rules)
  } catch (err) {
    console.error('[merchant-rules:GET]', err)
    return apiError('Failed to fetch merchant rules', 500)
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body: unknown = await req.json()
  const result = CreateMerchantRuleSchema.safeParse(body)
  if (!result.success) return apiError(result.error.format(), 400)

  try {
    const rule = await prisma.merchantRule.create({ data: result.data })
    return apiSuccess(rule)
  } catch (err) {
    console.error('[merchant-rules:POST]', err)
    return apiError('Failed to create merchant rule', 500)
  }
}
