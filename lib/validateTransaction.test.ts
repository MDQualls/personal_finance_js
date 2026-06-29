import { setTransactionValidated } from './validateTransaction'
import { prismaMock } from '@/lib/__mocks__/prisma'

const existingTx = {
  id: 'cuid_tx_1',
  accountId: 'cuid_account_1',
  amount: -4500,
  date: new Date('2026-04-01T00:00:00Z'),
  categoryId: 'cuid_category_1',
  description: 'TRADER JOES #123',
  notes: null,
  isValidated: false,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('setTransactionValidated', () => {
  it('returns false when transaction does not exist', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(null)

    const result = await setTransactionValidated('nonexistent', true)

    expect(result).toBe(false)
  })

  it('does not call update when transaction does not exist', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(null)

    await setTransactionValidated('nonexistent', true)

    expect(prismaMock.transaction.update).not.toHaveBeenCalled()
  })

  it('returns true when transaction exists', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(existingTx as never)
    prismaMock.transaction.update.mockResolvedValue({ ...existingTx, isValidated: true } as never)

    const result = await setTransactionValidated('cuid_tx_1', true)

    expect(result).toBe(true)
  })

  it('calls update with isValidated: true', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(existingTx as never)
    prismaMock.transaction.update.mockResolvedValue({ ...existingTx, isValidated: true } as never)

    await setTransactionValidated('cuid_tx_1', true)

    expect(prismaMock.transaction.update).toHaveBeenCalledWith({
      where: { id: 'cuid_tx_1' },
      data: { isValidated: true },
    })
  })

  it('calls update with isValidated: false', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({ ...existingTx, isValidated: true } as never)
    prismaMock.transaction.update.mockResolvedValue({ ...existingTx, isValidated: false } as never)

    await setTransactionValidated('cuid_tx_1', false)

    expect(prismaMock.transaction.update).toHaveBeenCalledWith({
      where: { id: 'cuid_tx_1' },
      data: { isValidated: false },
    })
  })

  it('looks up the transaction by the provided id', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue(existingTx as never)
    prismaMock.transaction.update.mockResolvedValue(existingTx as never)

    await setTransactionValidated('cuid_tx_1', true)

    expect(prismaMock.transaction.findUnique).toHaveBeenCalledWith({ where: { id: 'cuid_tx_1' } })
  })
})
