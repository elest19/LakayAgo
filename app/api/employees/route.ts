import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../lib/session'
import { logAudit } from '../../../lib/audit'
import { query } from '../../../lib/db'
import { mapEmployee } from '../../../lib/mapEmployee'

export async function GET(req: Request) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const qRestaurant = url.searchParams.get('restaurant')

    let restaurantFilter = qRestaurant
    if (!restaurantFilter && session.restaurant && session.role === 'SuperAdmin') {
      restaurantFilter = null
    }

    let text = `select employee_id, source_employee_id, name, department, pay_per_day, status, restaurant, contact_number, sss, philhealth, pagibig, month_pay_13th from employees`
    const params: any[] = []
    if (restaurantFilter) {
      params.push(restaurantFilter)
      text += ` where restaurant = $${params.length}`
    }
    const { rows } = await query(text, params)
    const employees = rows.map(mapEmployee)
    return NextResponse.json({ employees })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { source_employee_id, name, department, pay_per_day, restaurant, contactNumber, sss, philhealth, pagibig, month_pay_13th } = body
    if (!source_employee_id || !name) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    const restaurantValue = restaurant || session.restaurant || 'Both'

    const text = `insert into employees(source_employee_id, name, department, pay_per_day, restaurant, contact_number, sss, philhealth, pagibig, month_pay_13th)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`
    const { rows } = await query(text, [Number(source_employee_id), name, department ?? null, pay_per_day ?? null, restaurantValue, contactNumber ?? null, sss ?? null, philhealth ?? null, pagibig ?? null, month_pay_13th ?? null])
    const created = rows[0]
    logAudit({ user_id: session.user_id, restaurant: restaurantValue, action: 'create_employee', table_name: 'employees', record_id: String(created.employee_id), new_data: created })

    return NextResponse.json({ employee: mapEmployee(created) })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
