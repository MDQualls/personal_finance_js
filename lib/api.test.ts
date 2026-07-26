import { apiSuccess, apiError } from './api'

describe('apiSuccess', () => {
  it('returns a 200 response', () => {
    const res = apiSuccess({ id: '1' })

    expect(res.status).toBe(200)
  })

  it('wraps the payload under a data key', async () => {
    const res = apiSuccess({ id: '1', name: 'Checking' })
    const body = await res.json()

    expect(body).toEqual({ data: { id: '1', name: 'Checking' } })
  })

  it('includes meta when provided', async () => {
    const res = apiSuccess([{ id: '1' }], { count: 1 })
    const body = await res.json()

    expect(body).toEqual({ data: [{ id: '1' }], meta: { count: 1 } })
  })

  it('omits the meta key entirely when not provided', async () => {
    const res = apiSuccess({ id: '1' })
    const body = await res.json()

    expect(body).not.toHaveProperty('meta')
  })

  it('never returns raw arrays/objects unwrapped — always under data', async () => {
    const res = apiSuccess(null)
    const body = await res.json()

    expect(body).toEqual({ data: null })
  })
})

describe('apiError', () => {
  it('returns the given status code', () => {
    const res = apiError('Unauthorized', 401)

    expect(res.status).toBe(401)
  })

  it('wraps a string message under an error key', async () => {
    const res = apiError('Not found', 404)
    const body = await res.json()

    expect(body).toEqual({ error: 'Not found' })
  })

  it('wraps a structured error object (e.g. Zod .format()) under an error key', async () => {
    const zodLikeError = { name: { _errors: ['Required'] } }
    const res = apiError(zodLikeError, 400)
    const body = await res.json()

    expect(body).toEqual({ error: zodLikeError })
  })

  it('supports the full range of HTTP status codes used across the app', () => {
    expect(apiError('x', 401).status).toBe(401)
    expect(apiError('x', 403).status).toBe(403)
    expect(apiError('x', 404).status).toBe(404)
    expect(apiError('x', 409).status).toBe(409)
    expect(apiError('x', 422).status).toBe(422)
    expect(apiError('x', 429).status).toBe(429)
    expect(apiError('x', 500).status).toBe(500)
  })
})
