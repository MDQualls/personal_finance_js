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
  // Prisma's inferred return type (from this specific `include`) is structurally
  // compatible with the hand-written @/types Transaction shape, but TS can't prove
  // that through the dynamic spread in `where` — cast rather than duplicate the
  // relation-inclusion type here.
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

// A leading =, +, -, @, tab, or CR is interpreted as a formula by Excel/Sheets when
// a CSV is opened — a description imported verbatim (lib/normalize.ts's sanitizer
// only strips control characters, not these) could otherwise execute on open.
// Prefixing with a single quote forces text interpretation (standard OWASP CSV
// injection mitigation). Only applied to freeform/user-influenced text fields —
// never to the amount field, where a leading "-" is a legitimate negative number.
export function escapeFormulaInjection(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

export function csvField(value: string | number): string {
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
      csvField(escapeFormulaInjection(tx.description)),
      csvField((tx.amount / 100).toFixed(2)),
      csvField(escapeFormulaInjection(tx.account?.name ?? '')),
      csvField(escapeFormulaInjection(tx.category?.name ?? '')),
      csvField(escapeFormulaInjection(tags)),
      csvField(escapeFormulaInjection(tx.notes ?? '')),
    ].join(',')
  })
  return [headers.join(','), ...rows].join('\n')
}
