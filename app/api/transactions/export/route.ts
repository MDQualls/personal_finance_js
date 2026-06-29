import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { apiError } from '@/lib/api'
import { fetchTransactionsForExport, serializeTransactionsToCsv } from '@/lib/transactionExport'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const accountId = searchParams.get('accountId') ?? undefined
  const categoryId = searchParams.get('categoryId') ?? undefined

  if (!from || !to) return apiError('from and to date parameters are required', 400)

  try {
    const transactions = await fetchTransactionsForExport({
      from: new Date(from),
      to: new Date(to),
      accountId,
      categoryId,
    })

    const csv = serializeTransactionsToCsv(transactions)
    const fromLabel = from.slice(0, 10)
    const toLabel = to.slice(0, 10)

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="transactions-${fromLabel}-to-${toLabel}.csv"`,
      },
    })
  } catch (err) {
    console.error('[transactions/export:GET]', err)
    return apiError('Failed to export transactions', 500)
  }
}
