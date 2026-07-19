import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { plaidClient } from '@/lib/plaid'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/api'
import { decryptToken } from '@/lib/crypto'

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
