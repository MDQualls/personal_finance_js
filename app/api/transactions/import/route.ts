import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { createHash } from 'crypto'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { toCents } from '@/lib/money'

const ImportRowSchema = z.object({
  date: z.string(),
  amount: z.string(),
  description: z.string().max(255),
  categoryId: z.string().min(1).optional(),
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

function sanitizeString(raw: string): string {
  return raw.replace(/[^\x20-\x7E -￿]/g, '').trim()
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

  // Fetch auto-categorization rules once
  const autoRules = await prisma.autoRule.findMany({ orderBy: { priority: 'asc' } })

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

      const description = sanitizeString(row.description)
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
        const uncategorized = await prisma.category.findFirst({
          where: { name: 'Uncategorized', isSystem: true },
        })
        categoryId = uncategorized?.id ?? 'system_uncategorized'
      }

      await prisma.transaction.create({
        data: {
          accountId: row.accountId,
          amount: amountCents,
          date: dateObj,
          categoryId,
          description,
          notes: row.notes ? sanitizeString(row.notes) : null,
        },
      })

      imported++
    } catch (err) {
      errors.push(`Row ${i + 1}: unexpected error`)
      console.error(`[import] row ${i + 1}`, err)
    }
  }

  return apiSuccess({ imported, skipped: 0, duplicates, errors })
}
