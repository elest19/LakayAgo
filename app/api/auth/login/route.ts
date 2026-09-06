import { NextResponse } from 'next/server'
import { query } from '../../../../lib/db'
import { signJwt } from '../../../../lib/jwt'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { username, email, password } = body
    if (!(username || email) || !password) return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })

    let text = ''
    let params: any[] = []
    if (username) {
      text = `select user_id, name, username, email, password, role, restaurant from users where username = $1 limit 1`
      params = [username]
    } else {
      text = `select user_id, name, username, email, password, role, restaurant from users where email = $1 limit 1`
      params = [email]
    }
    const { rows } = await query(text, params)
    const user = rows[0]
    if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

    const ok = await bcrypt.compare(password, user.password)
    if (!ok) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

    // include textual restaurant scope in token (no numeric ID since restaurants table dropped)
    const token = signJwt({ user_id: user.user_id, role: user.role, restaurant: user.restaurant })

    const res = NextResponse.json({ user: { user_id: user.user_id, name: user.name, username: user.username, email: user.email, role: user.role, restaurant: user.restaurant } })
    res.cookies.set('token', token, { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 7 })
    return res
  } catch (err) {
    console.error('Auth login error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
