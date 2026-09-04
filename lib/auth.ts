// @ts-nocheck
/// <reference types="node" />

import crypto from 'crypto'

const SECRET = process.env.SESSION_SECRET || 'change-me'
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

export function signSession(payload: Record<string, any>) {
  const body = { ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS }
  const data = Buffer.from(JSON.stringify(body)).toString('base64url')
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url')
  return `${data}.${sig}`
}

export function verifySession(token: string) {
  try {
    const [data, sig] = token.split('.')
    if (!data || !sig) return null
    const expected = crypto.createHmac('sha256', SECRET).update(data).digest('base64url')
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'))
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null
    return payload
  } catch (err) {
    return null
  }
}
