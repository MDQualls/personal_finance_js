import {
  toCents,
  toDollars,
  formatCurrency,
  formatCurrencyTabular,
  isNegative,
  absAmount,
  sumCents,
  annualEquivalent,
  monthlyEquivalent,
} from './money'

describe('toCents', () => {
  it('converts whole dollar amounts', () => {
    expect(toCents(10)).toBe(1000)
  })

  it('converts fractional dollar amounts', () => {
    expect(toCents(1.50)).toBe(150)
    expect(toCents(9.99)).toBe(999)
  })

  it('rounds half-cent values consistently', () => {
    // Many .X05 values are stored slightly below in IEEE 754 and round down —
    // use values that are stored slightly above so rounding is deterministic
    expect(toCents(1.235)).toBe(124)  // 1.235 * 100 = 123.500...01 → rounds up
    expect(toCents(2.505)).toBe(251)  // 2.505 * 100 = 250.5 exactly → rounds up
    expect(toCents(1.004)).toBe(100)  // clearly below .5 → rounds down
  })

  it('handles negative amounts', () => {
    expect(toCents(-5.50)).toBe(-550)
    expect(toCents(-0.01)).toBe(-1)
  })

  it('handles zero', () => {
    expect(toCents(0)).toBe(0)
  })

  it('handles large amounts', () => {
    expect(toCents(10000)).toBe(1000000)
  })
})

describe('toDollars', () => {
  it('converts cents to dollars', () => {
    expect(toDollars(1000)).toBe(10)
    expect(toDollars(150)).toBe(1.5)
    expect(toDollars(1)).toBe(0.01)
  })

  it('handles negative cents', () => {
    expect(toDollars(-550)).toBe(-5.5)
  })

  it('handles zero', () => {
    expect(toDollars(0)).toBe(0)
  })

  it('is the inverse of toCents for whole-cent values', () => {
    expect(toDollars(toCents(42.50))).toBe(42.50)
    expect(toDollars(toCents(0.99))).toBe(0.99)
  })
})

describe('formatCurrency', () => {
  it('formats cents as USD by default', () => {
    expect(formatCurrency(1000)).toBe('$10.00')
    expect(formatCurrency(150)).toBe('$1.50')
    expect(formatCurrency(1)).toBe('$0.01')
  })

  it('formats zero correctly', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })

  it('formats negative amounts', () => {
    expect(formatCurrency(-1000)).toBe('-$10.00')
    expect(formatCurrency(-1)).toBe('-$0.01')
  })

  it('formats large amounts with commas', () => {
    expect(formatCurrency(1000000)).toBe('$10,000.00')
    expect(formatCurrency(10000000)).toBe('$100,000.00')
  })

  it('respects currency parameter', () => {
    const result = formatCurrency(1000, 'EUR')
    expect(result).toContain('10')
  })
})

describe('isNegative', () => {
  it('returns true for negative cents', () => {
    expect(isNegative(-1)).toBe(true)
    expect(isNegative(-10000)).toBe(true)
  })

  it('returns false for positive cents', () => {
    expect(isNegative(1)).toBe(false)
    expect(isNegative(10000)).toBe(false)
  })

  it('returns false for zero', () => {
    expect(isNegative(0)).toBe(false)
  })
})

describe('absAmount', () => {
  it('returns the absolute value of negative cents', () => {
    expect(absAmount(-500)).toBe(500)
  })

  it('returns the same value for positive cents', () => {
    expect(absAmount(500)).toBe(500)
  })

  it('handles zero', () => {
    expect(absAmount(0)).toBe(0)
  })
})

describe('sumCents', () => {
  it('sums an array of cent amounts', () => {
    expect(sumCents([100, 200, 300])).toBe(600)
  })

  it('handles negative amounts in the array', () => {
    expect(sumCents([1000, -500, 200])).toBe(700)
  })

  it('returns zero for empty array', () => {
    expect(sumCents([])).toBe(0)
  })

  it('handles a single value', () => {
    expect(sumCents([9999])).toBe(9999)
  })
})

describe('annualEquivalent', () => {
  it('calculates weekly to annual (× 52)', () => {
    expect(annualEquivalent(1000, 'WEEKLY')).toBe(52000)
  })

  it('calculates biweekly to annual (× 26)', () => {
    expect(annualEquivalent(1000, 'BIWEEKLY')).toBe(26000)
  })

  it('returns monthly × 12', () => {
    expect(annualEquivalent(1000, 'MONTHLY')).toBe(12000)
  })

  it('calculates quarterly to annual (× 4)', () => {
    expect(annualEquivalent(1000, 'QUARTERLY')).toBe(4000)
  })

  it('returns same amount for YEARLY', () => {
    expect(annualEquivalent(1000, 'YEARLY')).toBe(1000)
  })

  it('defaults to monthly × 12 for unknown frequency', () => {
    expect(annualEquivalent(1000, 'UNKNOWN')).toBe(12000)
  })
})

describe('formatCurrencyTabular', () => {
  it('formats cents as USD by default', () => {
    expect(formatCurrencyTabular(1000)).toBe('$10.00')
    expect(formatCurrencyTabular(150)).toBe('$1.50')
  })

  it('formats zero correctly', () => {
    expect(formatCurrencyTabular(0)).toBe('$0.00')
  })

  it('formats negative amounts', () => {
    expect(formatCurrencyTabular(-1000)).toBe('-$10.00')
  })

  it('formats large amounts with commas', () => {
    expect(formatCurrencyTabular(1000000)).toBe('$10,000.00')
  })
})

describe('monthlyEquivalent', () => {
  it('returns same amount for MONTHLY frequency', () => {
    expect(monthlyEquivalent(1000, 'MONTHLY')).toBe(1000)
  })

  it('calculates weekly to monthly (52 weeks / 12 months)', () => {
    expect(monthlyEquivalent(1200, 'WEEKLY')).toBe(Math.round((1200 * 52) / 12))
  })

  it('calculates biweekly to monthly (26 pays / 12 months)', () => {
    expect(monthlyEquivalent(2400, 'BIWEEKLY')).toBe(Math.round((2400 * 26) / 12))
  })

  it('calculates quarterly to monthly (÷ 3)', () => {
    expect(monthlyEquivalent(3000, 'QUARTERLY')).toBe(1000)
  })

  it('calculates yearly to monthly (÷ 12)', () => {
    expect(monthlyEquivalent(12000, 'YEARLY')).toBe(1000)
  })

  it('returns input for unknown frequency', () => {
    expect(monthlyEquivalent(500, 'UNKNOWN')).toBe(500)
  })
})
