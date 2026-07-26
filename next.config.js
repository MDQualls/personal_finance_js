/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === 'production'

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // HSTS: force HTTPS on every subsequent visit once served over it once. Harmless
  // in dev (plain http:// responses simply don't get the header enforced by browsers).
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // 'unsafe-eval' is only needed for Next.js dev-mode React Refresh/HMR — never
      // required at runtime by an App Router production build, so it's dropped there.
      // 'unsafe-inline' is still required in both: Next.js's own inline hydration
      // bootstrap script has no nonce/hash wiring in this app (that would need a
      // middleware-generated per-request nonce threaded through the document — a
      // larger change than this pass; tracked as a follow-up, not silently dropped).
      `script-src 'self' ${isProd ? '' : "'unsafe-eval' "}'unsafe-inline' https://cdn.plaid.com`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "connect-src 'self' https://api.anthropic.com https://production.plaid.com https://development.plaid.com https://sandbox.plaid.com",
      "frame-src https://cdn.plaid.com",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]

const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

module.exports = nextConfig
