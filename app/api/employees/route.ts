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

const normalizeEmployeeStatus = (status?: unknown) => String(status ?? '').trim().toLowerCase()

const normalizeDbEmployeeStatus = (status?: unknown) => {
  const normalized = normalizeEmployeeStatus(status)
  if (normalized === 'active' || normalized === 'on leave' || normalized === 'on_leave') return 'active'
  if (normalized === 'inactive') return 'inactive'
  if (normalized === 'fired') return 'fired'
  return 'active'
}

export async function POST(req: Request) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { source_employee_id, name, department, pay_per_day, restaurant, contactNumber, sss, philhealth, pagibig, month_pay_13th, status } = body
    if (!source_employee_id || !name) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    const restaurantValue = restaurant || session.restaurant || 'Both'
    const normalizedStatus = normalizeDbEmployeeStatus(status)

    const duplicateRows = await query(
      `select employee_id from employees where source_employee_id = $1 and restaurant = $2 and lower(status) = 'active' limit 1`,
      [Number(source_employee_id), restaurantValue],
    )

    if (duplicateRows.rows.length > 0) {
      return NextResponse.json({ error: `An active employee with ID ${source_employee_id} already exists for ${restaurantValue}.` }, { status: 409 })
    }

    const text = `insert into employees(source_employee_id, name, department, pay_per_day, restaurant, status, contact_number, sss, philhealth, pagibig, month_pay_13th)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`
    const { rows } = await query(text, [Number(source_employee_id), name, department ?? null, pay_per_day ?? null, restaurantValue, normalizedStatus, contactNumber ?? null, sss ?? null, philhealth ?? null, pagibig ?? null, month_pay_13th ?? null])
    const created = rows[0]
    logAudit({ user_id: session.user_id, restaurant: restaurantValue, action: 'create_employee', table_name: 'employees', record_id: String(created.employee_id), new_data: created })

    return NextResponse.json({ employee: mapEmployee(created) })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
