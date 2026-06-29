import { prisma } from '@/lib/prisma'
import type { Transaction } from '@/types'

export type ExportParams = {
  from: Date
  to: Date
  accountId?: string
  categoryId?: string
}

export async function fetchTransactionsForExport(params: ExportParams): Promise<Transaction[]> {
  const { from, to, accountId, categoryId } = params
  return prisma.transaction.findMany({
    where: {
      deletedAt: null,
      date: { gte: from, lte: to },
      ...(accountId ? { accountId } : {}),
      ...(categoryId ? { categoryId } : {}),
    },
    include: { category: true, tags: true, account: true },
    orderBy: { date: 'desc' },
  }) as Promise<Transaction[]>
}

function csvField(value: string | number): string {
  const str = String(value)
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str
}

export function serializeTransactionsToCsv(transactions: Transaction[]): string {
  const headers = ['Date', 'Description', 'Amount', 'Account', 'Category', 'Tags', 'Notes']
  const rows = transactions.map((tx) => {
    const date = tx.date instanceof Date ? tx.date.toISOString().split('T')[0] : String(tx.date)
    const tags = tx.tags?.map((t) => t.name).join('; ') ?? ''
    return [
      csvField(date),
      csvField(tx.description),
      csvField((tx.amount / 100).toFixed(2)),
      csvField(tx.account?.name ?? ''),
      csvField(tx.category?.name ?? ''),
      csvField(tags),
      csvField(tx.notes ?? ''),
    ].join(',')
  })
  return [headers.join(','), ...rows].join('\n')
}
