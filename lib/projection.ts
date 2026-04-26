import { addFrequency, toISODateString, isBefore, isAfter } from './dates'
import type { DailyBalance, ProjectionEvent } from '@/types'
import type { Frequency } from '@prisma/client'

type RecurringRuleInput = {
  name: string
  amount: number // cents; positive = income, negative = expense
  frequency: Frequency
  nextDate: Date
  type: 'INCOME' | 'EXPENSE'
}

type SubscriptionInput = {
  name: string
  amount: number // cents, always positive (expense)
  frequency: Frequency
  nextDueDate: Date
  isActive: boolean
}

export function projectBalance(
  startingBalance: number,
  recurringRules: RecurringRuleInput[],
  subscriptions: SubscriptionInput[],
  days: number
): DailyBalance[] {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const endDate = new Date(now)
  endDate.setDate(endDate.getDate() + days)

  // Build map of date string → list of events
  const eventsByDate = new Map<string, ProjectionEvent[]>()

  function addEvent(date: Date, event: ProjectionEvent) {
    const key = toISODateString(date)
    if (!eventsByDate.has(key)) eventsByDate.set(key, [])
    eventsByDate.get(key)!.push(event)
  }

  // Project recurring rules
  for (const rule of recurringRules) {
    let cursor = new Date(rule.nextDate)
    cursor.setHours(0, 0, 0, 0)

    while (!isAfter(cursor, endDate)) {
      if (!isBefore(cursor, now)) {
        const amount = rule.type === 'INCOME' ? Math.abs(rule.amount) : -Math.abs(rule.amount)
        addEvent(cursor, {
          name: rule.name,
          amount,
          type: rule.type === 'INCOME' ? 'income' : 'expense',
        })
      }
      cursor = addFrequency(new Date(cursor), rule.frequency)
    }
  }

  // Project subscriptions
  for (const sub of subscriptions) {
    if (!sub.isActive) continue

    let cursor = new Date(sub.nextDueDate)
    cursor.setHours(0, 0, 0, 0)

    while (!isAfter(cursor, endDate)) {
      if (!isBefore(cursor, now)) {
        addEvent(cursor, {
          name: sub.name,
          amount: -Math.abs(sub.amount),
          type: 'subscription',
        })
      }
      cursor = addFrequency(new Date(cursor), sub.frequency)
    }
  }

  // Build daily balance array
  const result: DailyBalance[] = []
  let runningBalance = startingBalance

  const cursor = new Date(now)
  while (!isAfter(cursor, endDate)) {
    const key = toISODateString(cursor)
    const events = eventsByDate.get(key) ?? []

    for (const event of events) {
      runningBalance += event.amount
    }

    result.push({
      date: key,
      balance: runningBalance,
      belowZero: runningBalance < 0,
      events,
    })

    cursor.setDate(cursor.getDate() + 1)
  }

  return result
}
