import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'

const CreateAccountSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['CHECKING', 'SAVINGS', 'CREDIT_CARD', 'LOAN', 'INVESTMENT', 'ASSET', 'LIABILITY']),
  balance: z.number().int(),
  currency: z.string().length(3).default('USD'),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    const accounts = await prisma.account.findMany({
      where: { isActive: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    })
    return apiSuccess(accounts)
  } catch (err) {
    console.error('[accounts:GET]', err)
    return apiError('Failed to fetch accounts', 500)
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body: unknown = await req.json()
  const result = CreateAccountSchema.safeParse(body)
  if (!result.success) return apiError(result.error.format(), 400)

  try {
    const account = await prisma.account.create({ data: result.data })
    return apiSuccess(account)
  } catch (err) {
    console.error('[accounts:POST]', err)
    return apiError('Failed to create account', 500)
  }
}
