/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { BudgetForm } from './BudgetForm'

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
} as never

describe('BudgetForm — Category select', () => {
  it('preselects a parent category that has children, not just its leaf subcategories', () => {
    render(
      <BudgetForm
        categories={[shoppingWithChild]}
        initialValues={{
          id: 'cuid_budget_1',
          amount: 50000,
          period: 'MONTHLY',
          budgetType: 'SPENDING_LIMIT',
          rollover: false,
          categoryId: 'cuid_category_shopping',
          category: { id: 'cuid_category_shopping', name: 'Shopping', color: '#6b7a8d' },
        }}
      />
    )

    expect(screen.getByLabelText('Category')).toHaveValue('cuid_category_shopping')
  })
})
