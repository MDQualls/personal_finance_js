import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiSuccess, apiError } from '@/lib/api'
import { postDueRecurringRules } from '@/lib/recurringEngine'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    const result = await postDueRecurringRules()
    return apiSuccess(result)
  } catch (err) {
    console.error('[recurring:post-due]', err)
    return apiError('Engine failed', 500)
  }
}
