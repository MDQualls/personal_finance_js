import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { plaidClient } from '@/lib/plaid'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { encryptToken } from '@/lib/crypto'

const ExchangeTokenSchema = z.object({
  publicToken: z.string().min(1).max(500),
  institutionId: z.string().min(1).max(255),
  institutionName: z.string().min(1).max(255),
  accounts: z
    .array(
      z.object({
        id: z.string().min(1).max(255),
        name: z.string().min(1).max(255),
        mask: z.string().max(10).nullable(),
        type: z.string().min(1).max(50),
        subtype: z.string().max(50).nullable(),
      })
    )
    .min(1)
    .max(50),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body: unknown = await req.json()
  const result = ExchangeTokenSchema.safeParse(body)
  if (!result.success) return apiError(result.error.format(), 400)

  const { publicToken, institutionId, institutionName, accounts } = result.data

  try {
    const exchange = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    })

    const { access_token, item_id } = exchange.data
    const encryptedToken = encryptToken(access_token)

    const plaidItem = await prisma.plaidItem.create({
      data: {
        accessToken: encryptedToken,
        itemId: item_id,
        institutionId,
        institutionName,
        accounts: {
          create: accounts.map((a) => ({
            plaidAccountId: a.id,
            name: a.name,
            mask: a.mask,
            type: a.type,
            subtype: a.subtype,
          })),
        },
      },
      include: { accounts: true },
    })

    return apiSuccess({ plaidItemId: plaidItem.id })
  } catch (err) {
    console.error('[plaid:exchange-token]', err)
    return apiError('Failed to connect account', 500)
  }
}
