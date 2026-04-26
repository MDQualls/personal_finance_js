import { normalizeDescription } from './normalize'

const rules = [
  { pattern: 'trader joe', isRegex: false, displayName: "Trader Joe's" },
  { pattern: '^AMZN.*MKTP', isRegex: true, displayName: 'Amazon' },
  { pattern: 'starbucks', isRegex: false, displayName: 'Starbucks' },
]

describe('normalizeDescription', () => {
  it('matches a substring rule case-insensitively', () => {
    expect(normalizeDescription('TRADER JOES #1234', rules)).toBe("Trader Joe's")
  })

  it('matches a regex rule', () => {
    expect(normalizeDescription('AMZN MKTP US*AB12345', rules)).toBe('Amazon')
  })

  it('returns the original description when no rule matches', () => {
    expect(normalizeDescription('WHOLE FOODS MARKET', rules)).toBe('WHOLE FOODS MARKET')
  })

  it('returns the original description for an empty rules array', () => {
    expect(normalizeDescription('TRADER JOES', [])).toBe('TRADER JOES')
  })

  it('uses the first matching rule when multiple could match', () => {
    const overlapping = [
      { pattern: 'coffee', isRegex: false, displayName: 'Coffee Shop' },
      { pattern: 'starbucks coffee', isRegex: false, displayName: 'Starbucks' },
    ]
    expect(normalizeDescription('starbucks coffee #5', overlapping)).toBe('Coffee Shop')
  })

  it('is case-insensitive for substring matches', () => {
    expect(normalizeDescription('Starbucks #999', rules)).toBe('Starbucks')
  })

  it('regex match is case-insensitive (i flag)', () => {
    expect(normalizeDescription('amzn mktp us*xyz', rules)).toBe('Amazon')
  })
})
