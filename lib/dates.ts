import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  addWeeks,
  addMonths,
  addQuarters,
  addYears,
  isBefore,
  isAfter,
  differenceInDays,
  parseISO,
  formatISO,
} from 'date-fns'

export type Period = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
export type Frequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'

export function formatDisplay(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'MMM d, yyyy')
}

export function formatMonth(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'MMMM yyyy')
}

export function formatPeriodKey(date: Date): string {
  return format(date, 'yyyy-MM')
}

export function startOfPeriod(date: Date, period: Period): Date {
  switch (period) {
    case 'WEEKLY':
      return startOfWeek(date, { weekStartsOn: 0 })
    case 'MONTHLY':
      return startOfMonth(date)
    case 'QUARTERLY':
      return startOfQuarter(date)
    case 'YEARLY':
      return startOfYear(date)
  }
}

export function endOfPeriod(date: Date, period: Period): Date {
  switch (period) {
    case 'WEEKLY':
      return endOfWeek(date, { weekStartsOn: 0 })
    case 'MONTHLY':
      return endOfMonth(date)
    case 'QUARTERLY':
      return endOfQuarter(date)
    case 'YEARLY':
      return endOfYear(date)
  }
}

export function addFrequency(date: Date, frequency: Frequency, count = 1): Date {
  switch (frequency) {
    case 'WEEKLY':
      return addWeeks(date, count)
    case 'BIWEEKLY':
      return addWeeks(date, count * 2)
    case 'MONTHLY':
      return addMonths(date, count)
    case 'QUARTERLY':
      return addQuarters(date, count)
    case 'YEARLY':
      return addYears(date, count)
  }
}

export function isOverdue(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date
  return isBefore(d, new Date())
}

export function isDueWithinDays(date: Date | string, days: number): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date
  const now = new Date()
  return !isBefore(d, now) && differenceInDays(d, now) <= days
}

export function daysUntil(date: Date | string): number {
  const d = typeof date === 'string' ? parseISO(date) : date
  return differenceInDays(d, new Date())
}

export function toISODateString(date: Date): string {
  return formatISO(date, { representation: 'date' })
}

export { parseISO, isAfter, isBefore, differenceInDays, format }
