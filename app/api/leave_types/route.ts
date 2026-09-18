import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../lib/session'
import { query } from '../../../lib/db'
import { logAudit } from '../../../lib/audit'

const ALLOWED_RESTAURANTS = ['Lakay Ago', 'Aroo', 'Both']

export async function GET(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const qRestaurant = url.searchParams.get('restaurant')
    // Archived leave types are hidden by default; the Leave List tab opts in with
    // ?includeArchived=true so it can offer an Active/Archived filter.
    const includeArchived = url.searchParams.get('includeArchived') === 'true'

    const ALL_RESTAURANTS = ['Lakay Ago', 'Aroo']
    const params: any[] = []
    const conditions: string[] = []
    let text = `select leave_type_id, name, coalesce(leave_number,0) as leave_number, restaurant, coalesce(is_paid, false) as is_paid, coalesce(is_archived, false) as is_archived from leave_types`

    if (session.role === 'SuperAdmin') {
      if (qRestaurant) {
        params.push(qRestaurant)
        conditions.push(`restaurant = $${params.length}`)
      }
    } else {
      const allowed = session.restaurant === 'Both' ? ALL_RESTAURANTS : session.restaurant ? [session.restaurant] : []
      if (allowed.length === 0) return NextResponse.json({ leaveTypes: [] })
      params.push(allowed)
      conditions.push(`restaurant = ANY($${params.length})`)
    }

    if (!includeArchived) conditions.push('coalesce(is_archived, false) = false')
    if (conditions.length > 0) text += ` where ${conditions.join(' and ')}`

    text += ' order by name'
    const { rows } = await query(text, params)
    return NextResponse.json({ leaveTypes: rows })
  } catch (err) {
    console.error('leave_types GET error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'SuperAdmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { name, leave_number, restaurant, is_paid } = body
    if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 })
    const restaurantValue = restaurant || session.restaurant || 'Both'

    const res = await query(
      `insert into leave_types(name, leave_number, restaurant, is_paid, created_at) values($1,$2,$3,$4, now()) returning *`,
      [name, Number(leave_number || 0), restaurantValue, Boolean(is_paid)]
    )
    return NextResponse.json(res.rows[0], { status: 201 })
  } catch (err) {
    console.error('leave_types POST error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'SuperAdmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { leave_type_id, name, leave_number, restaurant, is_paid, is_archived } = body
    if (!leave_type_id) return NextResponse.json({ error: 'Missing leave_type_id' }, { status: 400 })

    const fields: string[] = []
    const params: any[] = []
    if (name) { params.push(String(name).trim()); fields.push(`name = $${params.length}`) }
    if (leave_number != null) { params.push(Number(leave_number)); fields.push(`leave_number = $${params.length}`) }
    if (is_paid !== undefined) { params.push(Boolean(is_paid)); fields.push(`is_paid = $${params.length}`) }
    if (restaurant !== undefined) {
      const value = String(restaurant || '').trim()
      if (!ALLOWED_RESTAURANTS.includes(value)) {
        return NextResponse.json({ error: 'Invalid restaurant' }, { status: 400 })
      }
      params.push(value)
      fields.push(`restaurant = $${params.length}`)
    }
    if (is_archived !== undefined) { params.push(Boolean(is_archived)); fields.push(`is_archived = $${params.length}`) }
    if (fields.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

    params.push(leave_type_id)
    // NOTE: leave_types has no updated_at column in the schema, so only the
    // explicitly supplied fields are written here.
    const text = `update leave_types set ${fields.join(', ')} where leave_type_id = $${params.length} returning leave_type_id, name, coalesce(leave_number,0) as leave_number, restaurant, coalesce(is_paid, false) as is_paid, coalesce(is_archived, false) as is_archived`
    const { rows } = await query(text, params)
    if (!rows || rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(rows[0])
  } catch (err) {
    console.error('leave_types PATCH error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'SuperAdmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const url = new URL(req.url)
    const rawId = url.searchParams.get('leave_type_id') ?? url.searchParams.get('id')
    const leaveTypeId = Number(rawId)
    if (!Number.isFinite(leaveTypeId) || leaveTypeId <= 0) {
      return NextResponse.json({ error: 'Missing leave_type_id' }, { status: 400 })
    }

    const existingResult = await query('select * from leave_types where leave_type_id = $1 limit 1', [leaveTypeId])
    const existing = existingResult.rows[0]
    if (!existing) return NextResponse.json({ error: 'Leave type not found' }, { status: 404 })

    // employee_leave_balances cascades, leave_requests.leave_type_id is set to null.
    const deletedResult = await query('delete from leave_types where leave_type_id = $1 returning *', [leaveTypeId])
    const deleted = deletedResult.rows[0]

    await logAudit({
      user_id: session.user_id,
      restaurant: deleted?.restaurant || existing.restaurant,
      action: 'delete_leave_type',
      table_name: 'leave_types',
      record_id: String(leaveTypeId),
      old_data: existing,
      new_data: null,
    })

    return NextResponse.json({ ok: true, leaveType: deleted })
  } catch (err) {
    console.error('leave_types DELETE error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
