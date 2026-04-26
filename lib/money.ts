export function toCents(dollars: number): number {
  return Math.round(dollars * 100)
}

export function toDollars(cents: number): number {
  return cents / 100
}

export function formatCurrency(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export function formatCurrencyTabular(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export function isNegative(cents: number): boolean {
  return cents < 0
}

export function absAmount(cents: number): number {
  return Math.abs(cents)
}

export function sumCents(amounts: number[]): number {
  return amounts.reduce((sum, n) => sum + n, 0)
}

export function annualEquivalent(cents: number, frequency: string): number {
  switch (frequency) {
    case 'WEEKLY':
      return cents * 52
    case 'BIWEEKLY':
      return cents * 26
    case 'MONTHLY':
      return cents * 12
    case 'QUARTERLY':
      return cents * 4
    case 'YEARLY':
      return cents
    default:
      return cents * 12
  }
}

export function monthlyEquivalent(cents: number, frequency: string): number {
  switch (frequency) {
    case 'WEEKLY':
      return Math.round((cents * 52) / 12)
    case 'BIWEEKLY':
      return Math.round((cents * 26) / 12)
    case 'MONTHLY':
      return cents
    case 'QUARTERLY':
      return Math.round(cents / 3)
    case 'YEARLY':
      return Math.round(cents / 12)
    default:
      return cents
  }
}
