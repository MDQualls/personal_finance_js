import type { PrismaClient } from '@prisma/client'
import type { DeepMockProxy } from 'jest-mock-extended'

// The mock instance is created in jest.setup.ts before any module loads,
// and exposed here via global so tests can set up return values.
export const prismaMock = (global as unknown as Record<string, unknown>)
  .__prismaMock as DeepMockProxy<PrismaClient>

// Also export as 'prisma' to satisfy any direct imports of this file
export const prisma = prismaMock
