import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import type { RecurringType } from '@prisma/client'

const CreateRecurringRuleSchema = z
  .object({
    name: z.string().min(1).max(255),
    amount: z.number().int(),
    frequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
    accountId: z.string().cuid(),
    categoryId: z.string().min(1),
    nextDate: z.string().datetime(),
    type: z.enum(['INCOME', 'EXPENSE']),
    autoPost: z.boolean().default(true),
    notes: z.string().max(1000).optional(),
  })
  .refine((data) => (data.type === 'INCOME' ? data.amount > 0 : data.amount < 0), {
    message: 'Amount sign must match type: income = positive, expense = negative',
  })

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  try {
    const rules = await prisma.recurringRule.findMany({
      where: {
        isActive: true,
        ...(type ? { type: type as RecurringType } : {}),
      },
      include: { account: true, category: true },
      orderBy: { nextDate: 'asc' },
    })
    return apiSuccess(rules)
  } catch (err) {
    console.error('[recurring:GET]', err)
    return apiError('Failed to fetch recurring rules', 500)
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body = CreateRecurringRuleSchema.safeParse(await req.json())
  if (!body.success) return apiError(body.error.format(), 400)

  try {
    if (body.data.autoPost) {
      const account = await prisma.account.findUnique({ where: { id: body.data.accountId } })
      if (account?.plaidManaged) {
        return apiError(
          'Auto-post is not allowed on Plaid-managed accounts. Set autoPost to false.',
          422
        )
      }
    }

    const rule = await prisma.recurringRule.create({
      data: { ...body.data, nextDate: new Date(body.data.nextDate) },
      include: { account: true, category: true },
    })
    return apiSuccess(rule)
  } catch (err) {
    console.error('[recurring:POST]', err)
    return apiError('Failed to create recurring rule', 500)
  }
}
