import type { Session } from 'next-auth'
import { getServerSession } from 'next-auth'

const DEFAULT_SESSION: Session = {
  user: { id: '1', name: 'testuser', email: null },
  expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
}

export function mockSession(session: Partial<Session> = {}) {
  ;(getServerSession as jest.Mock).mockResolvedValue({ ...DEFAULT_SESSION, ...session })
}

export function noSession() {
  ;(getServerSession as jest.Mock).mockResolvedValue(null)
}
