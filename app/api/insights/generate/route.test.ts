import { POST } from './route'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { mockSession, noSession } from '@/lib/__mocks__/auth'
import { mockAccount } from '@/__tests__/factories/account'

jest.mock('@/lib/anthropic', () => ({
  anthropic: {
    messages: {
      create: jest.fn(),
    },
  },
  buildInsightPrompt: jest.fn().mockReturnValue('mock prompt'),
}))

jest.mock('@/lib/rateLimit', () => ({
  checkInsightsRateLimit: jest.fn().mockReturnValue(true),
  getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
}))

const mockInsightResponse = {
  summary: 'Test summary',
  overspendCategories: [],
  subscriptionAudit: [],
  momDelta: [],
  projection: { estimatedBalance: 100000, note: 'On track' },
  recommendations: ['Save more'],
}

const mockSavedInsight = {
  id: 'cuid_insight_1',
  period: '2026-04',
  prompt: 'mock prompt',
  response: mockInsightResponse,
  generatedAt: new Date(),
}

function makeRequest(period = '2026-04') {
  return new Request('http://localhost/api/insights/generate', {
    method: 'POST',
    body: JSON.stringify({ period }),
  })
}

async function setupGenerateMocks() {
  const { anthropic } = await import('@/lib/anthropic')
  ;(anthropic.messages.create as jest.Mock).mockResolvedValue({
    content: [{ type: 'text', text: JSON.stringify(mockInsightResponse) }],
  })

  prismaMock.transaction.findMany.mockResolvedValue([])
  prismaMock.budget.findMany.mockResolvedValue([])
  prismaMock.subscription.findMany.mockResolvedValue([])
  prismaMock.account.findMany.mockResolvedValue([mockAccount()])
  prismaMock.aIInsight.upsert.mockResolvedValue(mockSavedInsight as never)
}

describe('POST /api/insights/generate', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()
    const res = await POST(makeRequest() as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 when period format is invalid', async () => {
    mockSession()
    const res = await POST(makeRequest('April 2026') as never)
    expect(res.status).toBe(400)
  })

  it('returns cached insight when fresher than 24 hours (cache hit)', async () => {
    mockSession()
    const freshInsight = {
      ...mockSavedInsight,
      generatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    }
    prismaMock.aIInsight.findUnique.mockResolvedValue(freshInsight as never)

    const res = await POST(makeRequest() as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.cached).toBe(true)
    // Should not call Anthropic or aggregate data
    const { anthropic } = await import('@/lib/anthropic')
    expect(anthropic.messages.create).not.toHaveBeenCalled()
  })

  it('regenerates when no cached insight exists (cache miss)', async () => {
    mockSession()
    prismaMock.aIInsight.findUnique.mockResolvedValue(null)
    await setupGenerateMocks()

    const res = await POST(makeRequest() as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.cached).toBe(false)
    const { anthropic } = await import('@/lib/anthropic')
    expect(anthropic.messages.create).toHaveBeenCalled()
    expect(prismaMock.aIInsight.upsert).toHaveBeenCalled()
  })

  it('regenerates when cached insight is older than 24 hours (stale cache)', async () => {
    mockSession()
    const staleInsight = {
      ...mockSavedInsight,
      generatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
    }
    prismaMock.aIInsight.findUnique.mockResolvedValue(staleInsight as never)
    await setupGenerateMocks()

    const res = await POST(makeRequest() as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.cached).toBe(false)
    const { anthropic } = await import('@/lib/anthropic')
    expect(anthropic.messages.create).toHaveBeenCalled()
  })

  it('returns 429 when rate limit is exceeded', async () => {
    mockSession()
    const { checkInsightsRateLimit } = await import('@/lib/rateLimit')
    ;(checkInsightsRateLimit as jest.Mock).mockReturnValueOnce(false)

    const res = await POST(makeRequest() as never)
    expect(res.status).toBe(429)
  })

  it('returns 500 on DB error', async () => {
    mockSession()
    prismaMock.aIInsight.findUnique.mockRejectedValue(new Error('DB error'))

    const res = await POST(makeRequest() as never)
    expect(res.status).toBe(500)
  })
})
