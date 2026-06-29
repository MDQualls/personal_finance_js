import { GET } from './route'
import { mockSession, noSession } from '@/lib/__mocks__/auth'

jest.mock('@/lib/transactionExport', () => ({
  fetchTransactionsForExport: jest.fn(),
  serializeTransactionsToCsv: jest.fn(),
}))

import { fetchTransactionsForExport, serializeTransactionsToCsv } from '@/lib/transactionExport'
const mockFetch = fetchTransactionsForExport as jest.Mock
const mockSerialize = serializeTransactionsToCsv as jest.Mock

const BASE = 'http://localhost/api/transactions/export'

describe('GET /api/transactions/export', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    noSession()

    const res = await GET(new Request(BASE) as never)

    expect(res.status).toBe(401)
  })

  it('returns 400 when from is missing', async () => {
    mockSession()

    const res = await GET(new Request(`${BASE}?to=2026-04-30`) as never)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/from and to/)
  })

  it('returns 400 when to is missing', async () => {
    mockSession()

    const res = await GET(new Request(`${BASE}?from=2026-04-01`) as never)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/from and to/)
  })

  it('returns 400 when both from and to are missing', async () => {
    mockSession()

    const res = await GET(new Request(BASE) as never)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/from and to/)
  })

  it('returns CSV with correct content-type header', async () => {
    mockSession()
    mockFetch.mockResolvedValue([])
    mockSerialize.mockReturnValue('Date,Description,Amount,Account,Category,Tags,Notes')

    const res = await GET(new Request(`${BASE}?from=2026-04-01&to=2026-04-30`) as never)

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/csv')
  })

  it('returns CSV with filename derived from date range', async () => {
    mockSession()
    mockFetch.mockResolvedValue([])
    mockSerialize.mockReturnValue('')

    const res = await GET(new Request(`${BASE}?from=2026-04-01&to=2026-04-30`) as never)

    expect(res.headers.get('Content-Disposition')).toBe(
      'attachment; filename="transactions-2026-04-01-to-2026-04-30.csv"'
    )
  })

  it('calls fetchTransactionsForExport with parsed Date objects', async () => {
    mockSession()
    mockFetch.mockResolvedValue([])
    mockSerialize.mockReturnValue('')

    await GET(new Request(`${BASE}?from=2026-04-01&to=2026-04-30`) as never)

    expect(mockFetch).toHaveBeenCalledWith({
      from: new Date('2026-04-01'),
      to: new Date('2026-04-30'),
      accountId: undefined,
      categoryId: undefined,
    })
  })

  it('passes optional accountId to the export function', async () => {
    mockSession()
    mockFetch.mockResolvedValue([])
    mockSerialize.mockReturnValue('')

    await GET(
      new Request(`${BASE}?from=2026-04-01&to=2026-04-30&accountId=cuid_account_1`) as never
    )

    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'cuid_account_1' })
    )
  })

  it('passes optional categoryId to the export function', async () => {
    mockSession()
    mockFetch.mockResolvedValue([])
    mockSerialize.mockReturnValue('')

    await GET(
      new Request(`${BASE}?from=2026-04-01&to=2026-04-30&categoryId=cuid_category_1`) as never
    )

    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'cuid_category_1' })
    )
  })

  it('passes the fetched transactions to the serializer', async () => {
    mockSession()
    const txs = [{ id: 'tx1' }, { id: 'tx2' }]
    mockFetch.mockResolvedValue(txs)
    mockSerialize.mockReturnValue('csv content')

    await GET(new Request(`${BASE}?from=2026-04-01&to=2026-04-30`) as never)

    expect(mockSerialize).toHaveBeenCalledWith(txs)
  })

  it('returns the serialized CSV as the response body', async () => {
    mockSession()
    mockFetch.mockResolvedValue([])
    mockSerialize.mockReturnValue('Date,Description\n2026-04-01,Coffee')

    const res = await GET(new Request(`${BASE}?from=2026-04-01&to=2026-04-30`) as never)
    const text = await res.text()

    expect(text).toBe('Date,Description\n2026-04-01,Coffee')
  })

  it('returns 500 when the export service throws', async () => {
    mockSession()
    mockFetch.mockRejectedValue(new Error('DB connection failed'))

    const res = await GET(new Request(`${BASE}?from=2026-04-01&to=2026-04-30`) as never)
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toMatch(/export/i)
  })
})
