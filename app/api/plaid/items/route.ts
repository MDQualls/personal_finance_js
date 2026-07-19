import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    const items = await prisma.plaidItem.findMany({
      where: { status: 'ACTIVE' },
      include: { accounts: { include: { account: true } } },
      orderBy: { createdAt: 'desc' },
    })

    // accessToken is deliberately never returned to the client — shape the response explicitly
    return apiSuccess(
      items.map((item) => ({
        id: item.id,
        itemId: item.itemId,
        institutionId: item.institutionId,
        institutionName: item.institutionName,
        lastSyncedAt: item.lastSyncedAt,
        lastCursor: item.lastCursor,
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        accounts: item.accounts,
      }))
    )
  } catch (err) {
    console.error('[plaid:items:GET]', err)
    return apiError('Failed to fetch connected accounts', 500)
  }
}
