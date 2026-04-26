import { prisma } from './prisma'
import { format } from './dates'
import { subMonths, startOfMonth, endOfMonth } from 'date-fns'
import type { SpendingByCategory, MonthlyTrend, NetWorthSnapshot } from '@/types'

export async function getSpendingByCategory(from: Date, to: Date): Promise<SpendingByCategory[]> {
  const transactions = await prisma.transaction.findMany({
    where: {
      deletedAt: null,
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
  const results: MonthlyTrend[] = []
  const now = new Date()

  for (let i = months - 1; i >= 0; i--) {
    const monthDate = subMonths(now, i)
    const start = startOfMonth(monthDate)
    const end = endOfMonth(monthDate)

    const transactions = await prisma.transaction.findMany({
      where: { deletedAt: null, date: { gte: start, lte: end } },
      include: { category: true },
    })

    let income = 0
    let expenses = 0
    const byCategory: Record<string, number> = {}

    for (const tx of transactions) {
      if (tx.amount > 0) {
        income += tx.amount
      } else {
        const abs = Math.abs(tx.amount)
        expenses += abs
        byCategory[tx.category.name] = (byCategory[tx.category.name] ?? 0) + abs
      }
    }

    results.push({
      month: format(monthDate, 'MMM yyyy'),
      income,
      expenses,
      net: income - expenses,
      byCategory,
    })
  }

  return results
}

export async function getNetWorthHistory(months = 12): Promise<NetWorthSnapshot[]> {
  const results: NetWorthSnapshot[] = []
  const now = new Date()

  const accounts = await prisma.account.findMany({ where: { isActive: true } })

  for (let i = months - 1; i >= 0; i--) {
    const monthDate = subMonths(now, i)

    let assets = 0
    let liabilities = 0

    for (const account of accounts) {
      if (['CHECKING', 'SAVINGS', 'INVESTMENT', 'ASSET'].includes(account.type)) {
        assets += account.balance
      } else {
        liabilities += Math.abs(account.balance)
      }
    }

    results.push({
      month: format(monthDate, 'MMM yyyy'),
      assets,
      liabilities,
      netWorth: assets - liabilities,
    })
  }

  return results
}
