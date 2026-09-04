import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../lib/session'
import { query } from '../../../lib/db'

export async function GET(req: Request) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const qRestaurant = url.searchParams.get('restaurant_id')

    let restaurantId = session.restaurant_id
    if (!restaurantId && session.role === 'SuperAdmin' && qRestaurant) {
      restaurantId = Number(qRestaurant) || null
    }

    if (!restaurantId) return NextResponse.json({ leaveRequests: [], employees: [] })

    const { rows: lrRows } = await query(
      `select leave_request_id, employee_id, employee_name, department, leave_type_name, start_date, end_date, days, reason, status
       from leave_requests where restaurant_id = $1 order by created_at desc`,
      [restaurantId]
    )

    const leaveRequests = (lrRows || []).map((r: any) => ({
      id: r.leave_request_id,
      employeeId: r.employee_id,
      employeeName: r.employee_name,
      department: r.department,
      leaveType: r.leave_type_name,
      startDate: r.start_date ? String(r.start_date) : null,
      endDate: r.end_date ? String(r.end_date) : null,
      days: Number(r.days),
      reason: r.reason,
      status: r.status,
    }))

    const { rows: empRows } = await query(
      `select employee_id, name, department from employees where restaurant_id = $1 order by name`,
      [restaurantId]
    )

    const employees = (empRows || []).map((e: any) => {
      const parts = (e.name || '').split(' ')
      return {
        id: e.employee_id,
        firstName: parts[0] || '',
        lastName: parts.slice(1).join(' ') || '',
        department: e.department,
      }
    })

    return NextResponse.json({ leaveRequests, employees })
  } catch (err) {
    console.error('Leave requests error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { leaveRequestId, status } = body
    if (!leaveRequestId || !['Approved', 'Rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    let restaurantId = session.restaurant_id
    if (!restaurantId) return NextResponse.json({ error: 'No restaurant context' }, { status: 403 })

    const { rows } = await query(
      `update leave_requests set status = $1, updated_at = now() where leave_request_id = $2 and restaurant_id = $3 returning leave_request_id`,
      [status, leaveRequestId, restaurantId]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Leave request update error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
