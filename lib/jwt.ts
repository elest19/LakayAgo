// @ts-nocheck
// @ts-ignore
import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET

export function signJwt(payload: Record<string, any>, opts: any = {}) {
  if (!SECRET) throw new Error('Missing JWT_SECRET environment variable')
  return jwt.sign(payload, SECRET, { expiresIn: opts.expiresIn || '7d' })
}

export function verifyJwt(token: string) {
  if (!SECRET) return null
  try {
    return jwt.verify(token, SECRET) as any
  } catch (err) {
    return null
  }
}

export default { signJwt, verifyJwt }
