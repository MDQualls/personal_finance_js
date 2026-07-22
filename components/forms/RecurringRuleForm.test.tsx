/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { RecurringRuleForm } from './RecurringRuleForm'

const accounts = [{ id: 'cuid_account_1', name: 'Holly Checking 8660', isActive: true }] as never

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

describe('RecurringRuleForm — Category select', () => {
  it('preselects a parent category that has children, not just its leaf subcategories', () => {
    render(
      <RecurringRuleForm
        accounts={accounts}
        categories={[shoppingWithChild]}
        initialValues={{
          id: 'cuid_rule_1',
          name: 'Household Supplies',
          amount: -5000,
          frequency: 'MONTHLY',
          accountId: 'cuid_account_1',
          categoryId: 'cuid_category_shopping',
          nextDate: new Date('2026-08-01T00:00:00Z'),
          type: 'EXPENSE',
          autoPost: false,
          notes: null,
        }}
      />
    )

    expect(screen.getByLabelText('Category')).toHaveValue('cuid_category_shopping')
  })
})
