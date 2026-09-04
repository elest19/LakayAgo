import { verifyJwt } from './jwt'

export function getSessionFromRequest(req: Request) {
  const cookie = req.headers.get('cookie') || ''
  const match = cookie.split(';').map(s => s.trim()).find(s => s.startsWith('token='))
  if (!match) return null
  const token = match.replace('token=', '')
  const payload = verifyJwt(token)
  return payload
}

export default getSessionFromRequest
