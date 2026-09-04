import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'
import getSessionFromRequest from '../../../lib/session'
import bcrypt from 'bcryptjs'

export async function GET(req: Request) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'SuperAdmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const res = await query('SELECT user_id, name, username, email, role, restaurant FROM users ORDER BY name')
    const users = await Promise.all(res.rows.map(async (u: any) => {
      const r = await query('SELECT restaurants_id FROM restaurants WHERE name = $1 LIMIT 1', [u.restaurant])
      return {
        user_id: u.user_id,
        name: u.name,
        username: u.username,
        email: u.email,
        role: u.role,
        restaurant: u.restaurant,
        restaurant_id: r.rows[0]?.restaurants_id ?? null,
        status: 'Active',
      }
    }))
    return NextResponse.json(users)
  } catch (err) {
    console.error('Users list error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'SuperAdmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { username, name, email, password, role, restaurant } = body || {}
    if (!username || !name || !email || !password || !role) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // normalize role values expected by DB (SuperAdmin vs "Super Admin")
    const dbRole = role === 'Super Admin' ? 'SuperAdmin' : role

    // check duplicates
    const exists = await query('SELECT 1 FROM users WHERE username = $1 OR email = $2 LIMIT 1', [username, email])
    if (exists.rowCount > 0) return NextResponse.json({ error: 'User with that username or email already exists' }, { status: 409 })

    const hashed = await bcrypt.hash(password, 10)

    const res = await query(
      `INSERT INTO users (restaurant, name, username, email, password, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING user_id, name, email, role, restaurant`,
      [restaurant || 'Both', name, username, email, hashed, dbRole]
    )

    const u = res.rows[0]
    const r = await query('SELECT restaurants_id FROM restaurants WHERE name = $1 LIMIT 1', [u.restaurant])
    return NextResponse.json({ user_id: u.user_id, name: u.name, email: u.email, role: u.role, restaurant: u.restaurant, restaurant_id: r.rows[0]?.restaurants_id ?? null })
  } catch (err) {
    console.error('Create user error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
