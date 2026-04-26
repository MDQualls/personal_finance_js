import { GET, POST } from './route'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { mockSession, noSession } from '@/lib/__mocks__/auth'
import { mockAccount } from '@/__tests__/factories/account'

describe('GET /api/accounts', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()

    const req = new Request('http://localhost/api/accounts')
    const res = await GET(req as never)

    expect(res.status).toBe(401)
  })

  it('returns active accounts', async () => {
    mockSession()
    const accounts = [mockAccount(), mockAccount()]
    prismaMock.account.findMany.mockResolvedValue(accounts)

    const req = new Request('http://localhost/api/accounts')
    const res = await GET(req as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(2)
  })

  it('returns 500 on DB error', async () => {
    mockSession()
    prismaMock.account.findMany.mockRejectedValue(new Error('DB down'))

    const req = new Request('http://localhost/api/accounts')
    const res = await GET(req as never)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to fetch accounts')
  })
})

describe('POST /api/accounts', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()

    const req = new Request('http://localhost/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Checking', type: 'CHECKING', balance: 0 }),
    })
    const res = await POST(req as never)

    expect(res.status).toBe(401)
  })

  it('creates an account with valid data', async () => {
    mockSession()
    const account = mockAccount({ name: 'My Checking', type: 'CHECKING' })
    prismaMock.account.create.mockResolvedValue(account)

    const req = new Request('http://localhost/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'My Checking', type: 'CHECKING', balance: 0 }),
    })
    const res = await POST(req as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.name).toBe('My Checking')
  })

  it('returns 400 with invalid type', async () => {
    mockSession()

    const req = new Request('http://localhost/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', type: 'INVALID', balance: 0 }),
    })
    const res = await POST(req as never)

    expect(res.status).toBe(400)
  })

  it('returns 400 when name is missing', async () => {
    mockSession()

    const req = new Request('http://localhost/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ type: 'CHECKING', balance: 0 }),
    })
    const res = await POST(req as never)

    expect(res.status).toBe(400)
  })

  it('returns 400 when balance is a float', async () => {
    mockSession()

    const req = new Request('http://localhost/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', type: 'CHECKING', balance: 99.99 }),
    })
    const res = await POST(req as never)

    expect(res.status).toBe(400)
  })
})
