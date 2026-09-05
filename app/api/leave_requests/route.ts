import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../lib/session'
import { query } from '../../../lib/db'

const ALL_RESTAURANTS = ['Lakay Ago', 'Aroo']

export async function GET(req: Request) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const qRestaurant = url.searchParams.get('restaurant')

    const allowedRestaurants = session.role === 'SuperAdmin'
      ? (qRestaurant ? [qRestaurant] : (session.restaurant && session.restaurant !== 'Both' ? [session.restaurant] : ALL_RESTAURANTS))
      : (session.restaurant === 'Both' ? ALL_RESTAURANTS : session.restaurant ? [session.restaurant] : [])

    if (allowedRestaurants.length === 0) return NextResponse.json({ leaveRequests: [], employees: [] })

    const { rows: lrRows } = await query(
      `select leave_request_id, employee_id, employee_name, restaurant, leave_type_name,
              start_date::text as start_date, end_date::text as end_date, days, reason, status
      from leave_requests where restaurant = ANY($1) order by created_at desc`,
      [allowedRestaurants]
    )

    const leaveRequests = (lrRows || []).map((r: any) => ({
      id: r.leave_request_id,
      employeeId: r.employee_id,
      employeeName: r.employee_name,
      restaurant: r.restaurant,
      employeeRestaurant: r.restaurant,
      leaveType: r.leave_type_name,
      startDate: r.start_date || null,
      endDate: r.end_date || null,
      days: Number(r.days),
      reason: r.reason,
      status: r.status,
    }))

    const { rows: empRows } = await query(
    `select employee_id, source_employee_id, name, restaurant from employees where restaurant = ANY($1) order by name`,
    [allowedRestaurants]
    )
    const employees = (empRows || []).map((e: any) => {
      const parts = (e.name || '').split(' ')
      return {
        id: e.employee_id,
        sourceEmployeeId: e.source_employee_id != null ? String(e.source_employee_id) : null,
        firstName: parts[0] || '',
        lastName: parts.slice(1).join(' ') || '',
        restaurant: e.restaurant,
      }
    })

    return NextResponse.json({ leaveRequests, employees })
  } catch (err) {
    console.error('Leave requests error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { employee_id, leave_type_id, leave_type_name, start_date, end_date, days, reason, employee_name } = body

    if (!employee_id || !leave_type_name || !start_date || !end_date || !days) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const employeeRes = await query(
      `select restaurant from employees where employee_id = $1 limit 1`,
      [Number(employee_id)]
    )

    const restaurantValue = employeeRes.rows?.[0]?.restaurant || session.restaurant || 'Both'

    const { rows } = await query(
      `insert into leave_requests (
        employee_id, leave_type_id, employee_name, restaurant,
        leave_type_name, start_date, end_date, days, reason, status, created_at, updated_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Pending', now(), now()) returning leave_request_id`,
      [Number(employee_id), leave_type_id ? Number(leave_type_id) : null, employee_name || null, restaurantValue, leave_type_name, start_date, end_date, Number(days), reason || null]
    )

    return NextResponse.json({ leaveRequestId: rows[0].leave_request_id }, { status: 201 })
  } catch (err) {
    console.error('Leave request create error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

