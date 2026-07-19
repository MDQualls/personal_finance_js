import { GET, POST } from './route'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { mockSession, noSession } from '@/lib/__mocks__/auth'
import { mockRecurringRule } from '@/__tests__/factories/recurringRule'

const VALID_PAYLOAD = {
  name: 'Monthly Paycheck',
  amount: 350000,
  frequency: 'MONTHLY',
  accountId: 'cuid_account_1',
  categoryId: 'cuid_category_1',
  nextDate: '2026-05-01T00:00:00.000Z',
  type: 'INCOME',
  autoPost: true,
}

const EXPENSE_PAYLOAD = {
  ...VALID_PAYLOAD,
  name: 'Rent',
  amount: -150000,
  type: 'EXPENSE',
}

describe('GET /api/recurring', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()
    const req = new Request('http://localhost/api/recurring')
    const res = await GET(req as never)
    expect(res.status).toBe(401)
  })

  it('returns only active rules by default', async () => {
    mockSession()
    prismaMock.recurringRule.findMany.mockResolvedValue([mockRecurringRule()] as never)

    const req = new Request('http://localhost/api/recurring')
    const res = await GET(req as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(prismaMock.recurringRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    )
  })

  it('filters by type when query param provided', async () => {
    mockSession()
    prismaMock.recurringRule.findMany.mockResolvedValue([mockRecurringRule()] as never)

    const req = new Request('http://localhost/api/recurring?type=INCOME')
    await GET(req as never)

    expect(prismaMock.recurringRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'INCOME' }),
      })
    )
  })

  it('returns 500 on DB error', async () => {
    mockSession()
    prismaMock.recurringRule.findMany.mockRejectedValue(new Error('DB error'))

    const req = new Request('http://localhost/api/recurring')
    const res = await GET(req as never)

    expect(res.status).toBe(500)
  })
})

describe('POST /api/recurring', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()
    const req = new Request('http://localhost/api/recurring', {
      method: 'POST',
      body: JSON.stringify(VALID_PAYLOAD),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(401)
  })

  it('creates rule with valid income data', async () => {
    mockSession()
    prismaMock.account.findUnique.mockResolvedValue({ plaidManaged: false } as never)
    prismaMock.recurringRule.create.mockResolvedValue(mockRecurringRule() as never)

    const req = new Request('http://localhost/api/recurring', {
      method: 'POST',
      body: JSON.stringify(VALID_PAYLOAD),
    })
    const res = await POST(req as never)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeDefined()
  })

  it('creates rule with valid expense data', async () => {
    mockSession()
    prismaMock.account.findUnique.mockResolvedValue({ plaidManaged: false } as never)
    prismaMock.recurringRule.create.mockResolvedValue(
      mockRecurringRule({ amount: -150000, type: 'EXPENSE' }) as never
    )

    const req = new Request('http://localhost/api/recurring', {
      method: 'POST',
      body: JSON.stringify(EXPENSE_PAYLOAD),
    })
    const res = await POST(req as never)

    expect(res.status).toBe(200)
  })

  it('rejects income rule with negative amount', async () => {
    mockSession()

    const req = new Request('http://localhost/api/recurring', {
      method: 'POST',
      body: JSON.stringify({ ...VALID_PAYLOAD, amount: -350000, type: 'INCOME' }),
    })
    const res = await POST(req as never)

    expect(res.status).toBe(400)
  })

  it('rejects expense rule with positive amount', async () => {
    mockSession()

    const req = new Request('http://localhost/api/recurring', {
      method: 'POST',
      body: JSON.stringify({ ...EXPENSE_PAYLOAD, amount: 150000, type: 'EXPENSE' }),
    })
    const res = await POST(req as never)

    expect(res.status).toBe(400)
  })

  it('rejects missing required fields', async () => {
    mockSession()

    const req = new Request('http://localhost/api/recurring', {
      method: 'POST',
      body: JSON.stringify({ name: 'Incomplete' }),
    })
    const res = await POST(req as never)

    expect(res.status).toBe(400)
  })

  it('returns 500 on DB error', async () => {
    mockSession()
    prismaMock.account.findUnique.mockResolvedValue({ plaidManaged: false } as never)
    prismaMock.recurringRule.create.mockRejectedValue(new Error('DB error'))

    const req = new Request('http://localhost/api/recurring', {
      method: 'POST',
      body: JSON.stringify(VALID_PAYLOAD),
    })
    const res = await POST(req as never)

    expect(res.status).toBe(500)
  })

  it('rejects autoPost: true on a Plaid-managed account with 422', async () => {
    mockSession()
    prismaMock.account.findUnique.mockResolvedValue({ plaidManaged: true } as never)

    const req = new Request('http://localhost/api/recurring', {
      method: 'POST',
      body: JSON.stringify(VALID_PAYLOAD),
    })
    const res = await POST(req as never)

    expect(res.status).toBe(422)
    expect(prismaMock.recurringRule.create).not.toHaveBeenCalled()
  })

  it('allows autoPost: false on a Plaid-managed account', async () => {
    mockSession()
    prismaMock.account.findUnique.mockResolvedValue({ plaidManaged: true } as never)
    prismaMock.recurringRule.create.mockResolvedValue(mockRecurringRule({ autoPost: false }) as never)

    const req = new Request('http://localhost/api/recurring', {
      method: 'POST',
      body: JSON.stringify({ ...VALID_PAYLOAD, autoPost: false }),
    })
    const res = await POST(req as never)

    expect(res.status).toBe(200)
  })
})
