/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { TransactionRow } from './TransactionRow'

const baseTransaction = {
  id: 'cuid_tx_1',
  accountId: 'cuid_account_1',
  amount: -4500,
  date: new Date('2026-04-01T00:00:00Z'),
  categoryId: 'cuid_category_1',
  description: 'TRADER JOES #123',
  notes: null,
  isValidated: false,
  isTransfer: false,
  needsReview: true,
  plaidTransactionId: null,
  deletedAt: null,
  createdAt: new Date('2026-04-01T00:00:00Z'),
  updatedAt: new Date('2026-04-01T00:00:00Z'),
  category: { name: 'Uncategorized', color: '#6b7a8d', icon: 'tag' },
  account: { name: 'Checking' },
}

const reviewCategories = [
  { id: 'cuid_category_1', name: 'Uncategorized', parentId: null, color: '#6b7a8d', icon: 'tag', isIncome: false, isSystem: true, isActive: true, children: [] },
  { id: 'cuid_category_2', name: 'Groceries', parentId: null, color: '#22c55e', icon: 'tag', isIncome: false, isSystem: false, isActive: true, children: [] },
]

describe('TransactionRow — review mode', () => {
  it('does not render review controls when onApprove is absent', () => {
    render(<TransactionRow transaction={baseTransaction as never} />)
    expect(screen.queryByText('Approve')).not.toBeInTheDocument()
  })

  it('renders the category dropdown and Approve button when in review mode', () => {
    render(
      <TransactionRow
        transaction={baseTransaction as never}
        onApprove={jest.fn()}
        reviewCategories={reviewCategories as never}
      />
    )
    expect(screen.getByText('Approve')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('calls onApprove with the existing categoryId by default', async () => {
    const onApprove = jest.fn().mockResolvedValue(undefined)
    render(
      <TransactionRow
        transaction={baseTransaction as never}
        onApprove={onApprove}
        reviewCategories={reviewCategories as never}
      />
    )

    fireEvent.click(screen.getByText('Approve'))
    expect(onApprove).toHaveBeenCalledWith('cuid_tx_1', 'cuid_category_1')
  })

  it('calls onApprove with the newly selected categoryId after changing the dropdown', async () => {
    const onApprove = jest.fn().mockResolvedValue(undefined)
    render(
      <TransactionRow
        transaction={baseTransaction as never}
        onApprove={onApprove}
        reviewCategories={reviewCategories as never}
      />
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'cuid_category_2' } })
    fireEvent.click(screen.getByText('Approve'))

    expect(onApprove).toHaveBeenCalledWith('cuid_tx_1', 'cuid_category_2')
  })

  it('hides the detail panel until the expand toggle is clicked', () => {
    render(
      <TransactionRow
        transaction={baseTransaction as never}
        onApprove={jest.fn()}
        reviewCategories={reviewCategories as never}
      />
    )
    expect(screen.queryByText('Source:')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTitle('Show details'))
    expect(screen.getByText('Source:')).toBeInTheDocument()
    expect(screen.getByText('CSV Import')).toBeInTheDocument()
  })

  it('shows Plaid as the source when plaidTransactionId is set', () => {
    render(
      <TransactionRow
        transaction={{ ...baseTransaction, plaidTransactionId: 'plaid_tx_1' } as never}
        onApprove={jest.fn()}
        reviewCategories={reviewCategories as never}
      />
    )

    fireEvent.click(screen.getByTitle('Show details'))
    expect(screen.getByText('Plaid')).toBeInTheDocument()
  })
})
