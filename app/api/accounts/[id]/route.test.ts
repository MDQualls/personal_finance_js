import { PATCH } from './route'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { mockSession, noSession } from '@/lib/__mocks__/auth'
import { mockAccount } from '@/__tests__/factories/account'

describe('PATCH /api/accounts/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()
    const req = new Request('http://localhost/api/accounts/cuid_account_1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
    })
    const res = await PATCH(req as never, { params: { id: 'cuid_account_1' } })
    expect(res.status).toBe(401)
  })

  it('updates account fields', async () => {
    mockSession()
    const updated = mockAccount({ name: 'New Name', type: 'SAVINGS' })
    prismaMock.account.update.mockResolvedValue(updated)

    const req = new Request('http://localhost/api/accounts/cuid_account_1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'New Name', type: 'SAVINGS' }),
    })
    const res = await PATCH(req as never, { params: { id: 'cuid_account_1' } })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.name).toBe('New Name')
  })

  it('returns 400 when balance is a float', async () => {
    mockSession()
    const req = new Request('http://localhost/api/accounts/cuid_account_1', {
      method: 'PATCH',
      body: JSON.stringify({ balance: 99.99 }),
    })
    const res = await PATCH(req as never, { params: { id: 'cuid_account_1' } })
    expect(res.status).toBe(400)
  })

  it('returns 400 when type is invalid', async () => {
    mockSession()
    const req = new Request('http://localhost/api/accounts/cuid_account_1', {
      method: 'PATCH',
      body: JSON.stringify({ type: 'PIGGY_BANK' }),
    })
    const res = await PATCH(req as never, { params: { id: 'cuid_account_1' } })
    expect(res.status).toBe(400)
  })

  it('returns 500 on DB error', async () => {
    mockSession()
    prismaMock.account.update.mockRejectedValue(new Error('DB error'))

    const req = new Request('http://localhost/api/accounts/cuid_account_1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
    })
    const res = await PATCH(req as never, { params: { id: 'cuid_account_1' } })
    expect(res.status).toBe(500)
  })
})
