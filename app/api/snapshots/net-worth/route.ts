import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { formatPeriodKey } from '@/lib/dates'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    const accounts = await prisma.account.findMany({ where: { isActive: true } })

    let assets = 0
    let liabilities = 0

    for (const account of accounts) {
      if (['CHECKING', 'SAVINGS', 'INVESTMENT', 'ASSET'].includes(account.type)) {
        assets += account.balance
      } else {
        liabilities += Math.abs(account.balance)
      }
    }

    const month = formatPeriodKey(new Date())

    const snapshot = await prisma.netWorthRecord.upsert({
      where: { month },
      create: { month, assets, liabilities, netWorth: assets - liabilities },
      update: { assets, liabilities, netWorth: assets - liabilities },
    })

    return apiSuccess(snapshot)
  } catch (err) {
    console.error('[snapshots/net-worth:POST]', err)
    return apiError('Failed to capture net worth snapshot', 500)
  }
}
