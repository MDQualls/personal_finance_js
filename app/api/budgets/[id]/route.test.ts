import { PATCH, DELETE } from './route'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { mockSession, noSession } from '@/lib/__mocks__/auth'
import { mockBudget } from '@/__tests__/factories/budget'
import { mockCategory } from '@/__tests__/factories/category'

describe('PATCH /api/budgets/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()
    const req = new Request('http://localhost/api/budgets/cuid_budget_1', {
      method: 'PATCH',
      body: JSON.stringify({ amount: 60000 }),
    })
    const res = await PATCH(req as never, { params: { id: 'cuid_budget_1' } })
    expect(res.status).toBe(401)
  })

  it('updates budget fields', async () => {
    mockSession()
    const cat = mockCategory()
    const updated = mockBudget({ amount: 60000 })
    prismaMock.budget.update.mockResolvedValue({ ...updated, category: cat } as never)

    const req = new Request('http://localhost/api/budgets/cuid_budget_1', {
      method: 'PATCH',
      body: JSON.stringify({ amount: 60000 }),
    })
    const res = await PATCH(req as never, { params: { id: 'cuid_budget_1' } })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.amount).toBe(60000)
  })

  it('returns 400 when amount is a float', async () => {
    mockSession()
    const req = new Request('http://localhost/api/budgets/cuid_budget_1', {
      method: 'PATCH',
      body: JSON.stringify({ amount: 600.50 }),
    })
    const res = await PATCH(req as never, { params: { id: 'cuid_budget_1' } })
    expect(res.status).toBe(400)
  })

  it('can restore an archived budget via isActive: true', async () => {
    mockSession()
    const cat = mockCategory()
    const restored = mockBudget({ isActive: true })
    prismaMock.budget.update.mockResolvedValue({ ...restored, category: cat } as never)

    const req = new Request('http://localhost/api/budgets/cuid_budget_1', {
      method: 'PATCH',
      body: JSON.stringify({ isActive: true }),
    })
    const res = await PATCH(req as never, { params: { id: 'cuid_budget_1' } })

    expect(res.status).toBe(200)
    expect(prismaMock.budget.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: true }) })
    )
  })

  it('returns 500 on DB error', async () => {
    mockSession()
    prismaMock.budget.update.mockRejectedValue(new Error('DB error'))

    const req = new Request('http://localhost/api/budgets/cuid_budget_1', {
      method: 'PATCH',
      body: JSON.stringify({ amount: 60000 }),
    })
    const res = await PATCH(req as never, { params: { id: 'cuid_budget_1' } })
    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/budgets/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()
    const req = new Request('http://localhost/api/budgets/cuid_budget_1', { method: 'DELETE' })
    const res = await DELETE(req as never, { params: { id: 'cuid_budget_1' } })
    expect(res.status).toBe(401)
  })

  it('soft-deletes by setting isActive: false', async () => {
    mockSession()
    const budget = mockBudget()
    prismaMock.budget.update.mockResolvedValue({ ...budget, isActive: false })

    const req = new Request('http://localhost/api/budgets/cuid_budget_1', { method: 'DELETE' })
    const res = await DELETE(req as never, { params: { id: 'cuid_budget_1' } })

    expect(res.status).toBe(200)
    expect(prismaMock.budget.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } })
    )
  })

  it('does not call prisma.budget.delete (hard delete must not happen)', async () => {
    mockSession()
    prismaMock.budget.update.mockResolvedValue(mockBudget() as never)

    const req = new Request('http://localhost/api/budgets/cuid_budget_1', { method: 'DELETE' })
    await DELETE(req as never, { params: { id: 'cuid_budget_1' } })

    expect(prismaMock.budget.delete).not.toHaveBeenCalled()
  })

  it('returns 500 on DB error', async () => {
    mockSession()
    prismaMock.budget.update.mockRejectedValue(new Error('DB error'))

    const req = new Request('http://localhost/api/budgets/cuid_budget_1', { method: 'DELETE' })
    const res = await DELETE(req as never, { params: { id: 'cuid_budget_1' } })
    expect(res.status).toBe(500)
  })
})
