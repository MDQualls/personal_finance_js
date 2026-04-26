import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'

const CreateTransactionSchema = z.object({
  accountId: z.string().cuid(),
  amount: z.number().int(),
  date: z.string().datetime(),
  categoryId: z.string().min(1),
  description: z.string().min(1).max(255),
  notes: z.string().max(1000).optional(),
  tagIds: z.array(z.string().cuid()).optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get('accountId') ?? undefined
  const categoryId = searchParams.get('categoryId') ?? undefined
  const tagId = searchParams.get('tagId') ?? undefined
  const search = searchParams.get('search') ?? undefined
  const from = searchParams.get('from') ?? undefined
  const to = searchParams.get('to') ?? undefined
  const showDeleted = searchParams.get('showDeleted') === 'true'
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)
  const skip = (page - 1) * limit

  try {
    const where = {
      deletedAt: showDeleted ? { not: null } : null,
      ...(accountId ? { accountId } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(tagId ? { tags: { some: { id: tagId } } } : {}),
      ...(search ? { description: { contains: search, mode: 'insensitive' as const } } : {}),
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    }

    const [transactions, total] = await prisma.$transaction([
      prisma.transaction.findMany({
        where,
        include: { category: true, tags: true },
        orderBy: showDeleted ? { deletedAt: 'desc' } : { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ])

    return apiSuccess(transactions, { total, page, limit, pages: Math.ceil(total / limit) })
  } catch (err) {
    console.error('[transactions:GET]', err)
    return apiError('Failed to fetch transactions', 500)
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body: unknown = await req.json()
  const result = CreateTransactionSchema.safeParse(body)
  if (!result.success) return apiError(result.error.format(), 400)

  const { tagIds, ...data } = result.data

  try {
    const transaction = await prisma.transaction.create({
      data: {
        ...data,
        date: new Date(data.date),
        ...(tagIds?.length ? { tags: { connect: tagIds.map((id) => ({ id })) } } : {}),
      },
      include: { category: true, tags: true },
    })
    return apiSuccess(transaction)
  } catch (err) {
    console.error('[transactions:POST]', err)
    return apiError('Failed to create transaction', 500)
  }
}
