import bcrypt from 'bcryptjs'
import type { CredentialsConfig } from 'next-auth/providers/credentials'
import { authOptions } from './auth'

jest.mock('bcryptjs', () => ({ compare: jest.fn() }))

// authOptions.providers[0] is typed as the general next-auth `Provider` union;
// it's always our single CredentialsProvider() config at runtime, so this cast
// just recovers the concrete type to reach `.authorize`.
const provider = authOptions.providers[0] as unknown as CredentialsConfig
const authorize = provider.authorize!

let ipCounter = 0
function freshReq(): { headers: Record<string, string> } {
  return { headers: { 'x-forwarded-for': `10.10.0.${++ipCounter}` } }
}

const ORIGINAL_ENV = process.env

beforeEach(() => {
  jest.clearAllMocks()
  process.env = {
    ...ORIGINAL_ENV,
    AUTH_USERNAME: 'testadmin',
    // base64("$2a$12$fakehashfakehashfakehashfakehashfakehashfakehashfake")
    AUTH_PASSWORD_HASH_B64: Buffer.from('$2a$12$fakehashfakehashfakehashfakehashfakehashfakehashfake').toString(
      'base64'
    ),
  }
})

afterAll(() => {
  process.env = ORIGINAL_ENV
})

describe('authorize', () => {
  it('returns null when username is missing', async () => {
    const result = await authorize({ username: '', password: 'pw' } as never, freshReq() as never)

    expect(result).toBeNull()
    expect(bcrypt.compare).not.toHaveBeenCalled()
  })

  it('returns null when password is missing', async () => {
    const result = await authorize({ username: 'testadmin', password: '' } as never, freshReq() as never)

    expect(result).toBeNull()
  })

  it('returns null when AUTH_USERNAME is not configured', async () => {
    delete process.env.AUTH_USERNAME
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

    const result = await authorize(
      { username: 'testadmin', password: 'correct' } as never,
      freshReq() as never
    )

    expect(result).toBeNull()
  })

  it('returns null when AUTH_PASSWORD_HASH_B64 is not configured', async () => {
    delete process.env.AUTH_PASSWORD_HASH_B64
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

    const result = await authorize(
      { username: 'testadmin', password: 'correct' } as never,
      freshReq() as never
    )

    expect(result).toBeNull()
  })

  it('returns null for a wrong username, without a distinguishing error', async () => {
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

    const result = await authorize(
      { username: 'wronguser', password: 'whatever' } as never,
      freshReq() as never
    )

    expect(result).toBeNull()
  })

  it('returns null for a wrong password, without a distinguishing error', async () => {
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)

    const result = await authorize(
      { username: 'testadmin', password: 'wrong' } as never,
      freshReq() as never
    )

    expect(result).toBeNull()
  })

  it('returns a user object for correct credentials', async () => {
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

    const result = await authorize(
      { username: 'testadmin', password: 'correct' } as never,
      freshReq() as never
    )

    expect(result).toEqual({ id: '1', name: 'testadmin', email: null })
  })

  it('rate-limits repeated attempts from the same IP, independent of credential correctness', async () => {
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)
    const req = freshReq()

    for (let i = 0; i < 10; i++) {
      await authorize({ username: 'testadmin', password: 'wrong' } as never, req as never)
    }
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)
    const result = await authorize({ username: 'testadmin', password: 'correct' } as never, req as never)

    expect(result).toBeNull()
  })

  it('does not rate-limit a different IP after another IP is exhausted', async () => {
    ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)
    const exhaustedReq = freshReq()
    for (let i = 0; i < 10; i++) {
      await authorize({ username: 'testadmin', password: 'wrong' } as never, exhaustedReq as never)
    }

    ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)
    const result = await authorize(
      { username: 'testadmin', password: 'correct' } as never,
      freshReq() as never
    )

    expect(result).toEqual({ id: '1', name: 'testadmin', email: null })
  })
})

describe('callbacks.jwt', () => {
  it('copies user.id onto the token on initial sign-in', async () => {
    const token = await authOptions.callbacks!.jwt!({
      token: {},
      user: { id: '1', name: 'testadmin', email: null },
    } as never)

    expect(token.id).toBe('1')
  })

  it('leaves an existing token unchanged when there is no user (subsequent requests)', async () => {
    const token = await authOptions.callbacks!.jwt!({ token: { id: '1' } } as never)

    expect(token.id).toBe('1')
  })
})

describe('callbacks.session', () => {
  it('copies token.id onto session.user.id', async () => {
    const session = await authOptions.callbacks!.session!({
      session: { user: { id: '', name: 'testadmin', email: null }, expires: '' },
      token: { id: '1' },
    } as never)

    // NextAuth v4's `session` callback param/return type is a union that doesn't
    // always pick up the module augmentation in types/next-auth.d.ts through this
    // indirect `authOptions.callbacks!.session!` access path — narrow it here.
    expect((session.user as { id: string }).id).toBe('1')
  })
})
