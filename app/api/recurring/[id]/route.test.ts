import { PATCH, DELETE } from './route'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { mockSession, noSession } from '@/lib/__mocks__/auth'
import { mockRecurringRule } from '@/__tests__/factories/recurringRule'

const RULE_ID = 'cuid_rule_1'
const params = { params: { id: RULE_ID } }

describe('PATCH /api/recurring/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()
    const req = new Request(`http://localhost/api/recurring/${RULE_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
    })
    const res = await PATCH(req as never, params)
    expect(res.status).toBe(401)
  })

  it('updates rule fields', async () => {
    mockSession()
    prismaMock.recurringRule.findUnique.mockResolvedValue(
      mockRecurringRule({ autoPost: false }) as never
    )
    prismaMock.recurringRule.update.mockResolvedValue(
      mockRecurringRule({ name: 'Updated' }) as never
    )

    const req = new Request(`http://localhost/api/recurring/${RULE_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
    })
    const res = await PATCH(req as never, params)

    expect(res.status).toBe(200)
    expect(prismaMock.recurringRule.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: RULE_ID } })
    )
  })

  it('converts nextDate string to Date object', async () => {
    mockSession()
    prismaMock.recurringRule.findUnique.mockResolvedValue(
      mockRecurringRule({ autoPost: false }) as never
    )
    prismaMock.recurringRule.update.mockResolvedValue(mockRecurringRule() as never)

    const req = new Request(`http://localhost/api/recurring/${RULE_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ nextDate: '2026-06-01T00:00:00.000Z' }),
    })
    await PATCH(req as never, params)

    expect(prismaMock.recurringRule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nextDate: expect.any(Date) }),
      })
    )
  })

  it('returns 400 on invalid payload', async () => {
    mockSession()

    const req = new Request(`http://localhost/api/recurring/${RULE_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ amount: 'not-a-number' }),
    })
    const res = await PATCH(req as never, params)

    expect(res.status).toBe(400)
  })

  it('rejects flipping autoPost to true on a Plaid-managed account with 422', async () => {
    mockSession()
    prismaMock.recurringRule.findUnique.mockResolvedValue(
      mockRecurringRule({ autoPost: false, accountId: 'cuid_account_plaid' }) as never
    )
    prismaMock.account.findUnique.mockResolvedValue({ plaidManaged: true } as never)

    const req = new Request(`http://localhost/api/recurring/${RULE_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ autoPost: true }),
    })
    const res = await PATCH(req as never, params)

    expect(res.status).toBe(422)
    expect(prismaMock.recurringRule.update).not.toHaveBeenCalled()
  })

  it('rejects reassigning an already-autoPost rule to a Plaid-managed account with 422', async () => {
    mockSession()
    prismaMock.recurringRule.findUnique.mockResolvedValue(
      mockRecurringRule({ autoPost: true, accountId: 'cuid_account_manual' }) as never
    )
    prismaMock.account.findUnique.mockResolvedValue({ plaidManaged: true } as never)

    const req = new Request(`http://localhost/api/recurring/${RULE_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ accountId: 'cuid_account_plaid' }),
    })
    const res = await PATCH(req as never, params)

    expect(res.status).toBe(422)
    expect(prismaMock.recurringRule.update).not.toHaveBeenCalled()
  })

  it('allows flipping autoPost to true on a non-Plaid-managed account', async () => {
    mockSession()
    prismaMock.recurringRule.findUnique.mockResolvedValue(
      mockRecurringRule({ autoPost: false, accountId: 'cuid_account_manual' }) as never
    )
    prismaMock.account.findUnique.mockResolvedValue({ plaidManaged: false } as never)
    prismaMock.recurringRule.update.mockResolvedValue(
      mockRecurringRule({ autoPost: true }) as never
    )

    const req = new Request(`http://localhost/api/recurring/${RULE_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ autoPost: true }),
    })
    const res = await PATCH(req as never, params)

    expect(res.status).toBe(200)
  })

  it('skips the account lookup entirely when the effective autoPost is false', async () => {
    mockSession()
    prismaMock.recurringRule.findUnique.mockResolvedValue(
      mockRecurringRule({ autoPost: false, accountId: 'cuid_account_plaid' }) as never
    )
    prismaMock.recurringRule.update.mockResolvedValue(
      mockRecurringRule({ name: 'Renamed' }) as never
    )

    const req = new Request(`http://localhost/api/recurring/${RULE_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Renamed' }),
    })
    const res = await PATCH(req as never, params)

    expect(res.status).toBe(200)
    expect(prismaMock.account.findUnique).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/recurring/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()
    const req = new Request(`http://localhost/api/recurring/${RULE_ID}`, { method: 'DELETE' })
    const res = await DELETE(req as never, params)
    expect(res.status).toBe(401)
  })

  it('sets isActive = false, does not hard delete', async () => {
    mockSession()
    prismaMock.recurringRule.update.mockResolvedValue(mockRecurringRule() as never)

    const req = new Request(`http://localhost/api/recurring/${RULE_ID}`, { method: 'DELETE' })
    const res = await DELETE(req as never, params)

    expect(res.status).toBe(200)
    expect(prismaMock.recurringRule.update).toHaveBeenCalledWith({
      where: { id: RULE_ID },
      data: { isActive: false },
    })
    expect(prismaMock.recurringRule.delete).not.toHaveBeenCalled()
  })

  it('returns deactivated: true in response', async () => {
    mockSession()
    prismaMock.recurringRule.update.mockResolvedValue(mockRecurringRule() as never)

    const req = new Request(`http://localhost/api/recurring/${RULE_ID}`, { method: 'DELETE' })
    const res = await DELETE(req as never, params)
    const body = await res.json()

    expect(body.data.deactivated).toBe(true)
  })
})
