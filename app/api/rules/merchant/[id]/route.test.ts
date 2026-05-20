import { PATCH, DELETE } from './route'
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

describe('PATCH /api/rules/merchant/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()
    const req = new Request('http://localhost/api/rules/merchant/cuid_merchant_1', {
      method: 'PATCH',
      body: JSON.stringify({ displayName: 'Updated Name' }),
    })
    const res = await PATCH(req as never, { params: { id: 'cuid_merchant_1' } })
    expect(res.status).toBe(401)
  })

  it('updates displayName', async () => {
    mockSession()
    prismaMock.merchantRule.update.mockResolvedValue(mockMerchantRule({ displayName: 'Updated Name' }))

    const req = new Request('http://localhost/api/rules/merchant/cuid_merchant_1', {
      method: 'PATCH',
      body: JSON.stringify({ displayName: 'Updated Name' }),
    })
    const res = await PATCH(req as never, { params: { id: 'cuid_merchant_1' } })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.displayName).toBe('Updated Name')
  })

  it('updates pattern and isRegex', async () => {
    mockSession()
    prismaMock.merchantRule.update.mockResolvedValue(
      mockMerchantRule({ pattern: 'AMZN\\s*MKTP', isRegex: true })
    )

    const req = new Request('http://localhost/api/rules/merchant/cuid_merchant_1', {
      method: 'PATCH',
      body: JSON.stringify({ pattern: 'AMZN\\s*MKTP', isRegex: true }),
    })
    const res = await PATCH(req as never, { params: { id: 'cuid_merchant_1' } })

    expect(res.status).toBe(200)
    expect(prismaMock.merchantRule.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isRegex: true }) })
    )
  })

  it('returns 400 when pattern is empty string', async () => {
    mockSession()
    const req = new Request('http://localhost/api/rules/merchant/cuid_merchant_1', {
      method: 'PATCH',
      body: JSON.stringify({ pattern: '' }),
    })
    const res = await PATCH(req as never, { params: { id: 'cuid_merchant_1' } })
    expect(res.status).toBe(400)
  })

  it('returns 500 on DB error', async () => {
    mockSession()
    prismaMock.merchantRule.update.mockRejectedValue(new Error('DB error'))

    const req = new Request('http://localhost/api/rules/merchant/cuid_merchant_1', {
      method: 'PATCH',
      body: JSON.stringify({ displayName: 'Updated' }),
    })
    const res = await PATCH(req as never, { params: { id: 'cuid_merchant_1' } })
    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/rules/merchant/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()
    const req = new Request('http://localhost/api/rules/merchant/cuid_merchant_1', { method: 'DELETE' })
    const res = await DELETE(req as never, { params: { id: 'cuid_merchant_1' } })
    expect(res.status).toBe(401)
  })

  it('hard-deletes the merchant rule', async () => {
    mockSession()
    prismaMock.merchantRule.delete.mockResolvedValue(mockMerchantRule())

    const req = new Request('http://localhost/api/rules/merchant/cuid_merchant_1', { method: 'DELETE' })
    const res = await DELETE(req as never, { params: { id: 'cuid_merchant_1' } })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.id).toBe('cuid_merchant_1')
    expect(prismaMock.merchantRule.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'cuid_merchant_1' } })
    )
  })

  it('returns 500 on DB error', async () => {
    mockSession()
    prismaMock.merchantRule.delete.mockRejectedValue(new Error('DB error'))

    const req = new Request('http://localhost/api/rules/merchant/cuid_merchant_1', { method: 'DELETE' })
    const res = await DELETE(req as never, { params: { id: 'cuid_merchant_1' } })
    expect(res.status).toBe(500)
  })
})
