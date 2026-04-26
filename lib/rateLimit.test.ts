import { checkAuthRateLimit, checkInsightsRateLimit, getClientIp } from './rateLimit'

// Use unique IPs per test to avoid cross-test bucket state
let ipCounter = 0
function freshIp(): string {
  return `192.168.0.${++ipCounter}`
}

describe('checkAuthRateLimit', () => {
  it('allows a fresh IP through', () => {
    expect(checkAuthRateLimit(freshIp())).toBe(true)
  })

  it('allows up to 10 attempts', () => {
    const ip = freshIp()
    for (let i = 0; i < 10; i++) {
      expect(checkAuthRateLimit(ip)).toBe(true)
    }
  })

  it('blocks the 11th attempt', () => {
    const ip = freshIp()
    for (let i = 0; i < 10; i++) checkAuthRateLimit(ip)
    expect(checkAuthRateLimit(ip)).toBe(false)
  })

  it('resets after the time window expires', () => {
    const ip = freshIp()
    for (let i = 0; i < 10; i++) checkAuthRateLimit(ip)
    expect(checkAuthRateLimit(ip)).toBe(false)

    // Advance time past the 15-minute window
    const realNow = Date.now
    Date.now = () => realNow() + 16 * 60 * 1000
    try {
      expect(checkAuthRateLimit(ip)).toBe(true)
    } finally {
      Date.now = realNow
    }
  })
})

describe('checkInsightsRateLimit', () => {
  it('allows a fresh IP through', () => {
    expect(checkInsightsRateLimit(freshIp())).toBe(true)
  })

  it('allows up to 20 requests', () => {
    const ip = freshIp()
    for (let i = 0; i < 20; i++) {
      expect(checkInsightsRateLimit(ip)).toBe(true)
    }
  })

  it('blocks the 21st request', () => {
    const ip = freshIp()
    for (let i = 0; i < 20; i++) checkInsightsRateLimit(ip)
    expect(checkInsightsRateLimit(ip)).toBe(false)
  })

  it('resets after the hour window expires', () => {
    const ip = freshIp()
    for (let i = 0; i < 20; i++) checkInsightsRateLimit(ip)
    expect(checkInsightsRateLimit(ip)).toBe(false)

    const realNow = Date.now
    Date.now = () => realNow() + 61 * 60 * 1000
    try {
      expect(checkInsightsRateLimit(ip)).toBe(true)
    } finally {
      Date.now = realNow
    }
  })
})

describe('getClientIp', () => {
  it('extracts IP from x-forwarded-for header', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    })
    expect(getClientIp(req)).toBe('1.2.3.4')
  })

  it('returns first IP when x-forwarded-for has multiple values', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '10.0.0.1, 10.0.0.2, 10.0.0.3' },
    })
    expect(getClientIp(req)).toBe('10.0.0.1')
  })

  it('returns "unknown" when no forwarding header is present', () => {
    const req = new Request('http://localhost')
    expect(getClientIp(req)).toBe('unknown')
  })
})
