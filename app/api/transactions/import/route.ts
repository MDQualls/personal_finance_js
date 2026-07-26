import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { createHash } from 'crypto'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { toCents } from '@/lib/money'
import { normalizeDescription, sanitizeString } from '@/lib/normalize'
import { SYSTEM_UNCATEGORIZED_CATEGORY_ID } from '@/lib/constants'

const ImportRowSchema = z.object({
  date: z.string().max(40), // ISO date/datetime strings are ~10-30 chars
  amount: z.string().max(20), // e.g. "-123456789.99" — far more headroom than any real amount needs
  description: z.string().max(255),
  categoryId: z.string().min(1).max(100).optional(),
  accountId: z.string().cuid(),
  notes: z.string().max(1000).optional(),
})

const ImportSchema = z.object({
  rows: z.array(ImportRowSchema).min(1).max(1000),
})

function dedupeHash(date: string, amount: string, description: string): string {
  return createHash('sha256')
    .update(`${date}|${amount}|${description.trim().toLowerCase()}`)
    .digest('hex')
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body: unknown = await req.json()
  const result = ImportSchema.safeParse(body)
  if (!result.success) return apiError(result.error.format(), 400)

  const { rows } = result.data

  let imported = 0
  let duplicates = 0
  const errors: string[] = []

  // Fetch rules once
  const autoRules = await prisma.autoRule.findMany({ orderBy: { priority: 'asc' } })
  const merchantRules = await prisma.merchantRule.findMany()
  const uncategorized = await prisma.category.findFirst({ where: { name: 'Uncategorized', isSystem: true } })
  const uncategorizedId = uncategorized?.id ?? SYSTEM_UNCATEGORIZED_CATEGORY_ID

  // Fetch existing hashes from DB to detect duplicates
  const existingHashes = new Set<string>()
  const existing = await prisma.transaction.findMany({
    where: { deletedAt: null, accountId: { in: [...new Set(rows.map((r) => r.accountId))] } },
    select: { date: true, amount: true, description: true },
  })
  for (const tx of existing) {
    existingHashes.add(
      dedupeHash(tx.date.toISOString().slice(0, 10), String(tx.amount), tx.description)
    )
  }

  // Track hashes from this batch to catch within-batch dupes
  const batchHashes = new Set<string>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    try {
      const amountCents = toCents(parseFloat(row.amount))
      if (isNaN(amountCents)) {
        errors.push(`Row ${i + 1}: invalid amount "${row.amount}"`)
        continue
      }

      const dateObj = new Date(row.date)
      if (isNaN(dateObj.getTime())) {
        errors.push(`Row ${i + 1}: invalid date "${row.date}"`)
        continue
      }

      const description = normalizeDescription(sanitizeString(row.description), merchantRules)
      const hash = dedupeHash(dateObj.toISOString().slice(0, 10), String(amountCents), description)

      if (existingHashes.has(hash) || batchHashes.has(hash)) {
        duplicates++
        continue
      }

      batchHashes.add(hash)

      // Apply auto-categorization rules
      let categoryId = row.categoryId
      if (!categoryId) {
        for (const rule of autoRules) {
          const matches = rule.isRegex
            ? new RegExp(rule.pattern, 'i').test(description)
            : description.toLowerCase().includes(rule.pattern.toLowerCase())
          if (matches) {
            categoryId = rule.categoryId
            break
          }
        }
      }

      // Fall back to Uncategorized system category
      if (!categoryId) {
        categoryId = uncategorizedId
      }

      // Balance must be updated atomically with the transaction create (CLAUDE.md
      // invariant) — same $transaction pattern as POST /api/transactions. Each row
      // gets its own transaction rather than one covering the whole batch, so a bad
      // row still only skips that row instead of rolling back the entire import.
      await prisma.$transaction([
        prisma.transaction.create({
          data: {
            accountId: row.accountId,
            amount: amountCents,
            date: dateObj,
            categoryId,
            description,
            notes: row.notes ? sanitizeString(row.notes) : null,
            needsReview: true,
          },
        }),
        prisma.account.update({
          where: { id: row.accountId },
          data: { balance: { increment: amountCents } },
        }),
      ])

      imported++
    } catch (err) {
      errors.push(`Row ${i + 1}: unexpected error`)
      console.error(`[import] row ${i + 1}`, err)
    }
  }

  return apiSuccess({ imported, skipped: 0, duplicates, errors })
}
