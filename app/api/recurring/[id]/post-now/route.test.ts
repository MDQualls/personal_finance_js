import { POST } from './route'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { mockSession, noSession } from '@/lib/__mocks__/auth'
import { mockRecurringRule } from '@/__tests__/factories/recurringRule'

const RULE_ID = 'cuid_rule_1'
const params = { params: { id: RULE_ID } }

function setupTransaction() {
  ;(prismaMock.$transaction as jest.Mock).mockImplementation(
    async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock)
  )
}

describe('POST /api/recurring/[id]/post-now', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()
    const req = new Request(`http://localhost/api/recurring/${RULE_ID}/post-now`, { method: 'POST' })
    const res = await POST(req as never, params)
    expect(res.status).toBe(401)
  })

  it('returns 404 for unknown rule id', async () => {
    mockSession()
    prismaMock.recurringRule.findUnique.mockResolvedValue(null)

    const req = new Request(`http://localhost/api/recurring/${RULE_ID}/post-now`, { method: 'POST' })
    const res = await POST(req as never, params)

    expect(res.status).toBe(404)
  })

  it('posts the rule, creates a transaction, and updates account balance', async () => {
    mockSession()
    setupTransaction()
    const rule = mockRecurringRule({ id: RULE_ID, amount: -24037 })
    prismaMock.recurringRule.findUnique.mockResolvedValue(rule as never)
    prismaMock.transaction.create.mockResolvedValue({} as never)
    prismaMock.account.update.mockResolvedValue({} as never)
    prismaMock.recurringRule.update.mockResolvedValue({} as never)

    const req = new Request(`http://localhost/api/recurring/${RULE_ID}/post-now`, { method: 'POST' })
    const res = await POST(req as never, params)

    expect(res.status).toBe(200)
    expect(prismaMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: rule.accountId,
          categoryId: rule.categoryId,
          amount: rule.amount,
          description: rule.name,
        }),
      })
    )
    expect(prismaMock.account.update).toHaveBeenCalledWith({
      where: { id: rule.accountId },
      data: { balance: { increment: rule.amount } },
    })
    expect(prismaMock.recurringRule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: rule.id },
        data: expect.objectContaining({
          nextDate: expect.any(Date),
          lastPostedAt: expect.any(Date),
        }),
      })
    )
  })
})
