import { GET } from './route'
import { mockSession, noSession } from '@/lib/__mocks__/auth'

jest.mock('@/lib/reports', () => ({
  getSpendingByCategory: jest.fn(),
}))

import { getSpendingByCategory } from '@/lib/reports'
const mockGetSpending = getSpendingByCategory as jest.Mock

const spendingRow = (overrides = {}) => ({
  categoryId: 'cuid_category_1',
  categoryName: 'Groceries',
  color: '#22c55e',
  amount: 45000,
  percentage: 60,
  ...overrides,
})

describe('GET /api/reports/spending', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    noSession()
    const res = await GET(new Request('http://localhost/api/reports/spending') as never)
    expect(res.status).toBe(401)
  })

  it('returns JSON spending data by default', async () => {
    mockSession()
    mockGetSpending.mockResolvedValue([spendingRow()])

    const res = await GET(new Request('http://localhost/api/reports/spending') as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].categoryName).toBe('Groceries')
  })

  it('returns CSV when format=csv', async () => {
    mockSession()
    mockGetSpending.mockResolvedValue([spendingRow()])

    const res = await GET(new Request('http://localhost/api/reports/spending?format=csv') as never)
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/csv')
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="spending.csv"')
    expect(text).toContain('Category,Amount,Percentage')
    expect(text).toContain('Groceries,450.00,60')
  })

  it('CSV has correct number of rows (header + one per category)', async () => {
    mockSession()
    mockGetSpending.mockResolvedValue([
      spendingRow({ categoryName: 'Groceries', amount: 45000, percentage: 60 }),
      spendingRow({ categoryId: 'c2', categoryName: 'Dining', amount: 30000, percentage: 40 }),
    ])

    const res = await GET(new Request('http://localhost/api/reports/spending?format=csv') as never)
    const text = await res.text()
    const lines = text.trim().split('\n')

    expect(lines).toHaveLength(3) // header + 2 rows
  })

  it('CSV escapes category names containing commas', async () => {
    mockSession()
    mockGetSpending.mockResolvedValue([
      spendingRow({ categoryName: 'Food, Drink', amount: 10000, percentage: 100 }),
    ])

    const res = await GET(new Request('http://localhost/api/reports/spending?format=csv') as never)
    const text = await res.text()

    expect(text).toContain('"Food, Drink"')
  })

  it('returns 500 on lib error', async () => {
    mockSession()
    mockGetSpending.mockRejectedValue(new Error('DB error'))

    const res = await GET(new Request('http://localhost/api/reports/spending') as never)
    expect(res.status).toBe(500)
  })
})
