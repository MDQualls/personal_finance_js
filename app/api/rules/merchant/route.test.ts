import { GET, POST } from './route'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { mockSession, noSession } from '@/lib/__mocks__/auth'

const mockMerchantRule = (overrides = {}) => ({
  id: 'cuid_merchant_1',
  pattern: 'TRADER JOE',
  isRegex: false,
  displayName: "Trader Joe's",
  createdAt: new Date('2026-05-01T00:00:00Z'),
  updatedAt: new Date('2026-05-01T00:00:00Z'),
  ...overrides,
})

describe('GET /api/rules/merchant', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()
    const res = await GET(new Request('http://localhost/api/rules/merchant') as never)
    expect(res.status).toBe(401)
  })

  it('returns list of merchant rules', async () => {
    mockSession()
    prismaMock.merchantRule.findMany.mockResolvedValue([mockMerchantRule()])

    const res = await GET(new Request('http://localhost/api/rules/merchant') as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].displayName).toBe("Trader Joe's")
  })

  it('returns empty array when no rules exist', async () => {
    mockSession()
    prismaMock.merchantRule.findMany.mockResolvedValue([])

    const res = await GET(new Request('http://localhost/api/rules/merchant') as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(0)
  })

  it('returns 500 on DB error', async () => {
    mockSession()
    prismaMock.merchantRule.findMany.mockRejectedValue(new Error('DB error'))

    const res = await GET(new Request('http://localhost/api/rules/merchant') as never)
    expect(res.status).toBe(500)
  })
})

describe('POST /api/rules/merchant', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()
    const req = new Request('http://localhost/api/rules/merchant', {
      method: 'POST',
      body: JSON.stringify({ pattern: 'TRADER JOE', isRegex: false, displayName: "Trader Joe's" }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(401)
  })

  it('creates a merchant rule with valid data', async () => {
    mockSession()
    prismaMock.merchantRule.create.mockResolvedValue(mockMerchantRule())

    const req = new Request('http://localhost/api/rules/merchant', {
      method: 'POST',
      body: JSON.stringify({ pattern: 'TRADER JOE', isRegex: false, displayName: "Trader Joe's" }),
    })
    const res = await POST(req as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.displayName).toBe("Trader Joe's")
  })

  it('creates a regex rule', async () => {
    mockSession()
    const rule = mockMerchantRule({ pattern: 'AMZN\\s*MKTP', isRegex: true, displayName: 'Amazon' })
    prismaMock.merchantRule.create.mockResolvedValue(rule)

    const req = new Request('http://localhost/api/rules/merchant', {
      method: 'POST',
      body: JSON.stringify({ pattern: 'AMZN\\s*MKTP', isRegex: true, displayName: 'Amazon' }),
    })
    const res = await POST(req as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.isRegex).toBe(true)
  })

  it('returns 400 when pattern is missing', async () => {
    mockSession()
    const req = new Request('http://localhost/api/rules/merchant', {
      method: 'POST',
      body: JSON.stringify({ isRegex: false, displayName: "Trader Joe's" }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when displayName is missing', async () => {
    mockSession()
    const req = new Request('http://localhost/api/rules/merchant', {
      method: 'POST',
      body: JSON.stringify({ pattern: 'TRADER JOE', isRegex: false }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when pattern is empty string', async () => {
    mockSession()
    const req = new Request('http://localhost/api/rules/merchant', {
      method: 'POST',
      body: JSON.stringify({ pattern: '', isRegex: false, displayName: "Trader Joe's" }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('returns 500 on DB error', async () => {
    mockSession()
    prismaMock.merchantRule.create.mockRejectedValue(new Error('DB error'))

    const req = new Request('http://localhost/api/rules/merchant', {
      method: 'POST',
      body: JSON.stringify({ pattern: 'TRADER JOE', isRegex: false, displayName: "Trader Joe's" }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(500)
  })
})
