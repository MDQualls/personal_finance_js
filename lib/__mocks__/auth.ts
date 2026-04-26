import type { Session } from 'next-auth'

const mockGetServerSession = jest.fn()

jest.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))

const DEFAULT_SESSION: Session = {
  user: { id: '1', name: 'testuser', email: null },
  expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
}

export function mockSession(session: Partial<Session> = {}) {
  mockGetServerSession.mockResolvedValue({ ...DEFAULT_SESSION, ...session })
}

export function noSession() {
  mockGetServerSession.mockResolvedValue(null)
}
