import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { addFrequency } from '@/lib/dates'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    const rule = await prisma.recurringRule.findUnique({ where: { id: params.id } })
    if (!rule) return apiError('Rule not found', 404)

    await prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          accountId: rule.accountId,
          categoryId: rule.categoryId,
          amount: rule.amount,
          date: new Date(),
          description: rule.name,
          notes: rule.notes ?? null,
        },
      })
      await tx.account.update({
        where: { id: rule.accountId },
        data: { balance: { increment: rule.amount } },
      })
      await tx.recurringRule.update({
        where: { id: rule.id },
        data: {
          nextDate: addFrequency(rule.nextDate, rule.frequency),
          lastPostedAt: new Date(),
        },
      })
    })

    return apiSuccess({ posted: true })
  } catch (err) {
    console.error('[recurring:post-now]', err)
    return apiError('Failed to post rule', 500)
  }
}
