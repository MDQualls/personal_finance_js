import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'

const CreateRecurringRuleSchema = z.object({
  name: z.string().min(1).max(100),
  amount: z.number().int().positive(),
  frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
  accountId: z.string().cuid(),
  categoryId: z.string().min(1),
  nextDate: z.string().datetime(),
  type: z.enum(['INCOME', 'EXPENSE']),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    const rules = await prisma.recurringRule.findMany({
      include: { account: true, category: true },
      orderBy: { nextDate: 'asc' },
    })
    return apiSuccess(rules)
  } catch (err) {
    console.error('[rules:GET]', err)
    return apiError('Failed to fetch recurring rules', 500)
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body: unknown = await req.json()
  const result = CreateRecurringRuleSchema.safeParse(body)
  if (!result.success) return apiError(result.error.format(), 400)

  try {
    const rule = await prisma.recurringRule.create({
      data: { ...result.data, nextDate: new Date(result.data.nextDate) },
      include: { account: true, category: true },
    })
    return apiSuccess(rule)
  } catch (err) {
    console.error('[rules:POST]', err)
    return apiError('Failed to create recurring rule', 500)
  }
}
