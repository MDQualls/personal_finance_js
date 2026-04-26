type MerchantRule = {
  pattern: string
  isRegex: boolean
  displayName: string
}

export function normalizeDescription(raw: string, rules: MerchantRule[]): string {
  for (const rule of rules) {
    const matches = rule.isRegex
      ? new RegExp(rule.pattern, 'i').test(raw)
      : raw.toLowerCase().includes(rule.pattern.toLowerCase())

    if (matches) return rule.displayName
  }
  return raw
}
