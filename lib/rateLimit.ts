type BucketEntry = {
  count: number
  resetAt: number
}

const buckets = new Map<string, BucketEntry>()

function check(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = buckets.get(key)

  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= limit) return false

  entry.count++
  return true
}

// 10 attempts per 15 minutes — for auth endpoints
export function checkAuthRateLimit(ip: string): boolean {
  return check(`auth:${ip}`, 10, 15 * 60 * 1000)
}

// 20 requests per hour — for AI insights (cost control)
export function checkInsightsRateLimit(ip: string): boolean {
  return check(`insights:${ip}`, 20, 60 * 60 * 1000)
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return 'unknown'
}
