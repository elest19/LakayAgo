import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../lib/session'
import { query } from '../../../lib/db'

export async function GET(req: Request) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const qRestaurant = url.searchParams.get('restaurant')

    const ALL_RESTAURANTS = ['Lakay Ago', 'Aroo']
    const params: any[] = []
    let text = `select leave_type_id, name, coalesce(leave_number,0) as leave_number, restaurant, coalesce(is_paid, false) as is_paid from leave_types`

    if (session.role === 'SuperAdmin') {
      if (qRestaurant) {
        params.push(qRestaurant)
        text += ` where restaurant = $${params.length}`
      }
    } else {
      const allowed = session.restaurant === 'Both' ? ALL_RESTAURANTS : session.restaurant ? [session.restaurant] : []
      if (allowed.length === 0) return NextResponse.json({ leaveTypes: [] })
      params.push(allowed)
      text += ` where restaurant = ANY($${params.length})`
    }

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
    const session = getSessionFromRequest(req)
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
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'SuperAdmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { leave_type_id, name, leave_number, is_paid } = body
    if (!leave_type_id) return NextResponse.json({ error: 'Missing leave_type_id' }, { status: 400 })

    const fields: string[] = []
    const params: any[] = []
    if (name) { params.push(name); fields.push(`name = $${params.length}`) }
    if (leave_number != null) { params.push(Number(leave_number)); fields.push(`leave_number = $${params.length}`) }
    if (is_paid !== undefined) { params.push(Boolean(is_paid)); fields.push(`is_paid = $${params.length}`) }
    if (fields.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

    params.push(leave_type_id)
    const text = `update leave_types set ${fields.join(', ')}, updated_at = now() where leave_type_id = $${params.length} returning *`
    const { rows } = await query(text, params)
    if (!rows || rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(rows[0])
  } catch (err) {
    console.error('leave_types PATCH error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
