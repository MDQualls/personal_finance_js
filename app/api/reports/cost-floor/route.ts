import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiSuccess, apiError } from '@/lib/api'
import { getCostFloor } from '@/lib/reports'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    const data = await getCostFloor()
    return apiSuccess(data)
  } catch (err) {
    console.error('[reports/cost-floor:GET]', err)
    return apiError('Failed to fetch cost floor data', 500)
  }
}
