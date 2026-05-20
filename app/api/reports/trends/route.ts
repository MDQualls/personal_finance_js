import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiSuccess, apiError } from '@/lib/api'
import { getMonthlyTrends } from '@/lib/reports'

function csvField(value: string | number): string {
  const str = String(value)
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const { searchParams } = new URL(req.url)
  const months = parseInt(searchParams.get('months') ?? '6', 10)
  const format = searchParams.get('format')

  try {
    const data = await getMonthlyTrends(Math.min(months, 24))

    if (format === 'csv') {
      const rows = [
        ['Month', 'Income', 'Expenses', 'Net'],
        ...data.map((row) => [
          csvField(row.month),
          csvField((row.income / 100).toFixed(2)),
          csvField((row.expenses / 100).toFixed(2)),
          csvField((row.net / 100).toFixed(2)),
        ]),
      ]
      const csv = rows.map((r) => r.join(',')).join('\n')
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="trends.csv"',
        },
      })
    }

    return apiSuccess(data)
  } catch (err) {
    console.error('[reports/trends:GET]', err)
    return apiError('Failed to fetch trend data', 500)
  }
}
