import { GET } from './route'
import { mockSession, noSession } from '@/lib/__mocks__/auth'

jest.mock('@/lib/reports', () => ({
  getMonthlyTrends: jest.fn(),
}))

import { getMonthlyTrends } from '@/lib/reports'
const mockGetTrends = getMonthlyTrends as jest.Mock

const trendRow = (overrides = {}) => ({
  month: 'May 2026',
  income: 500000,
  expenses: 300000,
  net: 200000,
  byCategory: { Groceries: 150000 },
  ...overrides,
})

describe('GET /api/reports/trends', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    noSession()
    const res = await GET(new Request('http://localhost/api/reports/trends') as never)
    expect(res.status).toBe(401)
  })

  it('returns JSON trend data by default', async () => {
    mockSession()
    mockGetTrends.mockResolvedValue([trendRow()])

    const res = await GET(new Request('http://localhost/api/reports/trends') as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].month).toBe('May 2026')
  })

  it('caps months at 24', async () => {
    mockSession()
    mockGetTrends.mockResolvedValue([])

    await GET(new Request('http://localhost/api/reports/trends?months=99') as never)

    expect(mockGetTrends).toHaveBeenCalledWith(24)
  })

  it('returns CSV when format=csv', async () => {
    mockSession()
    mockGetTrends.mockResolvedValue([trendRow()])

    const res = await GET(new Request('http://localhost/api/reports/trends?format=csv') as never)
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/csv')
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="trends.csv"')
    expect(text).toContain('Month,Income,Expenses,Net')
    expect(text).toContain('May 2026,5000.00,3000.00,2000.00')
  })

  it('CSV has correct number of rows (header + one per month)', async () => {
    mockSession()
    mockGetTrends.mockResolvedValue([
      trendRow({ month: 'Apr 2026' }),
      trendRow({ month: 'May 2026' }),
    ])

    const res = await GET(new Request('http://localhost/api/reports/trends?format=csv') as never)
    const text = await res.text()
    const lines = text.trim().split('\n')

    expect(lines).toHaveLength(3) // header + 2 months
  })

  it('CSV formats net correctly for negative values', async () => {
    mockSession()
    mockGetTrends.mockResolvedValue([
      trendRow({ income: 100000, expenses: 300000, net: -200000 }),
    ])

    const res = await GET(new Request('http://localhost/api/reports/trends?format=csv') as never)
    const text = await res.text()

    expect(text).toContain('-2000.00')
  })

  it('returns 500 on lib error', async () => {
    mockSession()
    mockGetTrends.mockRejectedValue(new Error('DB error'))

    const res = await GET(new Request('http://localhost/api/reports/trends') as never)
    expect(res.status).toBe(500)
  })
})
