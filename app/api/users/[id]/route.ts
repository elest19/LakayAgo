import { NextResponse } from 'next/server'
import { hashPassword } from 'better-auth/crypto'
import { query } from '../../../../lib/db'
import getSessionFromRequest from '../../../../lib/session'

export async function PUT(req: Request, { params }: { params: any }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'SuperAdmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { name, username, email, password, role, restaurant, is_archived } = body || {}
    const { id: userId } = await params

    const updates: string[] = ['updated_at = now()']
    const values: any[] = []

    if (name !== undefined) {
      updates.push(`name = $${values.length + 1}`)
      values.push(name)
    }
    if (username !== undefined) {
      updates.push(`username = $${values.length + 1}`)
      values.push(username)
    }
    if (email !== undefined) {
      updates.push(`email = $${values.length + 1}`)
      values.push(email)
    }
    if (role !== undefined) {
      updates.push(`role = $${values.length + 1}`)
      values.push(role === 'Super Admin' ? 'SuperAdmin' : role)
    }
    if (restaurant !== undefined) {
      updates.push(`restaurant = $${values.length + 1}`)
      values.push(restaurant || 'Both')
    }
    if (is_archived !== undefined) {
      updates.push(`is_archived = $${values.length + 1}`)
      values.push(Boolean(is_archived))
    }

    if (updates.length === 1) {
      return NextResponse.json({ error: 'No update fields provided' }, { status: 400 })
    }

    const queryText = `UPDATE users SET ${updates.join(', ')} WHERE user_id = $${values.length + 1} RETURNING user_id, name, username, email, role, restaurant, is_archived`
    const res = await query(queryText, [...values, userId])

    const updated = res.rows[0] ?? null
    if (!updated) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const trimmedPassword = typeof password === 'string' ? password.trim() : ''
    if (trimmedPassword) {
      const hashedPassword = await hashPassword(trimmedPassword)
      await query(
        'UPDATE account SET password = $1, updated_at = now() WHERE user_id = $2 AND provider_id = $3',
        [hashedPassword, userId, 'credential']
      )
    }

    return NextResponse.json({
      user_id: updated.user_id,
      name: updated.name,
      username: updated.username,
      email: updated.email,
      role: updated.role,
      restaurant: updated.restaurant,
      is_archived: Boolean(updated.is_archived),
    })
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
