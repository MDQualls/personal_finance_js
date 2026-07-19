import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { plaidClient } from '@/lib/plaid'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { decryptToken } from '@/lib/crypto'

// Only transition a client can legitimately request: mark an item ACTIVE again after the user
// completes Plaid Link's update-mode flow (re-auth for ITEM_LOGIN_REQUIRED). Any other status
// change happens server-side (sync route on error, DELETE handler on disconnect).
const ReactivateSchema = z.object({ status: z.literal('ACTIVE') })

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body: unknown = await req.json()
  const result = ReactivateSchema.safeParse(body)
  if (!result.success) return apiError(result.error.format(), 400)

  try {
    const item = await prisma.plaidItem.findUnique({ where: { id: params.id } })
    if (!item) return apiError('Not found', 404)

    await prisma.plaidItem.update({ where: { id: params.id }, data: { status: 'ACTIVE' } })

    return apiSuccess({ status: 'ACTIVE' })
  } catch (err) {
    console.error('[plaid:items:PATCH]', err)
    return apiError('Failed to update connection', 500)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  try {
    const item = await prisma.plaidItem.findUnique({ where: { id: params.id } })
    if (!item) return apiError('Not found', 404)

    const accessToken = decryptToken(item.accessToken)
    await plaidClient.itemRemove({ access_token: accessToken })

    await prisma.plaidItem.update({
      where: { id: params.id },
      data: { status: 'DISCONNECTED' },
    })

    return apiSuccess({ disconnected: true })
  } catch (err) {
    console.error('[plaid:items:DELETE]', err)
    return apiError('Failed to disconnect account', 500)
  }
}
