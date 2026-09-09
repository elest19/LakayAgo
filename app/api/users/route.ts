import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'
import getSessionFromRequest from '../../../lib/session'
import { auth } from '../../../lib/auth'

export async function GET(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'SuperAdmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const res = await query('SELECT user_id, name, username, email, role, restaurant FROM users ORDER BY name')
    // The `restaurants` table may not exist in all deployments; avoid joining it here.
    const users = res.rows.map((u: any) => ({
      user_id: u.user_id,
      name: u.name,
      username: u.username,
      email: u.email,
      role: u.role,
      restaurant: u.restaurant,
      restaurant_id: null,
      status: 'Active',
    }))
    return NextResponse.json(users)
  } catch (err) {
    console.error('Users list error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'SuperAdmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { username, name, email, password, role, restaurant } = body || {}
    if (!username || !name || !email || !password || !role) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // normalize role values expected by DB (SuperAdmin vs "Super Admin")
    const dbRole = role === 'Super Admin' ? 'SuperAdmin' : role

    // Use Better Auth to create the user and credential atomically
    try {
      const signUp = await auth.api.signUpEmail({
        body: {
          name,
          email,
          password,
          username,
          role: dbRole,
          restaurant: restaurant || 'Both',
        },
        asResponse: false,
      })

      // signUp should return a user object. Map it back to the legacy response shape.
      const createdUser = signUp?.user ?? null
      if (!createdUser) return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })

      return NextResponse.json({ user_id: createdUser.id, name: createdUser.name, email: createdUser.email, role: createdUser.role, restaurant: createdUser.restaurant, restaurant_id: null })
    } catch (err: any) {
      console.error('Create user error (auth.signUpEmail)', err)
      const message = err?.body?.message || String(err)
      return NextResponse.json({ error: message }, { status: err?.statusCode || 500 })
    }
  } catch (err) {
    console.error('Create user error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
