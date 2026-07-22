/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { SubscriptionForm } from './SubscriptionForm'

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

describe('SubscriptionForm — Category select', () => {
  it('preselects a parent category that has children, not just its leaf subcategories', () => {
    render(
      <SubscriptionForm
        categories={[shoppingWithChild]}
        initialValues={{
          id: 'cuid_sub_1',
          name: 'Netflix',
          amount: 1599,
          frequency: 'MONTHLY',
          nextDueDate: new Date('2026-08-01T00:00:00Z'),
          categoryId: 'cuid_category_shopping',
          notes: null,
          alertDays: 3,
          isActive: true,
        }}
      />
    )

    expect(screen.getByLabelText('Category')).toHaveValue('cuid_category_shopping')
  })
})
