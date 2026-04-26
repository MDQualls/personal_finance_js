/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { BudgetProgress } from './BudgetProgress'

describe('BudgetProgress', () => {
  it('renders the percentage badge', () => {
    render(<BudgetProgress spent={5000} limit={10000} />)
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('renders green badge below 75%', () => {
    const { container } = render(<BudgetProgress spent={5000} limit={10000} />)
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('text-[#22c55e]')
  })

  it('renders amber badge at 75-99%', () => {
    const { container } = render(<BudgetProgress spent={8000} limit={10000} />)
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('text-[#d97706]')
  })

  it('renders red badge at 100%+', () => {
    const { container } = render(<BudgetProgress spent={10500} limit={10000} />)
    const badge = container.querySelector('span')
    expect(badge?.className).toContain('text-[#ef4444]')
  })

  it('shows 100% badge even when overbudget', () => {
    render(<BudgetProgress spent={15000} limit={10000} />)
    expect(screen.getByText('150%')).toBeInTheDocument()
  })

  it('shows amount labels when showAmounts is true', () => {
    render(<BudgetProgress spent={5000} limit={10000} showAmounts />)
    expect(screen.getByText(/spent/)).toBeInTheDocument()
    expect(screen.getByText(/budget/)).toBeInTheDocument()
  })

  it('hides amounts when showAmounts is false', () => {
    render(<BudgetProgress spent={5000} limit={10000} showAmounts={false} />)
    expect(screen.queryByText(/spent/)).not.toBeInTheDocument()
  })

  it('renders label when provided', () => {
    render(<BudgetProgress spent={1000} limit={5000} label="Groceries" />)
    expect(screen.getByText('Groceries')).toBeInTheDocument()
  })

  it('handles zero limit gracefully', () => {
    render(<BudgetProgress spent={0} limit={0} />)
    expect(screen.getByText('0%')).toBeInTheDocument()
  })
})
