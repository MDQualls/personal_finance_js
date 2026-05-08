import { isDueWithinDays, daysUntil, isBefore, differenceInDays } from './dates'
import type { BudgetAlert, SubscriptionAlert, LargeTransactionAlert, OverdueRecurringAlert } from '@/types'

type BudgetWithSpent = {
  id: string
  amount: number
  spent: number
  category: { name: string }
}

type SubscriptionInput = {
  id: string
  name: string
  amount: number
  nextDueDate: Date
  isActive: boolean
  alertDays: number
}

type TransactionInput = {
  id: string
  description: string
  amount: number
}

export function getBudgetAlerts(budgets: BudgetWithSpent[]): BudgetAlert[] {
  const alerts: BudgetAlert[] = []

  for (const budget of budgets) {
    if (budget.amount <= 0) continue
    const percentage = (budget.spent / budget.amount) * 100

    if (percentage >= 100) {
      alerts.push({
        type: 'budget_over',
        budgetId: budget.id,
        categoryName: budget.category.name,
        spent: budget.spent,
        limit: budget.amount,
        percentage,
      })
    } else if (percentage >= 80) {
      alerts.push({
        type: 'budget_warning',
        budgetId: budget.id,
        categoryName: budget.category.name,
        spent: budget.spent,
        limit: budget.amount,
        percentage,
      })
    }
  }

  return alerts
}

export function getUpcomingSubscriptionAlerts(
  subscriptions: SubscriptionInput[],
  daysAheadOverride?: number
): SubscriptionAlert[] {
  const alerts: SubscriptionAlert[] = []

  for (const sub of subscriptions) {
    if (!sub.isActive) continue
    const days = daysAheadOverride ?? sub.alertDays
    if (isDueWithinDays(sub.nextDueDate, days)) {
      alerts.push({
        type: 'subscription_due',
        subscriptionId: sub.id,
        name: sub.name,
        amount: sub.amount,
        daysUntilDue: daysUntil(sub.nextDueDate),
        dueDate: sub.nextDueDate,
      })
    }
  }

  return alerts
}

export function getOverdueRecurringAlerts(
  rules: Array<{ id: string; name: string; amount: number; nextDate: Date; isActive: boolean; autoPost: boolean }>
): OverdueRecurringAlert[] {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  return rules
    .filter((r) => r.isActive && !r.autoPost && isBefore(r.nextDate, now))
    .map((r) => ({
      type: 'recurring_overdue' as const,
      ruleId: r.id,
      name: r.name,
      amount: r.amount,
      nextDate: r.nextDate,
      daysOverdue: differenceInDays(now, r.nextDate),
    }))
}

export function getLargeTransactionAlerts(
  transactions: TransactionInput[],
  thresholdCents: number
): LargeTransactionAlert[] {
  return transactions
    .filter((tx) => Math.abs(tx.amount) >= thresholdCents)
    .map((tx) => ({
      type: 'large_transaction' as const,
      transactionId: tx.id,
      description: tx.description,
      amount: tx.amount,
      threshold: thresholdCents,
    }))
}
