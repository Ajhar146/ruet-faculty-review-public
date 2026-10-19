import { randomBytes, createHash } from 'crypto'

// The database holds only the hash. If someone reads the database, they
// still cannot sign in as anyone.

export function generateToken() {
  const raw = randomBytes(32).toString('base64url')
  const hash = createHash('sha256').update(raw).digest('hex')
  return { raw, hash }
}

export function hashToken(raw: string) {
  return createHash('sha256').update(raw).digest('hex')
}
