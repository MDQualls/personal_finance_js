import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'

const LinkPlaidAccountSchema = z.union([
  z.object({ accountId: z.string().cuid() }),
  z.object({
    name: z.string().min(1).max(100),
    type: z.enum(['CHECKING', 'SAVINGS', 'CREDIT_CARD', 'LOAN', 'INVESTMENT', 'ASSET', 'LIABILITY']),
  }),
])

// Links a PlaidAccount to a local Account — either an existing one (accountId) or a newly
// created one (name + type). Either way, the resulting Account is marked plaidManaged: true,
// which is what makes the Phase 5 reconciliation guard (recurring engine + autoPost validation) apply to it.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body: unknown = await req.json()
  const result = LinkPlaidAccountSchema.safeParse(body)
  if (!result.success) return apiError(result.error.format(), 400)

  try {
    const plaidAccount = await prisma.plaidAccount.findUnique({ where: { id: params.id } })
    if (!plaidAccount) return apiError('Plaid account not found', 404)

    let accountId: string
    if ('accountId' in result.data) {
      const account = await prisma.account.findUnique({ where: { id: result.data.accountId } })
      if (!account) return apiError('Account not found', 404)
      accountId = account.id
      await prisma.account.update({ where: { id: accountId }, data: { plaidManaged: true } })
    } else {
      const account = await prisma.account.create({
        data: { name: result.data.name, type: result.data.type, balance: 0, plaidManaged: true },
      })
      accountId = account.id
    }

    const updated = await prisma.plaidAccount.update({
      where: { id: params.id },
      data: { accountId },
      include: { account: true },
    })

    return apiSuccess(updated)
  } catch (err) {
    console.error('[plaid:accounts:PATCH]', err)
    return apiError('Failed to link account', 500)
  }
}
