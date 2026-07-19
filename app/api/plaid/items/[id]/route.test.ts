import { DELETE, PATCH } from './route'
import { prismaMock } from '@/lib/__mocks__/prisma'
import { mockSession, noSession } from '@/lib/__mocks__/auth'
import { plaidClient } from '@/lib/plaid'
import { decryptToken } from '@/lib/crypto'
import { mockPlaidItem } from '@/__tests__/factories/plaidItem'

jest.mock('@/lib/plaid', () => ({
  plaidClient: {
    itemRemove: jest.fn(),
  },
}))

jest.mock('@/lib/crypto', () => ({
  decryptToken: jest.fn((stored: string) => stored.replace('encrypted:', '')),
}))

const ITEM_ID = 'cuid_plaid_item_1'
const params = { params: { id: ITEM_ID } }

describe('DELETE /api/plaid/items/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()

    const req = new Request(`http://localhost/api/plaid/items/${ITEM_ID}`, { method: 'DELETE' })
    const res = await DELETE(req as never, params)

    expect(res.status).toBe(401)
  })

  it('returns 404 when the item does not exist', async () => {
    mockSession()
    prismaMock.plaidItem.findUnique.mockResolvedValue(null)

    const req = new Request(`http://localhost/api/plaid/items/${ITEM_ID}`, { method: 'DELETE' })
    const res = await DELETE(req as never, params)

    expect(res.status).toBe(404)
  })

  it('removes the item at Plaid and marks it disconnected locally', async () => {
    mockSession()
    prismaMock.plaidItem.findUnique.mockResolvedValue(
      mockPlaidItem({ id: ITEM_ID, accessToken: 'encrypted:access-sandbox-abc' }) as never
    )
    ;(plaidClient.itemRemove as jest.Mock).mockResolvedValue({ data: {} })
    prismaMock.plaidItem.update.mockResolvedValue(mockPlaidItem({ id: ITEM_ID, status: 'DISCONNECTED' }) as never)

    const req = new Request(`http://localhost/api/plaid/items/${ITEM_ID}`, { method: 'DELETE' })
    const res = await DELETE(req as never, params)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.disconnected).toBe(true)
    expect(decryptToken).toHaveBeenCalledWith('encrypted:access-sandbox-abc')
    expect(plaidClient.itemRemove).toHaveBeenCalledWith({ access_token: 'access-sandbox-abc' })
    expect(prismaMock.plaidItem.update).toHaveBeenCalledWith({
      where: { id: ITEM_ID },
      data: { status: 'DISCONNECTED' },
    })
  })

  it('returns 500 when Plaid rejects the removal', async () => {
    mockSession()
    prismaMock.plaidItem.findUnique.mockResolvedValue(mockPlaidItem({ id: ITEM_ID }) as never)
    ;(plaidClient.itemRemove as jest.Mock).mockRejectedValue(new Error('Plaid error'))

    const req = new Request(`http://localhost/api/plaid/items/${ITEM_ID}`, { method: 'DELETE' })
    const res = await DELETE(req as never, params)

    expect(res.status).toBe(500)
  })
})

function patchRequest(body: unknown) {
  return new Request(`http://localhost/api/plaid/items/${ITEM_ID}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/plaid/items/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    noSession()

    const res = await PATCH(patchRequest({ status: 'ACTIVE' }) as never, params)

    expect(res.status).toBe(401)
  })

  it('rejects any status other than ACTIVE', async () => {
    mockSession()

    const res = await PATCH(patchRequest({ status: 'ERROR' }) as never, params)

    expect(res.status).toBe(400)
  })

  it('returns 404 when the item does not exist', async () => {
    mockSession()
    prismaMock.plaidItem.findUnique.mockResolvedValue(null)

    const res = await PATCH(patchRequest({ status: 'ACTIVE' }) as never, params)

    expect(res.status).toBe(404)
  })

  it('reactivates an item after update-mode reconnect succeeds', async () => {
    mockSession()
    prismaMock.plaidItem.findUnique.mockResolvedValue(mockPlaidItem({ id: ITEM_ID, status: 'ERROR' }) as never)
    prismaMock.plaidItem.update.mockResolvedValue(mockPlaidItem({ id: ITEM_ID, status: 'ACTIVE' }) as never)

    const res = await PATCH(patchRequest({ status: 'ACTIVE' }) as never, params)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.status).toBe('ACTIVE')
    expect(prismaMock.plaidItem.update).toHaveBeenCalledWith({
      where: { id: ITEM_ID },
      data: { status: 'ACTIVE' },
    })
  })
})
