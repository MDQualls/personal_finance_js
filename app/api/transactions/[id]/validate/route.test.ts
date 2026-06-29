import { PATCH } from './route'
import { mockSession, noSession } from '@/lib/__mocks__/auth'

jest.mock('@/lib/validateTransaction', () => ({
  setTransactionValidated: jest.fn(),
}))

import { setTransactionValidated } from '@/lib/validateTransaction'
const mockValidate = setTransactionValidated as jest.Mock

const BASE = 'http://localhost/api/transactions/cuid_tx_1/validate'
const params = { params: { id: 'cuid_tx_1' } }

function makeRequest(body: unknown) {
  return new Request(BASE, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as never
}

describe('PATCH /api/transactions/[id]/validate', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    noSession()

    const res = await PATCH(makeRequest({ isValidated: true }), params)

    expect(res.status).toBe(401)
  })

  it('returns 400 when isValidated is missing', async () => {
    mockSession()

    const res = await PATCH(makeRequest({}), params)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it('returns 400 when isValidated is not a boolean', async () => {
    mockSession()

    const res = await PATCH(makeRequest({ isValidated: 'yes' }), params)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBeDefined()
  })

  it('returns 404 when transaction does not exist', async () => {
    mockSession()
    mockValidate.mockResolvedValue(false)

    const res = await PATCH(makeRequest({ isValidated: true }), params)
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toMatch(/not found/i)
  })

  it('calls the service with id and isValidated: true', async () => {
    mockSession()
    mockValidate.mockResolvedValue(true)

    await PATCH(makeRequest({ isValidated: true }), params)

    expect(mockValidate).toHaveBeenCalledWith('cuid_tx_1', true)
  })

  it('calls the service with id and isValidated: false', async () => {
    mockSession()
    mockValidate.mockResolvedValue(true)

    await PATCH(makeRequest({ isValidated: false }), params)

    expect(mockValidate).toHaveBeenCalledWith('cuid_tx_1', false)
  })

  it('returns 200 with id and isValidated on success', async () => {
    mockSession()
    mockValidate.mockResolvedValue(true)

    const res = await PATCH(makeRequest({ isValidated: true }), params)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual({ id: 'cuid_tx_1', isValidated: true })
  })

  it('returns 500 when the service throws', async () => {
    mockSession()
    mockValidate.mockRejectedValue(new Error('DB error'))

    const res = await PATCH(makeRequest({ isValidated: true }), params)

    expect(res.status).toBe(500)
  })
})
