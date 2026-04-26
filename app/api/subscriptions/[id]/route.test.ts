import { PATCH, DELETE } from './route'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { mockSession, noSession } from '@/lib/__mocks__/auth'
import { mockSubscription } from '@/__tests__/factories/subscription'
import { mockCategory } from '@/__tests__/factories/category'

describe('PATCH /api/subscriptions/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()
    const req = new Request('http://localhost/api/subscriptions/cuid_sub_1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
    })
    const res = await PATCH(req as never, { params: { id: 'cuid_sub_1' } })
    expect(res.status).toBe(401)
  })

  it('updates subscription fields', async () => {
    mockSession()
    const cat = mockCategory()
    const updated = mockSubscription({ name: 'Updated Name' })
    prismaMock.subscription.update.mockResolvedValue({ ...updated, category: cat } as never)

    const req = new Request('http://localhost/api/subscriptions/cuid_sub_1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated Name' }),
    })
    const res = await PATCH(req as never, { params: { id: 'cuid_sub_1' } })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.name).toBe('Updated Name')
  })

  it('can reactivate a cancelled subscription via isActive: true', async () => {
    mockSession()
    const cat = mockCategory()
    const sub = mockSubscription({ isActive: true })
    prismaMock.subscription.update.mockResolvedValue({ ...sub, category: cat } as never)

    const req = new Request('http://localhost/api/subscriptions/cuid_sub_1', {
      method: 'PATCH',
      body: JSON.stringify({ isActive: true }),
    })
    const res = await PATCH(req as never, { params: { id: 'cuid_sub_1' } })

    expect(res.status).toBe(200)
    expect(prismaMock.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: true }) })
    )
  })

  it('returns 400 when frequency is invalid', async () => {
    mockSession()
    const req = new Request('http://localhost/api/subscriptions/cuid_sub_1', {
      method: 'PATCH',
      body: JSON.stringify({ frequency: 'DAILY' }),
    })
    const res = await PATCH(req as never, { params: { id: 'cuid_sub_1' } })
    expect(res.status).toBe(400)
  })

  it('returns 500 on DB error', async () => {
    mockSession()
    prismaMock.subscription.update.mockRejectedValue(new Error('DB error'))

    const req = new Request('http://localhost/api/subscriptions/cuid_sub_1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
    })
    const res = await PATCH(req as never, { params: { id: 'cuid_sub_1' } })
    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/subscriptions/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()
    const req = new Request('http://localhost/api/subscriptions/cuid_sub_1', { method: 'DELETE' })
    const res = await DELETE(req as never, { params: { id: 'cuid_sub_1' } })
    expect(res.status).toBe(401)
  })

  it('soft-cancels by setting isActive: false', async () => {
    mockSession()
    const sub = mockSubscription({ isActive: false })
    prismaMock.subscription.update.mockResolvedValue(sub)

    const req = new Request('http://localhost/api/subscriptions/cuid_sub_1', { method: 'DELETE' })
    const res = await DELETE(req as never, { params: { id: 'cuid_sub_1' } })

    expect(res.status).toBe(200)
    expect(prismaMock.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } })
    )
  })

  it('does not call prisma.subscription.delete (hard delete must not happen)', async () => {
    mockSession()
    prismaMock.subscription.update.mockResolvedValue(mockSubscription() as never)

    const req = new Request('http://localhost/api/subscriptions/cuid_sub_1', { method: 'DELETE' })
    await DELETE(req as never, { params: { id: 'cuid_sub_1' } })

    expect(prismaMock.subscription.delete).not.toHaveBeenCalled()
  })

  it('returns 500 on DB error', async () => {
    mockSession()
    prismaMock.subscription.update.mockRejectedValue(new Error('DB error'))

    const req = new Request('http://localhost/api/subscriptions/cuid_sub_1', { method: 'DELETE' })
    const res = await DELETE(req as never, { params: { id: 'cuid_sub_1' } })
    expect(res.status).toBe(500)
  })
})
