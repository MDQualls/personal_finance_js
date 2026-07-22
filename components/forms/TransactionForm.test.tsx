/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TransactionForm } from './TransactionForm'

const accounts = [
  { id: 'cuid_account_1', name: 'Holly Checking 8660' },
  { id: 'cuid_account_2', name: 'OKCU 8690' },
] as never

const categories = [
  { id: 'cuid_category_1', name: 'Transfers', parentId: null, color: '#6b7a8d', icon: 'tag', isIncome: false, isSystem: true, isActive: true, children: [] },
] as never

const editedTransaction = {
  id: 'cuid_tx_edit',
  accountId: 'cuid_account_2',
  amount: -50000,
  date: new Date('2026-06-05T00:00:00Z'),
  categoryId: 'cuid_category_1',
  description: 'Internet Transfer to XXXXXX8660',
  notes: null,
  isTransfer: false,
}

const candidateTransaction = {
  id: 'cuid_tx_candidate',
  accountId: 'cuid_account_1',
  amount: 50000,
  date: new Date('2026-06-05T00:00:00Z'),
  categoryId: 'cuid_category_1',
  description: 'Internet Transfer from XXXXXX8690',
  account: { name: 'Holly Checking 8660' },
}

describe('TransactionForm — Link as Transfer', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [candidateTransaction] }),
    }) as never
  })

  it('scopes the candidate lookup to a date range around the edited transaction instead of only the most recent rows', async () => {
    render(<TransactionForm accounts={accounts} categories={categories} initialValues={editedTransaction} />)

    fireEvent.click(screen.getByText('Link as Transfer'))

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string
    const params = new URL(calledUrl, 'http://localhost').searchParams

    expect(params.get('excludeTransfers')).toBe('true')
    expect(params.get('from')).toBe('2026-05-31T00:00:00.000Z')
    expect(params.get('to')).toBe('2026-06-10T00:00:00.000Z')
  })

  it('surfaces a same-day, opposite-amount, different-account transaction as a link candidate', async () => {
    render(<TransactionForm accounts={accounts} categories={categories} initialValues={editedTransaction} />)

    fireEvent.click(screen.getByText('Link as Transfer'))

    expect(await screen.findByText('Internet Transfer from XXXXXX8690')).toBeInTheDocument()
    expect(
      screen.queryByText('No compatible transactions found within ±5 days on a different account.')
    ).not.toBeInTheDocument()
  })
})

describe('TransactionForm — Category select', () => {
  const shoppingWithChild = {
    id: 'cuid_category_shopping',
    name: 'Shopping',
    parentId: null,
    color: '#6b7a8d',
    icon: 'tag',
    isIncome: false,
    isSystem: true,
    isActive: true,
    children: [
      { id: 'cuid_category_thrifting', name: 'Thrifting', parentId: 'cuid_category_shopping', color: '#6b7a8d', icon: 'tag', isIncome: false, isSystem: false, isActive: true },
    ],
  }

  it('preselects a parent category that has children, not just its leaf subcategories', () => {
    const transactionOnParentCategory = {
      id: 'cuid_tx_1',
      accountId: 'cuid_account_1',
      amount: -436,
      date: new Date('2026-07-19T00:00:00Z'),
      categoryId: 'cuid_category_shopping',
      description: 'Dollar General',
      notes: null,
    }

    render(
      <TransactionForm
        accounts={accounts}
        categories={[shoppingWithChild] as never}
        initialValues={transactionOnParentCategory}
      />
    )

    expect(screen.getByLabelText('Category')).toHaveValue('cuid_category_shopping')
  })

  it('still lists the leaf subcategory as its own selectable option', () => {
    const transactionOnChildCategory = {
      id: 'cuid_tx_2',
      accountId: 'cuid_account_1',
      amount: -1237,
      date: new Date('2026-06-01T00:00:00Z'),
      categoryId: 'cuid_category_thrifting',
      description: 'Community Thrift',
      notes: null,
    }

    render(
      <TransactionForm
        accounts={accounts}
        categories={[shoppingWithChild] as never}
        initialValues={transactionOnChildCategory}
      />
    )

    expect(screen.getByLabelText('Category')).toHaveValue('cuid_category_thrifting')
  })
})
