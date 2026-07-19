import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { CountryCode, Products } from 'plaid'
import { authOptions } from '@/lib/auth'
import { plaidClient } from '@/lib/plaid'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { decryptToken } from '@/lib/crypto'

const LinkTokenSchema = z.object({
  // Present only when re-launching Link in update mode to fix a broken item (e.g. ITEM_LOGIN_REQUIRED)
  plaidItemId: z.string().cuid().optional(),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body: unknown = await req.json().catch(() => ({}))
  const result = LinkTokenSchema.safeParse(body)
  if (!result.success) return apiError(result.error.format(), 400)

  try {
    if (result.data.plaidItemId) {
      const item = await prisma.plaidItem.findUnique({ where: { id: result.data.plaidItemId } })
      if (!item) return apiError('Plaid item not found', 404)
      if (!item.accessToken) return apiError('This connection has been disconnected', 410)

      // Update mode: pass the existing item's access_token instead of `products` — Link resolves
      // whatever the item's current issue is (login required, MFA, etc.) without creating a new item.
      const response = await plaidClient.linkTokenCreate({
        user: { client_user_id: 'single-user' },
        client_name: 'Personal Finance Tracker',
        country_codes: [CountryCode.Us],
        language: 'en',
        access_token: decryptToken(item.accessToken),
      })

      return apiSuccess({ linkToken: response.data.link_token })
    }

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: 'single-user' },
      client_name: 'Personal Finance Tracker',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    })

    return apiSuccess({ linkToken: response.data.link_token })
  } catch (err) {
    console.error('[plaid:link-token]', err)
    return apiError('Failed to create link token', 500)
  }
}
