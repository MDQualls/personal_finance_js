import { prisma } from '@/lib/prisma'

export async function setTransactionValidated(id: string, isValidated: boolean): Promise<boolean> {
  const existing = await prisma.transaction.findUnique({ where: { id } })
  if (!existing) return false

  await prisma.transaction.update({ where: { id }, data: { isValidated } })
  return true
}
