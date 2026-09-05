import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../../lib/session'
import { logAudit } from '../../../../lib/audit'
import { query } from '../../../../lib/db'
import { mapEmployee } from '../../../../lib/mapEmployee'

export async function GET(req: Request, context: any) {
  const { params } = context as any
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { employeeId } = await params
    const { rows } = await query('select employee_id, source_employee_id, name, department, pay_per_day, status, restaurant, contact_number, sss, philhealth, pagibig, month_pay_13th from employees where employee_id = $1 limit 1', [Number(employeeId)])
    const emp = rows[0]
    if (!emp) return NextResponse.json({ employee: null })

    if (session.role !== 'SuperAdmin' && emp.restaurant !== session.restaurant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ employee: mapEmployee(emp) })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(req: Request, context: any) {
  const { params } = context as any
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { employeeId } = await params
    const body = await req.json()

    // Map frontend camelCase fields to DB snake_case columns
    const fieldMap: Record<string, string> = {
      source_employee_id: 'source_employee_id',
      name: 'name',
      department: 'department',
      pay_per_day: 'pay_per_day',
      status: 'status',
      email: 'email',
      contactNumber: 'contact_number',
      sss: 'sss',
      philhealth: 'philhealth',
      pagibig: 'pagibig',
      restaurant: 'restaurant',
      month_pay_13th: 'month_pay_13th',
    }
    const allowed: Record<string, any> = {}
    for (const [frontKey, dbCol] of Object.entries(fieldMap)) {
      if (frontKey in body) allowed[dbCol] = body[frontKey]
    }
    if (Object.keys(allowed).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

    if (allowed.status) {
      allowed.status = String(allowed.status).trim().toLowerCase() === 'inactive'
        ? 'inactive'
        : String(allowed.status).trim().toLowerCase() === 'fired'
          ? 'fired'
          : 'active'
    }

    const { rows: existingRows } = await query('select * from employees where employee_id = $1 limit 1', [Number(employeeId)])
    const emp = existingRows[0]
    if (!emp) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (session.role !== 'SuperAdmin' && emp.restaurant !== session.restaurant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const nextStatus = allowed.status ?? emp.status
    if (String(nextStatus ?? '').trim().toLowerCase() === 'active') {
      const { rows: duplicateRows } = await query(
        'select employee_id from employees where employee_id != $1 and source_employee_id = $2 and restaurant = $3 and lower(status) = $4 limit 1',
        [Number(employeeId), allowed.source_employee_id ?? emp.source_employee_id, allowed.restaurant ?? emp.restaurant, 'active'],
      )
      if (duplicateRows.length > 0) {
        return NextResponse.json({ error: `An active employee with ID ${allowed.source_employee_id ?? emp.source_employee_id} already exists for ${allowed.restaurant ?? emp.restaurant}.` }, { status: 409 })
      }
    }

    const sets = [] as string[]
    const queryParams: any[] = []
    let idx = 1
    for (const col of Object.keys(allowed)) {
      queryParams.push(allowed[col])
      sets.push(`${col} = $${idx}`)
      idx++
    }
    queryParams.push(Number(employeeId))
    const updText = `update employees set ${sets.join(', ')}, updated_at = now() where employee_id = $${idx} returning *`
    const { rows: updatedRows } = await query(updText, queryParams)
    const updated = updatedRows[0]

    logAudit({ user_id: session.user_id, restaurant: emp.restaurant, action: 'update_employee', table_name: 'employees', record_id: String(employeeId), old_data: emp, new_data: updated })

    return NextResponse.json({ employee: mapEmployee(updated) })
  } catch (err) {
    console.error('PUT /api/employees/[id] error:', err) 
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}