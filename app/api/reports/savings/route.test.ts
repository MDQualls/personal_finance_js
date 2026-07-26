import { GET } from './route'
import { mockSession, noSession } from '@/lib/__mocks__/auth'

jest.mock('@/lib/reports', () => ({
  getSavingsSummary: jest.fn(),
}))

import { getSavingsSummary } from '@/lib/reports'
const mockGetSavingsSummary = getSavingsSummary as jest.Mock

describe('GET /api/reports/savings', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    noSession()
    const res = await GET(new Request('http://localhost/api/reports/savings') as never)
    expect(res.status).toBe(401)
  })

  it('returns the savings summary', async () => {
    mockSession()
    mockGetSavingsSummary.mockResolvedValue({
      currentAmount: 400000,
      priorAmount: 200000,
      delta: 200000,
      percentChange: 100,
    })

    const res = await GET(new Request('http://localhost/api/reports/savings') as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual({
      currentAmount: 400000,
      priorAmount: 200000,
      delta: 200000,
      percentChange: 100,
    })
  })

  it('passes the parsed from date through to getSavingsSummary', async () => {
    mockSession()
    mockGetSavingsSummary.mockResolvedValue({ currentAmount: 0, priorAmount: 0, delta: 0, percentChange: null })

    await GET(new Request('http://localhost/api/reports/savings?from=2026-07-15') as never)

    const [anchorArg] = mockGetSavingsSummary.mock.calls[0]
    expect(anchorArg.toISOString().slice(0, 10)).toBe('2026-07-15')
  })

  it('returns 500 on lib error', async () => {
    mockSession()
    mockGetSavingsSummary.mockRejectedValue(new Error('DB error'))

    const res = await GET(new Request('http://localhost/api/reports/savings') as never)
    expect(res.status).toBe(500)
  })
})
