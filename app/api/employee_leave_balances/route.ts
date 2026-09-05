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
    let text = `select elb.employee_id, elb.leave_type_id, lt.name as leave_type_name, coalesce(lt.leave_number,0) as leave_number, coalesce(elb.available_leave,0) as available_leave, (coalesce(lt.leave_number,0) - coalesce(elb.available_leave,0)) as used_leave
      from employee_leave_balances elb
      join leave_types lt on lt.leave_type_id = elb.leave_type_id`

    if (session.role === 'SuperAdmin') {
      if (qRestaurant) {
        params.push(qRestaurant)
        text += ` where elb.restaurant = $${params.length}`
      }
    } else {
      const allowed = session.restaurant === 'Both' ? ALL_RESTAURANTS : session.restaurant ? [session.restaurant] : []
      if (allowed.length === 0) return NextResponse.json({ balances: [] })
      params.push(allowed)
      text += ` where elb.restaurant = ANY($${params.length})`
    }

    text += ' order by elb.employee_id'
    const { rows } = await query(text, params)
    return NextResponse.json({ balances: rows })
  } catch (err) {
    console.error('employee_leave_balances GET error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// Update available_leave for a given employee + leave_type
export async function PATCH(req: Request) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const { employee_id, leave_type_id, available_leave } = body
    if (!employee_id || !leave_type_id || available_leave == null) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    // Only admins may update balances
    if (session.role !== 'SuperAdmin' && !session.restaurant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const res = await query(`update employee_leave_balances set available_leave = $1, updated_at = now() where employee_id = $2 and leave_type_id = $3 returning *`, [Number(available_leave), Number(employee_id), Number(leave_type_id)])
    if (!res.rows || res.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(res.rows[0])
  } catch (err) {
    console.error('employee_leave_balances PATCH error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
