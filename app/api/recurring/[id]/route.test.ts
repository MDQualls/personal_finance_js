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
