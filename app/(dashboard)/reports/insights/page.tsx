import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { InsightsClient } from './InsightsClient'
import type { InsightResponse } from '@/types'

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: { period?: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  const period = searchParams.period ?? new Date().toISOString().slice(0, 7) // "YYYY-MM"

  const record = await prisma.aIInsight.findUnique({ where: { period } })
  const initialInsight = record
    ? {
        period: record.period,
        // Prisma's Json column reads back as JsonValue — this row's shape is always
        // written as InsightResponse by app/api/insights/generate/route.ts.
        response: record.response as unknown as InsightResponse,
        generatedAt: record.generatedAt.toISOString(),
        cached: true,
      }
    : null

  return <InsightsClient key={period} period={period} initialInsight={initialInsight} />
}
