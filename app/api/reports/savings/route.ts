import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiSuccess, apiError } from '@/lib/api'
import { getSavingsSummary } from '@/lib/reports'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')

  const now = new Date()
  const anchor = from ? new Date(from) : now

  try {
    const data = await getSavingsSummary(anchor)
    return apiSuccess(data)
  } catch (err) {
    console.error('[reports/savings:GET]', err)
    return apiError('Failed to fetch savings summary', 500)
  }
}
