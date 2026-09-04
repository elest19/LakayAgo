import { NextResponse } from 'next/server'
import { query } from '../../../../lib/db'
import { verifyJwt } from '../../../../lib/jwt'

export async function GET(req: Request) {
  try {
    const cookie = req.headers.get('cookie') || ''
    const match = cookie.split(';').map(s => s.trim()).find(s => s.startsWith('token='))
    if (!match) return NextResponse.json({ user: null })

    const token = match.replace('token=', '')
    const payload = verifyJwt(token)
    if (!payload) return NextResponse.json({ user: null })

    const text = `select user_id, name, email, role, restaurant from users where user_id = $1 limit 1`
    const { rows } = await query(text, [payload.user_id])
    const user = rows[0]
    return NextResponse.json({ user: user ?? null })
  } catch (err) {
    console.error('Auth me error', err)
    return NextResponse.json({ user: null })
  }
}
