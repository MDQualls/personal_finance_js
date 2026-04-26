import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiSuccess, apiError } from '@/lib/api'
import { getMonthlyTrends } from '@/lib/reports'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const { searchParams } = new URL(req.url)
  const months = parseInt(searchParams.get('months') ?? '6', 10)

  try {
    const data = await getMonthlyTrends(Math.min(months, 24))
    return apiSuccess(data)
  } catch (err) {
    console.error('[reports/trends:GET]', err)
    return apiError('Failed to fetch trend data', 500)
  }
}
