import { PATCH, DELETE } from './route'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { mockSession, noSession } from '@/lib/__mocks__/auth'
import { mockCategory } from '@/__tests__/factories/category'

describe('PATCH /api/categories/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()
    const req = new Request('http://localhost/api/categories/cuid_cat_1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
    })
    const res = await PATCH(req as never, { params: { id: 'cuid_cat_1' } })
    expect(res.status).toBe(401)
  })

  it('updates a non-system category', async () => {
    mockSession()
    const cat = mockCategory({ isSystem: false })
    const updated = { ...cat, name: 'Updated Name' }
    prismaMock.category.findUnique.mockResolvedValue(cat)
    prismaMock.category.update.mockResolvedValue(updated)

    const req = new Request('http://localhost/api/categories/cuid_cat_1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated Name' }),
    })
    const res = await PATCH(req as never, { params: { id: cat.id } })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.name).toBe('Updated Name')
  })

  it('returns 403 when attempting to modify a system category', async () => {
    mockSession()
    prismaMock.category.findUnique.mockResolvedValue(mockCategory({ isSystem: true }))

    const req = new Request('http://localhost/api/categories/cuid_cat_1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Hacked' }),
    })
    const res = await PATCH(req as never, { params: { id: 'cuid_cat_1' } })
    expect(res.status).toBe(403)
  })

  it('returns 404 when category does not exist', async () => {
    mockSession()
    prismaMock.category.findUnique.mockResolvedValue(null)

    const req = new Request('http://localhost/api/categories/nonexistent', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
    })
    const res = await PATCH(req as never, { params: { id: 'nonexistent' } })
    expect(res.status).toBe(404)
  })

  it('returns 400 when color is not a valid hex', async () => {
    mockSession()
    const req = new Request('http://localhost/api/categories/cuid_cat_1', {
      method: 'PATCH',
      body: JSON.stringify({ color: 'blue' }),
    })
    const res = await PATCH(req as never, { params: { id: 'cuid_cat_1' } })
    expect(res.status).toBe(400)
  })

  it('returns 500 on DB error', async () => {
    mockSession()
    prismaMock.category.findUnique.mockResolvedValue(mockCategory({ isSystem: false }))
    prismaMock.category.update.mockRejectedValue(new Error('DB error'))

    const req = new Request('http://localhost/api/categories/cuid_cat_1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
    })
    const res = await PATCH(req as never, { params: { id: 'cuid_cat_1' } })
    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/categories/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()
    const req = new Request('http://localhost/api/categories/cuid_cat_1', { method: 'DELETE' })
    const res = await DELETE(req as never, { params: { id: 'cuid_cat_1' } })
    expect(res.status).toBe(401)
  })

  it('archives a category with no referenced transactions', async () => {
    mockSession()
    const cat = mockCategory({ isSystem: false })
    prismaMock.category.findUnique.mockResolvedValue(cat)
    prismaMock.transaction.count.mockResolvedValue(0)
    prismaMock.category.update.mockResolvedValue({ ...cat, isActive: false })

    const req = new Request('http://localhost/api/categories/cuid_cat_1', { method: 'DELETE' })
    const res = await DELETE(req as never, { params: { id: cat.id } })

    expect(res.status).toBe(200)
    expect(prismaMock.category.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } })
    )
  })

  it('returns 403 when attempting to delete a system category', async () => {
    mockSession()
    prismaMock.category.findUnique.mockResolvedValue(mockCategory({ isSystem: true }))

    const req = new Request('http://localhost/api/categories/cuid_cat_1', { method: 'DELETE' })
    const res = await DELETE(req as never, { params: { id: 'cuid_cat_1' } })
    expect(res.status).toBe(403)
  })

  it('returns 409 when transactions reference the category', async () => {
    mockSession()
    prismaMock.category.findUnique.mockResolvedValue(mockCategory({ isSystem: false }))
    prismaMock.transaction.count.mockResolvedValue(3)

    const req = new Request('http://localhost/api/categories/cuid_cat_1', { method: 'DELETE' })
    const res = await DELETE(req as never, { params: { id: 'cuid_cat_1' } })
    expect(res.status).toBe(409)
  })

  it('returns 404 when category does not exist', async () => {
    mockSession()
    prismaMock.category.findUnique.mockResolvedValue(null)

    const req = new Request('http://localhost/api/categories/nonexistent', { method: 'DELETE' })
    const res = await DELETE(req as never, { params: { id: 'nonexistent' } })
    expect(res.status).toBe(404)
  })

  it('does not call prisma.category.delete (hard delete must not happen)', async () => {
    mockSession()
    prismaMock.category.findUnique.mockResolvedValue(mockCategory({ isSystem: false }))
    prismaMock.transaction.count.mockResolvedValue(0)
    prismaMock.category.update.mockResolvedValue(mockCategory() as never)

    const req = new Request('http://localhost/api/categories/cuid_cat_1', { method: 'DELETE' })
    await DELETE(req as never, { params: { id: 'cuid_cat_1' } })

    expect(prismaMock.category.delete).not.toHaveBeenCalled()
  })

  it('returns 500 on DB error', async () => {
    mockSession()
    prismaMock.category.findUnique.mockResolvedValue(mockCategory({ isSystem: false }))
    prismaMock.transaction.count.mockResolvedValue(0)
    prismaMock.category.update.mockRejectedValue(new Error('DB error'))

    const req = new Request('http://localhost/api/categories/cuid_cat_1', { method: 'DELETE' })
    const res = await DELETE(req as never, { params: { id: 'cuid_cat_1' } })
    expect(res.status).toBe(500)
  })
})
