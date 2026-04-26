import { GET } from './route'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { mockSession, noSession } from '@/lib/__mocks__/auth'

const mockInsight = {
  id: 'cuid_insight_1',
  period: '2026-04',
  prompt: 'mock prompt',
  response: { summary: 'Test' },
  generatedAt: new Date('2026-04-01T00:00:00Z'),
}

describe('GET /api/insights/[period]', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()
    const res = await GET(
      new Request('http://localhost/api/insights/2026-04') as never,
      { params: { period: '2026-04' } }
    )
    expect(res.status).toBe(401)
  })

  it('returns a cached insight for a valid period', async () => {
    mockSession()
    prismaMock.aIInsight.findUnique.mockResolvedValue(mockInsight as never)

    const res = await GET(
      new Request('http://localhost/api/insights/2026-04') as never,
      { params: { period: '2026-04' } }
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.period).toBe('2026-04')
  })

  it('returns 404 when no insight exists for the period', async () => {
    mockSession()
    prismaMock.aIInsight.findUnique.mockResolvedValue(null)

    const res = await GET(
      new Request('http://localhost/api/insights/2026-03') as never,
      { params: { period: '2026-03' } }
    )
    expect(res.status).toBe(404)
  })

  it('returns 500 on DB error', async () => {
    mockSession()
    prismaMock.aIInsight.findUnique.mockRejectedValue(new Error('DB error'))

    const res = await GET(
      new Request('http://localhost/api/insights/2026-04') as never,
      { params: { period: '2026-04' } }
    )
    expect(res.status).toBe(500)
  })
})
