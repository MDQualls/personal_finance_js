import {
  formatDisplay,
  formatMonth,
  formatPeriodKey,
  startOfPeriod,
  endOfPeriod,
  addFrequency,
  isOverdue,
  isDueWithinDays,
  daysUntil,
  toISODateString,
} from './dates'

describe('formatDisplay', () => {
  it('formats a Date object', () => {
    expect(formatDisplay(new Date('2026-04-15T12:00:00Z'))).toBe('Apr 15, 2026')
  })

  it('formats an ISO string', () => {
    expect(formatDisplay('2026-01-01T00:00:00Z')).toBe('Jan 1, 2026')
  })

  it('handles end of month', () => {
    expect(formatDisplay(new Date('2026-12-31T00:00:00Z'))).toBe('Dec 31, 2026')
  })
})

describe('formatMonth', () => {
  it('formats as month and year', () => {
    expect(formatMonth(new Date('2026-04-01T00:00:00Z'))).toBe('April 2026')
  })

  it('formats a date string', () => {
    expect(formatMonth('2026-01-15T00:00:00Z')).toBe('January 2026')
  })
})

describe('formatPeriodKey', () => {
  it('returns yyyy-MM format', () => {
    expect(formatPeriodKey(new Date('2026-04-15T00:00:00Z'))).toBe('2026-04')
  })

  it('zero-pads single-digit months', () => {
    expect(formatPeriodKey(new Date('2026-01-15T00:00:00Z'))).toBe('2026-01')
  })
})

describe('startOfPeriod', () => {
  it('returns start of month', () => {
    const result = startOfPeriod(new Date('2026-04-15T12:00:00Z'), 'MONTHLY')
    expect(result.getUTCDate()).toBe(1)
  })

  it('returns start of week (Sunday)', () => {
    const result = startOfPeriod(new Date('2026-04-15T00:00:00'), 'WEEKLY')
    expect(result.getDay()).toBe(0) // Sunday
  })

  it('returns start of quarter', () => {
    const result = startOfPeriod(new Date('2026-05-15T00:00:00'), 'QUARTERLY')
    expect(result.getMonth()).toBe(3) // April (Q2 starts April)
  })

  it('returns start of year', () => {
    const result = startOfPeriod(new Date('2026-07-04T00:00:00'), 'YEARLY')
    expect(result.getMonth()).toBe(0)
    expect(result.getDate()).toBe(1)
  })
})

describe('endOfPeriod', () => {
  it('returns last moment of the month', () => {
    const result = endOfPeriod(new Date('2026-04-15T00:00:00'), 'MONTHLY')
    expect(result.getMonth()).toBe(3) // April
    expect(result.getDate()).toBe(30)
  })

  it('returns correct end for February in a non-leap year', () => {
    const result = endOfPeriod(new Date('2026-02-10T00:00:00'), 'MONTHLY')
    expect(result.getDate()).toBe(28)
  })

  it('returns correct end for February in a leap year', () => {
    const result = endOfPeriod(new Date('2024-02-10T00:00:00'), 'MONTHLY')
    expect(result.getDate()).toBe(29)
  })

  it('returns end of year', () => {
    const result = endOfPeriod(new Date('2026-06-01T00:00:00'), 'YEARLY')
    expect(result.getMonth()).toBe(11) // December
    expect(result.getDate()).toBe(31)
  })
})

describe('addFrequency', () => {
  it('adds one week for WEEKLY', () => {
    const base = new Date('2026-04-01T00:00:00')
    const result = addFrequency(base, 'WEEKLY')
    expect(result.getDate()).toBe(8)
  })

  it('adds two weeks for BIWEEKLY', () => {
    const base = new Date('2026-04-01T00:00:00')
    const result = addFrequency(base, 'BIWEEKLY')
    expect(result.getDate()).toBe(15)
  })

  it('adds one month for MONTHLY', () => {
    const base = new Date('2026-04-01T00:00:00')
    const result = addFrequency(base, 'MONTHLY')
    expect(result.getMonth()).toBe(4) // May
  })

  it('handles month-end correctly for MONTHLY', () => {
    const base = new Date('2026-01-31T00:00:00')
    const result = addFrequency(base, 'MONTHLY')
    expect(result.getMonth()).toBe(1) // Feb
    expect(result.getDate()).toBe(28) // clamped to end of Feb
  })

  it('adds one quarter for QUARTERLY', () => {
    const base = new Date('2026-01-01T00:00:00')
    const result = addFrequency(base, 'QUARTERLY')
    expect(result.getMonth()).toBe(3) // April
  })

  it('adds one year for YEARLY', () => {
    const base = new Date('2026-04-01T00:00:00')
    const result = addFrequency(base, 'YEARLY')
    expect(result.getFullYear()).toBe(2027)
  })

  it('respects the count parameter', () => {
    const base = new Date('2026-04-01T00:00:00')
    const result = addFrequency(base, 'MONTHLY', 3)
    expect(result.getMonth()).toBe(6) // July
  })
})

describe('isOverdue', () => {
  it('returns true for a past date', () => {
    expect(isOverdue(new Date('2020-01-01T00:00:00Z'))).toBe(true)
  })

  it('returns false for a future date', () => {
    const future = new Date()
    future.setFullYear(future.getFullYear() + 1)
    expect(isOverdue(future)).toBe(false)
  })

  it('accepts an ISO string', () => {
    expect(isOverdue('2020-01-01T00:00:00Z')).toBe(true)
  })
})

describe('isDueWithinDays', () => {
  it('returns true when due within N days', () => {
    const soon = new Date()
    soon.setDate(soon.getDate() + 2)
    expect(isDueWithinDays(soon, 3)).toBe(true)
  })

  it('returns false when due beyond N days', () => {
    const later = new Date()
    later.setDate(later.getDate() + 10)
    expect(isDueWithinDays(later, 3)).toBe(false)
  })

  it('returns false for overdue dates', () => {
    expect(isDueWithinDays(new Date('2020-01-01T00:00:00Z'), 30)).toBe(false)
  })
})

describe('daysUntil', () => {
  it('returns positive days for future date', () => {
    const future = new Date()
    future.setDate(future.getDate() + 7)
    expect(daysUntil(future)).toBeGreaterThan(0)
  })

  it('returns negative days for past date', () => {
    expect(daysUntil(new Date('2020-01-01T00:00:00Z'))).toBeLessThan(0)
  })
})

describe('toISODateString', () => {
  it('returns date in YYYY-MM-DD format', () => {
    const result = toISODateString(new Date('2026-04-15T12:00:00Z'))
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
