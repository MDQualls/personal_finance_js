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

  it('can update isIncome flag', async () => {
    mockSession()
    const cat = { ...mockCategory({ isSystem: false, isIncome: false }), _count: { children: 0 } }
    const updated = { ...cat, isIncome: true }
    prismaMock.category.findUnique.mockResolvedValue(cat as never)
    prismaMock.category.update.mockResolvedValue(updated as never)

    const req = new Request('http://localhost/api/categories/cuid_cat_1', {
      method: 'PATCH',
      body: JSON.stringify({ isIncome: true }),
    })
    const res = await PATCH(req as never, { params: { id: cat.id } })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.isIncome).toBe(true)
  })

  it('promotes subcategory to top-level when parentId is null', async () => {
    mockSession()
    const cat = { ...mockCategory({ isSystem: false, parentId: 'cuid_parent_1' }), _count: { children: 0 } }
    prismaMock.category.findUnique.mockResolvedValue(cat as never)
    prismaMock.category.update.mockResolvedValue({ ...cat, parentId: null } as never)

    const req = new Request('http://localhost/api/categories/cuid_cat_1', {
      method: 'PATCH',
      body: JSON.stringify({ parentId: null }),
    })
    const res = await PATCH(req as never, { params: { id: cat.id } })
    expect(res.status).toBe(200)
  })

  it('moves a top-level category under another top-level parent', async () => {
    mockSession()
    const cat = { ...mockCategory({ id: 'cuid_cat_1', isSystem: false, parentId: null }), _count: { children: 0 } }
    const parent = mockCategory({ id: 'cuid_parent_1', parentId: null })
    prismaMock.category.findUnique
      .mockResolvedValueOnce(cat as never)
      .mockResolvedValueOnce(parent as never)
    prismaMock.category.update.mockResolvedValue({ ...cat, parentId: parent.id } as never)

    const req = new Request('http://localhost/api/categories/cuid_cat_1', {
      method: 'PATCH',
      body: JSON.stringify({ parentId: 'cuid_parent_1' }),
    })
    const res = await PATCH(req as never, { params: { id: 'cuid_cat_1' } })
    expect(res.status).toBe(200)
  })

  it('returns 400 when parentId is the category itself (self-reference)', async () => {
    mockSession()
    const cat = { ...mockCategory({ id: 'cuid_cat_1', isSystem: false }), _count: { children: 0 } }
    prismaMock.category.findUnique.mockResolvedValue(cat as never)

    const req = new Request('http://localhost/api/categories/cuid_cat_1', {
      method: 'PATCH',
      body: JSON.stringify({ parentId: 'cuid_cat_1' }),
    })
    const res = await PATCH(req as never, { params: { id: 'cuid_cat_1' } })
    expect(res.status).toBe(400)
  })

  it('returns 400 when moving a category that has subcategories', async () => {
    mockSession()
    const cat = { ...mockCategory({ id: 'cuid_cat_1', isSystem: false, parentId: null }), _count: { children: 2 } }
    prismaMock.category.findUnique.mockResolvedValue(cat as never)

    const req = new Request('http://localhost/api/categories/cuid_cat_1', {
      method: 'PATCH',
      body: JSON.stringify({ parentId: 'cuid_parent_1' }),
    })
    const res = await PATCH(req as never, { params: { id: 'cuid_cat_1' } })
    expect(res.status).toBe(400)
  })

  it('returns 400 when prospective parent is itself a subcategory', async () => {
    mockSession()
    const cat = { ...mockCategory({ id: 'cuid_cat_1', isSystem: false, parentId: null }), _count: { children: 0 } }
    const prospectiveParent = mockCategory({ id: 'cuid_sub_1', parentId: 'cuid_grandparent_1' })
    prismaMock.category.findUnique
      .mockResolvedValueOnce(cat as never)
      .mockResolvedValueOnce(prospectiveParent as never)

    const req = new Request('http://localhost/api/categories/cuid_cat_1', {
      method: 'PATCH',
      body: JSON.stringify({ parentId: 'cuid_sub_1' }),
    })
    const res = await PATCH(req as never, { params: { id: 'cuid_cat_1' } })
    expect(res.status).toBe(400)
  })

  it('returns 400 when prospective parent does not exist', async () => {
    mockSession()
    const cat = { ...mockCategory({ id: 'cuid_cat_1', isSystem: false, parentId: null }), _count: { children: 0 } }
    prismaMock.category.findUnique
      .mockResolvedValueOnce(cat as never)
      .mockResolvedValueOnce(null)

    const req = new Request('http://localhost/api/categories/cuid_cat_1', {
      method: 'PATCH',
      body: JSON.stringify({ parentId: 'cuid_nonexistent' }),
    })
    const res = await PATCH(req as never, { params: { id: 'cuid_cat_1' } })
    expect(res.status).toBe(400)
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
