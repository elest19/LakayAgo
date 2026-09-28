import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../lib/session'
import { query } from '../../../lib/db'

export async function GET(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const qRestaurant = url.searchParams.get('restaurant')

    const ALL_RESTAURANTS = ['Lakay Ago', 'Aroo']
    const params: any[] = []
    // The balance columns are `numeric`, which node-postgres hands back as a string that keeps the
    // column scale ("105.0"). The cast sends plain numbers, so clients never have to trim a
    // trailing zero themselves.
    let text = `select elb.leave_bal_id, elb.employee_id, elb.leave_type_id, lt.name as leave_type_name, coalesce(lt.is_paid,false) as is_paid, coalesce(elb.total_leave,0)::float8 as total_leave, coalesce(elb.available_leave,0)::float8 as available_leave, (coalesce(elb.total_leave,0) - coalesce(elb.available_leave,0))::float8 as used
      from employee_leave_balances elb
      join leave_types lt on lt.leave_type_id = elb.leave_type_id`

    if (session.role === 'Admin') {
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
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const { leave_bal_id, total_leave } = body
    if (!leave_bal_id || total_leave == null) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    // Only admins may update balances
    if (session.role !== 'Admin' && !session.restaurant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Only allow editing total_leave via this endpoint. The DB trigger will adjust available_leave.
    try {
      const res = await query(`update employee_leave_balances set total_leave = $1, updated_at = now() where leave_bal_id = $2 returning *`, [Number(total_leave), Number(leave_bal_id)])
      if (!res.rows || res.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json(res.rows[0])
    } catch (err: any) {
      // If the DB check/trigger rejected the change (e.g., total < used), return friendly message
      const msg = String(err?.message || err)
      if (msg.toLowerCase().includes('total leave cannot') || msg.toLowerCase().includes('cannot') || msg.toLowerCase().includes('check')) {
        return NextResponse.json({ error: 'Total leave cannot be lower than leave already used' }, { status: 400 })
      }
      throw err
    }
  } catch (err) {
    console.error('employee_leave_balances PATCH error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
