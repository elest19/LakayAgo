import { NextResponse } from 'next/server'
import { query } from '../../../../lib/db'
import getSessionFromRequest from '../../../../lib/session'

export async function PUT(req: Request, { params }: { params: any }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'SuperAdmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { name, username, email, password, role, restaurant } = body || {}
    const { id: userId } = await params

    // update users table fields
    const dbRole = role === 'Super Admin' ? 'SuperAdmin' : role
    const res = await query(
      'UPDATE users SET name = $1, username = $2, email = $3, role = $4, restaurant = $5, updated_at = now() WHERE user_id = $6 RETURNING user_id, name, username, email, role, restaurant',
      [name, username, email, dbRole, restaurant || 'Both', userId]
    )

    const updated = res.rows[0] ?? null
    if (!updated) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    return NextResponse.json({ user_id: updated.user_id, name: updated.name, username: updated.username, email: updated.email, role: updated.role, restaurant: updated.restaurant })
  } catch (err) {
    console.error('Update user error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: any }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'SuperAdmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id: userId } = await params
    await query('DELETE FROM users WHERE user_id = $1', [userId])
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Delete user error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
