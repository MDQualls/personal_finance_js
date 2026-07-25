import { GET } from './route'
import { mockSession, noSession } from '@/lib/__mocks__/auth'

jest.mock('@/lib/reports', () => ({
  getCostFloor: jest.fn(),
}))

import { getCostFloor } from '@/lib/reports'
const mockGetCostFloor = getCostFloor as jest.Mock

describe('GET /api/reports/cost-floor', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    noSession()
    const res = await GET(new Request('http://localhost/api/reports/cost-floor') as never)
    expect(res.status).toBe(401)
  })

  it('returns the cost floor data', async () => {
    mockSession()
    mockGetCostFloor.mockResolvedValue({
      recurringExpenses: 150000,
      subscriptions: 24099,
      totalMonthly: 174099,
    })

    const res = await GET(new Request('http://localhost/api/reports/cost-floor') as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual({
      recurringExpenses: 150000,
      subscriptions: 24099,
      totalMonthly: 174099,
    })
  })

  it('returns 500 on lib error', async () => {
    mockSession()
    mockGetCostFloor.mockRejectedValue(new Error('DB error'))

    const res = await GET(new Request('http://localhost/api/reports/cost-floor') as never)
    expect(res.status).toBe(500)
  })
})
