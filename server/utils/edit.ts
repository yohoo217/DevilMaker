import { createHash, randomBytes } from 'node:crypto'

export function createEditToken() {
  const token = randomBytes(32).toString('hex')
  return { token, hash: hashEditToken(token) }
}

export function hashEditToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}
