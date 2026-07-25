import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiSuccess, apiError } from '@/lib/api'
import { getExpenseSplit } from '@/lib/reports'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const now = new Date()
  const fromDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1)
  const toDate = to ? new Date(to) : new Date(now.getFullYear(), now.getMonth() + 1, 0)

  try {
    const data = await getExpenseSplit(fromDate, toDate)
    return apiSuccess(data)
  } catch (err) {
    console.error('[reports/expense-split:GET]', err)
    return apiError('Failed to fetch expense split data', 500)
  }
}
