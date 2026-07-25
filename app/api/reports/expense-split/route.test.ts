import { GET } from './route'
import { mockSession, noSession } from '@/lib/__mocks__/auth'

jest.mock('@/lib/reports', () => ({
  getExpenseSplit: jest.fn(),
}))

import { getExpenseSplit } from '@/lib/reports'
const mockGetExpenseSplit = getExpenseSplit as jest.Mock

const splitResult = {
  fixed: { total: 150000, percentage: 75, categories: [] },
  variable: { total: 50000, percentage: 25, categories: [] },
}

describe('GET /api/reports/expense-split', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    noSession()
    const res = await GET(new Request('http://localhost/api/reports/expense-split') as never)
    expect(res.status).toBe(401)
  })

  it('returns the expense split data', async () => {
    mockSession()
    mockGetExpenseSplit.mockResolvedValue(splitResult)

    const res = await GET(new Request('http://localhost/api/reports/expense-split?from=2026-07-01&to=2026-07-31') as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual(splitResult)
  })

  it('passes the parsed from/to dates through to the lib function', async () => {
    mockSession()
    mockGetExpenseSplit.mockResolvedValue(splitResult)

    await GET(new Request('http://localhost/api/reports/expense-split?from=2026-07-01&to=2026-07-31') as never)

    const [fromArg, toArg] = mockGetExpenseSplit.mock.calls[0]
    expect(fromArg.toISOString().slice(0, 10)).toBe('2026-07-01')
    expect(toArg.toISOString().slice(0, 10)).toBe('2026-07-31')
  })

  it('defaults to the current month when from/to are omitted', async () => {
    mockSession()
    mockGetExpenseSplit.mockResolvedValue(splitResult)

    await GET(new Request('http://localhost/api/reports/expense-split') as never)

    expect(mockGetExpenseSplit).toHaveBeenCalledWith(expect.any(Date), expect.any(Date))
  })

  it('returns 500 on lib error', async () => {
    mockSession()
    mockGetExpenseSplit.mockRejectedValue(new Error('DB error'))

    const res = await GET(new Request('http://localhost/api/reports/expense-split') as never)
    expect(res.status).toBe(500)
  })
})
