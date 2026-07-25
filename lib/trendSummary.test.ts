import { summarizeTrends } from './trendSummary'
import type { MonthlyTrend } from '@/types'

const trend = (overrides: Partial<MonthlyTrend> = {}): MonthlyTrend => ({
  month: 'Jan 2026',
  income: 500000,
  expenses: 300000,
  net: 200000,
  byCategory: {},
  ...overrides,
})

describe('summarizeTrends', () => {
  it('returns null for an empty trends array', () => {
    expect(summarizeTrends([])).toBeNull()
  })

  it('computes average expenses and income across all months', () => {
    const result = summarizeTrends([
      trend({ month: 'Jan 2026', expenses: 200000, income: 400000 }),
      trend({ month: 'Feb 2026', expenses: 400000, income: 600000 }),
    ])

    expect(result?.avgExpenses).toBe(300000)
    expect(result?.avgIncome).toBe(500000)
  })

  it('treats the last entry as this month and computes the delta vs. average', () => {
    const result = summarizeTrends([
      trend({ month: 'Jan 2026', expenses: 200000 }),
      trend({ month: 'Feb 2026', expenses: 500000 }),
    ])

    // average = 350000, this month (Feb, last entry) = 500000
    expect(result?.thisMonthExpenses).toBe(500000)
    expect(result?.vsAverageDelta).toBe(150000)
  })

  it('computes a negative delta when this month is below average', () => {
    const result = summarizeTrends([
      trend({ month: 'Jan 2026', expenses: 500000 }),
      trend({ month: 'Feb 2026', expenses: 200000 }),
    ])

    expect(result?.vsAverageDelta).toBe(-150000)
  })

  it('computes the average savings rate as a percentage of (net / income) per month', () => {
    const result = summarizeTrends([
      trend({ income: 400000, expenses: 300000, net: 100000 }), // 25%
      trend({ income: 400000, expenses: 200000, net: 200000 }), // 50%
    ])

    expect(result?.avgSavingsRate).toBeCloseTo(37.5, 5)
  })

  it('treats a zero-income month as a 0% savings rate for that month, not a division error', () => {
    const result = summarizeTrends([
      trend({ income: 0, expenses: 0, net: 0 }),
      trend({ income: 400000, expenses: 200000, net: 200000 }), // 50%
    ])

    expect(result?.avgSavingsRate).toBeCloseTo(25, 5)
  })

  it('identifies the best (lowest expenses) and worst (highest expenses) months', () => {
    const result = summarizeTrends([
      trend({ month: 'Jan 2026', expenses: 300000 }),
      trend({ month: 'Feb 2026', expenses: 100000 }),
      trend({ month: 'Mar 2026', expenses: 500000 }),
    ])

    expect(result?.bestMonth).toEqual({ month: 'Feb 2026', expenses: 100000 })
    expect(result?.worstMonth).toEqual({ month: 'Mar 2026', expenses: 500000 })
  })

  it('handles a single month by treating it as best, worst, and this month all at once', () => {
    const result = summarizeTrends([trend({ month: 'Jan 2026', expenses: 250000 })])

    expect(result?.bestMonth).toEqual({ month: 'Jan 2026', expenses: 250000 })
    expect(result?.worstMonth).toEqual({ month: 'Jan 2026', expenses: 250000 })
    expect(result?.thisMonthExpenses).toBe(250000)
    expect(result?.vsAverageDelta).toBe(0)
  })
})
