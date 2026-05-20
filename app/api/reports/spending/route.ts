import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiSuccess, apiError } from '@/lib/api'
import { getSpendingByCategory } from '@/lib/reports'

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
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const format = searchParams.get('format')

  const now = new Date()
  const fromDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1)
  const toDate = to ? new Date(to) : new Date(now.getFullYear(), now.getMonth() + 1, 0)

  try {
    const data = await getSpendingByCategory(fromDate, toDate)

    if (format === 'csv') {
      const rows = [
        ['Category', 'Amount', 'Percentage'],
        ...data.map((row) => [
          csvField(row.categoryName),
          csvField((row.amount / 100).toFixed(2)),
          csvField(row.percentage),
        ]),
      ]
      const csv = rows.map((r) => r.join(',')).join('\n')
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="spending.csv"',
        },
      })
    }

    return apiSuccess(data)
  } catch (err) {
    console.error('[reports/spending:GET]', err)
    return apiError('Failed to fetch spending data', 500)
  }
}
