import { PrismaClient } from '@prisma/client'

// Standard Next.js hot-reload singleton pattern: globalThis has no PrismaClient
// property by default, so TS needs telling it's there before this module attaches
// one — avoids spinning up a new client (and DB connection pool) per HMR reload.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
