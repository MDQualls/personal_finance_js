import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { apiSuccess, apiError } from '@/lib/api'
import { setTransactionValidated } from '@/lib/validateTransaction'

const ValidateSchema = z.object({
  isValidated: z.boolean(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return apiError('Unauthorized', 401)

  const body: unknown = await req.json()
  const result = ValidateSchema.safeParse(body)
  if (!result.success) return apiError(result.error.format(), 400)

  try {
    const found = await setTransactionValidated(params.id, result.data.isValidated)
    if (!found) return apiError('Transaction not found', 404)

    return apiSuccess({ id: params.id, isValidated: result.data.isValidated })
  } catch (err) {
    console.error('[transactions/validate:PATCH]', err)
    return apiError('Failed to update transaction', 500)
  }
}
