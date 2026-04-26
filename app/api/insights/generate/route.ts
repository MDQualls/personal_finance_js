import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { anthropic, buildInsightPrompt, type InsightResponse } from '@/lib/anthropic'
import { apiSuccess, apiError } from '@/lib/api'
import { checkInsightsRateLimit, getClientIp } from '@/lib/rateLimit'
import { startOfPeriod, endOfPeriod } from '@/lib/dates'
import { monthlyEquivalent } from '@/lib/money'
import { differenceInHours } from 'date-fns'

const GenerateSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be in YYYY-MM format'),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const ip = getClientIp(req)
  if (!checkInsightsRateLimit(ip)) {
    return apiError('Rate limit exceeded. Try again later.', 429)
  }

  const body: unknown = await req.json()
  const result = GenerateSchema.safeParse(body)
  if (!result.success) return apiError(result.error.format(), 400)

  const { period } = result.data

  try {
    // Check cache — return if fresh (< 24h)
    const cached = await prisma.aIInsight.findUnique({ where: { period } })
    if (cached) {
      const ageHours = differenceInHours(new Date(), cached.generatedAt)
      if (ageHours < 24) {
        return apiSuccess({ ...cached, cached: true })
      }
    }

    // Aggregate data server-side — never send raw transactions
    const [year, month] = period.split('-').map(Number)
    const periodDate = new Date(year, month - 1, 1)
    const start = startOfPeriod(periodDate, 'MONTHLY')
    const end = endOfPeriod(periodDate, 'MONTHLY')

    const priorDate = new Date(year, month - 2, 1)
    const priorStart = startOfPeriod(priorDate, 'MONTHLY')
    const priorEnd = endOfPeriod(priorDate, 'MONTHLY')

    const [transactions, budgets, subscriptions, priorTransactions] = await Promise.all([
      prisma.transaction.findMany({
        where: { deletedAt: null, date: { gte: start, lte: end } },
        include: { category: true },
      }),
      prisma.budget.findMany({ include: { category: true } }),
      prisma.subscription.findMany({ where: { isActive: true } }),
      prisma.transaction.findMany({
        where: { deletedAt: null, date: { gte: priorStart, lte: priorEnd } },
        include: { category: true },
      }),
    ])

    // Aggregate category totals
    const catMap = new Map<string, { name: string; amount: number }>()
    let totalIncome = 0
    let totalExpenses = 0

    for (const tx of transactions) {
      if (tx.amount > 0) {
        totalIncome += tx.amount
      } else {
        const abs = Math.abs(tx.amount)
        totalExpenses += abs
        const existing = catMap.get(tx.category.name)
        catMap.set(tx.category.name, {
          name: tx.category.name,
          amount: (existing?.amount ?? 0) + abs,
        })
      }
    }

    // Prior period totals for mom delta
    const priorCatMap = new Map<string, { name: string; amount: number }>()
    for (const tx of priorTransactions) {
      if (tx.amount < 0) {
        const abs = Math.abs(tx.amount)
        const existing = priorCatMap.get(tx.category.name)
        priorCatMap.set(tx.category.name, {
          name: tx.category.name,
          amount: (existing?.amount ?? 0) + abs,
        })
      }
    }

    // Budget utilization
    const categoryTotals = [...catMap.values()].map((cat) => {
      const budget = budgets.find((b) => b.category.name === cat.name)
      return { ...cat, budgeted: budget?.amount ?? null }
    })

    const accounts = await prisma.account.findMany({ where: { isActive: true } })
    const currentBalance = accounts.reduce((sum, a) => {
      if (['CHECKING', 'SAVINGS', 'INVESTMENT', 'ASSET'].includes(a.type)) return sum + a.balance
      return sum - Math.abs(a.balance)
    }, 0)

    const aggregatedData = {
      period,
      categoryTotals,
      subscriptionCosts: subscriptions.map((s) => ({
        name: s.name,
        amount: s.amount,
        frequency: s.frequency,
        isActive: s.isActive,
        monthlyAmount: monthlyEquivalent(s.amount, s.frequency),
      })),
      totalIncome,
      totalExpenses,
      currentBalance,
      priorPeriodCategoryTotals: [...priorCatMap.values()],
    }

    const prompt = buildInsightPrompt(aggregatedData)

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
    const insight: InsightResponse = JSON.parse(rawText)

    const saved = await prisma.aIInsight.upsert({
      where: { period },
      create: { period, prompt, response: insight as never, generatedAt: new Date() },
      update: { prompt, response: insight as never, generatedAt: new Date() },
    })

    return apiSuccess({ ...saved, cached: false })
  } catch (err) {
    console.error('[insights/generate:POST]', err)
    return apiError('Failed to generate insights', 500)
  }
}
