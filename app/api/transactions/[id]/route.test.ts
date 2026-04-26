import { PATCH, DELETE } from './route'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { mockSession, noSession } from '@/lib/__mocks__/auth'
import { mockTransaction } from '@/__tests__/factories/transaction'

describe('PATCH /api/transactions/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()
    const req = new Request('http://localhost/api/transactions/cuid_transaction_1', {
      method: 'PATCH',
      body: JSON.stringify({ description: 'Updated' }),
    })
    const res = await PATCH(req as never, { params: { id: 'cuid_transaction_1' } })
    expect(res.status).toBe(401)
  })

  it('updates transaction fields', async () => {
    mockSession()
    const tx = mockTransaction()
    const updated = { ...tx, description: 'Updated description' }
    prismaMock.transaction.findUnique.mockResolvedValue(tx)
    prismaMock.transaction.update.mockResolvedValue(updated as never)

    const req = new Request('http://localhost/api/transactions/cuid_transaction_1', {
      method: 'PATCH',
      body: JSON.stringify({ description: 'Updated description' }),
    })
    const res = await PATCH(req as never, { params: { id: tx.id } })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.description).toBe('Updated description')
  })

  it('returns 410 when attempting to edit a soft-deleted transaction', async () => {
    mockSession()
    const deleted = mockTransaction({ deletedAt: new Date() })
    prismaMock.transaction.findUnique.mockResolvedValue(deleted)

    const req = new Request('http://localhost/api/transactions/cuid_transaction_1', {
      method: 'PATCH',
      body: JSON.stringify({ description: 'Should fail' }),
    })
    const res = await PATCH(req as never, { params: { id: deleted.id } })
    expect(res.status).toBe(410)
  })

  it('restores a soft-deleted transaction with restore:true', async () => {
    mockSession()
    const deleted = mockTransaction({ deletedAt: new Date() })
    const restored = { ...deleted, deletedAt: null }
    prismaMock.transaction.findUnique.mockResolvedValue(deleted)
    prismaMock.transaction.update.mockResolvedValue(restored as never)

    const req = new Request('http://localhost/api/transactions/cuid_transaction_1', {
      method: 'PATCH',
      body: JSON.stringify({ restore: true }),
    })
    const res = await PATCH(req as never, { params: { id: deleted.id } })

    expect(res.status).toBe(200)
    expect(prismaMock.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deletedAt: null }),
      })
    )
  })

  it('returns 400 on invalid field', async () => {
    mockSession()
    const req = new Request('http://localhost/api/transactions/cuid_transaction_1', {
      method: 'PATCH',
      body: JSON.stringify({ amount: 45.99 }), // float — not int
    })
    const res = await PATCH(req as never, { params: { id: 'cuid_transaction_1' } })
    expect(res.status).toBe(400)
  })

  it('returns 500 on DB error', async () => {
    mockSession()
    const tx = mockTransaction()
    prismaMock.transaction.findUnique.mockResolvedValue(tx)
    prismaMock.transaction.update.mockRejectedValue(new Error('DB error'))

    const req = new Request('http://localhost/api/transactions/cuid_transaction_1', {
      method: 'PATCH',
      body: JSON.stringify({ description: 'Updated' }),
    })
    const res = await PATCH(req as never, { params: { id: tx.id } })
    expect(res.status).toBe(500)
  })
})

describe('DELETE /api/transactions/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()
    const req = new Request('http://localhost/api/transactions/cuid_transaction_1', {
      method: 'DELETE',
    })
    const res = await DELETE(req as never, { params: { id: 'cuid_transaction_1' } })
    expect(res.status).toBe(401)
  })

  it('soft-deletes by setting deletedAt', async () => {
    mockSession()
    const tx = mockTransaction()
    prismaMock.transaction.findUnique.mockResolvedValue(tx)
    prismaMock.transaction.update.mockResolvedValue({ ...tx, deletedAt: new Date() })

    const req = new Request('http://localhost/api/transactions/cuid_transaction_1', {
      method: 'DELETE',
    })
    const res = await DELETE(req as never, { params: { id: tx.id } })

    expect(res.status).toBe(200)
    expect(prismaMock.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      })
    )
  })

  it('returns 410 when transaction is already deleted', async () => {
    mockSession()
    const deleted = mockTransaction({ deletedAt: new Date() })
    prismaMock.transaction.findUnique.mockResolvedValue(deleted)

    const req = new Request('http://localhost/api/transactions/cuid_transaction_1', {
      method: 'DELETE',
    })
    const res = await DELETE(req as never, { params: { id: deleted.id } })
    expect(res.status).toBe(410)
  })

  it('returns 404 when transaction does not exist', async () => {
    mockSession()
    prismaMock.transaction.findUnique.mockResolvedValue(null)

    const req = new Request('http://localhost/api/transactions/nonexistent', {
      method: 'DELETE',
    })
    const res = await DELETE(req as never, { params: { id: 'nonexistent' } })
    expect(res.status).toBe(404)
  })

  it('does not call prisma.transaction.delete (hard delete must not happen)', async () => {
    mockSession()
    const tx = mockTransaction()
    prismaMock.transaction.findUnique.mockResolvedValue(tx)
    prismaMock.transaction.update.mockResolvedValue({ ...tx, deletedAt: new Date() })

    const req = new Request('http://localhost/api/transactions/cuid_transaction_1', {
      method: 'DELETE',
    })
    await DELETE(req as never, { params: { id: tx.id } })

    expect(prismaMock.transaction.delete).not.toHaveBeenCalled()
  })
})
