import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'

export async function GET(req: NextRequest, { params }: { params: { period: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    const insight = await prisma.aIInsight.findUnique({ where: { period: params.period } })
    if (!insight) return apiError('No insight found for this period', 404)
    return apiSuccess(insight)
  } catch (err) {
    console.error('[insights/:period:GET]', err)
    return apiError('Failed to fetch insight', 500)
  }
}
