import { encryptToken, decryptToken } from './crypto'

const ORIGINAL_KEY = process.env.ENCRYPTION_KEY

beforeEach(() => {
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64') // 32-byte test key
})

afterEach(() => {
  process.env.ENCRYPTION_KEY = ORIGINAL_KEY
})

describe('encryptToken / decryptToken', () => {
  it('round-trips a plaintext value', () => {
    const encrypted = encryptToken('access-sandbox-123')

    expect(decryptToken(encrypted)).toBe('access-sandbox-123')
  })

  it('round-trips an empty string', () => {
    const encrypted = encryptToken('')

    expect(decryptToken(encrypted)).toBe('')
  })

  it('produces different ciphertext for the same plaintext on repeated calls', () => {
    const a = encryptToken('same-value')
    const b = encryptToken('same-value')

    expect(a).not.toBe(b)
  })

  it('stores iv, tag, and ciphertext as three base64 segments', () => {
    const encrypted = encryptToken('access-token')

    expect(encrypted.split(':')).toHaveLength(3)
  })

  it('throws when the stored payload has been tampered with', () => {
    const encrypted = encryptToken('access-token')
    const [iv, tag] = encrypted.split(':')
    const tampered = [iv, tag, Buffer.from('not the real ciphertext').toString('base64')].join(':')

    expect(() => decryptToken(tampered)).toThrow()
  })

  it('throws a clear error from encryptToken when ENCRYPTION_KEY is not set', () => {
    delete process.env.ENCRYPTION_KEY

    expect(() => encryptToken('access-token')).toThrow('ENCRYPTION_KEY is not set')
  })

  it('throws a clear error from decryptToken when ENCRYPTION_KEY is not set', () => {
    const encrypted = encryptToken('access-token')
    delete process.env.ENCRYPTION_KEY

    expect(() => decryptToken(encrypted)).toThrow('ENCRYPTION_KEY is not set')
  })
})
