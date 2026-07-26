type BucketEntry = {
  count: number
  resetAt: number
}

const buckets = new Map<string, BucketEntry>()

// This limiter keys buckets by client IP, which for a single-container deployment
// with no reverse proxy in front of it (see docker-compose.yml — the app binds
// directly to 127.0.0.1) is derived from a client-controlled `x-forwarded-for`
// header (getClientIp/getClientIpFromHeaderRecord below). A caller can bypass the
// limit entirely by sending a different spoofed value per request. Fixing that
// properly requires a trusted reverse proxy that strips/overwrites inbound
// X-Forwarded-For before it reaches this app — out of scope for a personal,
// single-user deployment, but worth knowing if this is ever exposed beyond
// localhost. What IS fixed here: without a sweep, a spoofing caller sending a
// unique IP per request would also grow `buckets` unboundedly (a memory-exhaustion
// vector on its own, independent of bypassing the limit) — SWEEP_INTERVAL bounds
// that regardless of whether the IP is genuine or spoofed.
const SWEEP_INTERVAL = 500 // sweep expired entries once buckets grows past this size

function check(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()

  if (buckets.size > SWEEP_INTERVAL) {
    for (const [k, v] of buckets) {
      if (now > v.resetAt) buckets.delete(k)
    }
  }

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

function firstForwardedIp(value: string | null | undefined): string {
  if (!value) return 'unknown'
  return value.split(',')[0].trim()
}

export function getClientIp(req: Request): string {
  return firstForwardedIp(req.headers.get('x-forwarded-for'))
}

// NextAuth's Credentials provider `authorize(credentials, req)` passes a plain
// header object (Record<string, any>), not a Fetch API Request — it has no
// `.headers.get()` method, so it needs its own extraction path.
export function getClientIpFromHeaderRecord(headers: Record<string, unknown> | undefined): string {
  const value = headers?.['x-forwarded-for']
  const raw = Array.isArray(value) ? value[0] : value
  return firstForwardedIp(typeof raw === 'string' ? raw : undefined)
}
