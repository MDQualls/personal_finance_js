import { prisma } from './prisma'
import { format, formatPeriodKey } from './dates'
import { subMonths, startOfMonth, endOfMonth } from 'date-fns'
import type { SpendingByCategory, MonthlyTrend, NetWorthSnapshot } from '@/types'

export async function getSpendingByCategory(from: Date, to: Date): Promise<SpendingByCategory[]> {
  const transactions = await prisma.transaction.findMany({
    where: {
      deletedAt: null,
      isTransfer: false,
      needsReview: false,
      date: { gte: from, lte: to },
      amount: { lt: 0 },
    },
    include: { category: true },
  })

  const categoryMap = new Map<string, { name: string; color: string; amount: number }>()

  for (const tx of transactions) {
    const existing = categoryMap.get(tx.categoryId)
    if (existing) {
      existing.amount += Math.abs(tx.amount)
    } else {
      categoryMap.set(tx.categoryId, {
        name: tx.category.name,
        color: tx.category.color,
        amount: Math.abs(tx.amount),
      })
    }
  }

  const total = [...categoryMap.values()].reduce((sum, c) => sum + c.amount, 0)

  return [...categoryMap.entries()]
    .map(([categoryId, { name, color, amount }]) => ({
      categoryId,
      categoryName: name,
      color,
      amount,
      percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
}

export async function getMonthlyTrends(months = 6): Promise<MonthlyTrend[]> {
  const now = new Date()
  const start = startOfMonth(subMonths(now, months - 1))
  const end = endOfMonth(now)

  const transactions = await prisma.transaction.findMany({
    where: { deletedAt: null, isTransfer: false, needsReview: false, date: { gte: start, lte: end } },
    include: { category: true },
  })

  const monthMap = new Map<string, { income: number; expenses: number; byCategory: Record<string, number> }>()

  for (let i = months - 1; i >= 0; i--) {
    monthMap.set(format(subMonths(now, i), 'MMM yyyy'), { income: 0, expenses: 0, byCategory: {} })
  }

  for (const tx of transactions) {
    const key = format(tx.date, 'MMM yyyy')
    const entry = monthMap.get(key)
    if (!entry) continue
    if (tx.amount > 0) {
      entry.income += tx.amount
    } else {
      const abs = Math.abs(tx.amount)
      entry.expenses += abs
      entry.byCategory[tx.category.name] = (entry.byCategory[tx.category.name] ?? 0) + abs
    }
  }

  return [...monthMap.entries()].map(([month, { income, expenses, byCategory }]) => ({
    month,
    income,
    expenses,
    net: income - expenses,
    byCategory,
  }))
}

export async function getNetWorthHistory(months = 12): Promise<NetWorthSnapshot[]> {
  const now = new Date()
  const currentMonthKey = formatPeriodKey(now)
  const startMonthKey = formatPeriodKey(subMonths(now, months - 1))

  const records = await prisma.netWorthRecord.findMany({
    where: { month: { gte: startMonthKey, lte: currentMonthKey } },
    orderBy: { month: 'asc' },
  })
  const recordMap = new Map(records.map((r) => [r.month, r]))

  // Current month is always computed live — no snapshot taken yet this month
  const accounts = await prisma.account.findMany({ where: { isActive: true } })
  let currentAssets = 0
  let currentLiabilities = 0
  for (const account of accounts) {
    if (['CHECKING', 'SAVINGS', 'INVESTMENT', 'ASSET'].includes(account.type)) {
      currentAssets += account.balance
    } else {
      currentLiabilities += Math.abs(account.balance)
    }
  }

  const results: NetWorthSnapshot[] = []

  for (let i = months - 1; i >= 0; i--) {
    const monthDate = subMonths(now, i)
    const monthKey = formatPeriodKey(monthDate)
    const monthLabel = format(monthDate, 'MMM yyyy')

    if (monthKey === currentMonthKey) {
      results.push({
        month: monthLabel,
        assets: currentAssets,
        liabilities: currentLiabilities,
        netWorth: currentAssets - currentLiabilities,
      })
    } else {
      const record = recordMap.get(monthKey)
      if (record) {
        results.push({
          month: monthLabel,
          assets: record.assets,
          liabilities: record.liabilities,
          netWorth: record.netWorth,
        })
      }
    }
  }

  return results
}
