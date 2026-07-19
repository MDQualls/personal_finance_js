import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { CountryCode, Products } from 'plaid'
import { authOptions } from '@/lib/auth'
import { plaidClient } from '@/lib/plaid'
import { apiSuccess, apiError } from '@/lib/api'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
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
