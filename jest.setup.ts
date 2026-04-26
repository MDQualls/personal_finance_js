import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'
import { mockDeep, mockReset } from 'jest-mock-extended'
import type { PrismaClient } from '@prisma/client'

// TextEncoder/TextDecoder are needed by some next-auth internals
Object.assign(global, { TextDecoder, TextEncoder })

// Create the Prisma deep mock once and register it before any module loads.
// This ensures route handlers always get the mock when they import @/lib/prisma.
const _prismaMock = mockDeep<PrismaClient>()
jest.mock('@/lib/prisma', () => ({ prisma: _prismaMock }))

// Expose to test helper files (lib/__mocks__/prisma.ts) via global
;(global as unknown as Record<string, unknown>).__prismaMock = _prismaMock

// Use manual mock for next-auth (see __mocks__/next-auth.ts).
// This prevents loading jose/uuid/openid-client (all ESM, incompatible with jest).
jest.mock('next-auth')

// Mock CredentialsProvider so lib/auth.ts evaluates without loading the
// full next-auth provider dependency chain.
jest.mock('next-auth/providers/credentials', () => ({
  __esModule: true,
  default: jest.fn((config: unknown) => ({ id: 'credentials', type: 'credentials', ...(config as object) })),
}))

// Reset Prisma mock and clear call history before each test
beforeEach(() => {
  mockReset(_prismaMock)
  jest.clearAllMocks()
})
