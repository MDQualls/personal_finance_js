import { GET, POST } from './route'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { mockSession, noSession } from '@/lib/__mocks__/auth'
import { mockCategory } from '@/__tests__/factories/category'

describe('GET /api/categories', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()
    const res = await GET(new Request('http://localhost/api/categories') as never)
    expect(res.status).toBe(401)
  })

  it('returns parent categories with children included', async () => {
    mockSession()
    const parent = mockCategory({ parentId: null })
    const child = mockCategory({ parentId: parent.id })
    prismaMock.category.findMany.mockResolvedValue([{ ...parent, children: [child] }] as never)

    const res = await GET(new Request('http://localhost/api/categories') as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].children).toHaveLength(1)
  })

  it('returns 500 on DB error', async () => {
    mockSession()
    prismaMock.category.findMany.mockRejectedValue(new Error('DB error'))

    const res = await GET(new Request('http://localhost/api/categories') as never)
    expect(res.status).toBe(500)
  })
})

describe('POST /api/categories', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()
    const req = new Request('http://localhost/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name: 'Food', color: '#ff0000' }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(401)
  })

  it('creates a category with valid data', async () => {
    mockSession()
    const cat = mockCategory({ name: 'Food', color: '#ff0000' })
    prismaMock.category.create.mockResolvedValue(cat)

    const req = new Request('http://localhost/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name: 'Food', color: '#ff0000' }),
    })
    const res = await POST(req as never)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.name).toBe('Food')
  })

  it('returns 400 when color is not a valid hex', async () => {
    mockSession()
    const req = new Request('http://localhost/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name: 'Food', color: 'red' }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when name is empty', async () => {
    mockSession()
    const req = new Request('http://localhost/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name: '', color: '#ff0000' }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('returns 500 on DB error', async () => {
    mockSession()
    prismaMock.category.create.mockRejectedValue(new Error('DB error'))

    const req = new Request('http://localhost/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name: 'Food', color: '#ff0000' }),
    })
    const res = await POST(req as never)
    expect(res.status).toBe(500)
  })
})
