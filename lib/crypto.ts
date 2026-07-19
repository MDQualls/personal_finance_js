import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'

// Read lazily (not at module scope) so importing this file never crashes
// before ENCRYPTION_KEY is configured — jest's coverage collector loads
// every lib/**/*.ts file, and unrelated Plaid work happens before the key exists.
function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error('ENCRYPTION_KEY is not set')
  }
  return Buffer.from(key, 'base64')
}

export function encryptToken(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Stored as iv:tag:encrypted — all base64
  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':')
}

export function decryptToken(stored: string): string {
  const key = getKey()
  const [ivB64, tagB64, encryptedB64] = stored.split(':')
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const encrypted = Buffer.from(encryptedB64, 'base64')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8')
}
