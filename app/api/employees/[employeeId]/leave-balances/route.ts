import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../../../lib/session'
import { getClient, query } from '../../../../../lib/db'
import { logAudit } from '../../../../../lib/audit'

export async function GET(req: Request, context: { params: Promise<{ employeeId: string }> }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { employeeId } = await context.params
    if (!employeeId) return NextResponse.json({ error: 'Missing employeeId' }, { status: 400 })

    const params: any[] = [Number(employeeId)]
    // The balance columns are `numeric`, which node-postgres hands back as a string that keeps the
    // column scale ("105.0"). The cast sends plain numbers, so clients never have to trim a
    // trailing zero themselves.
    let text = `select elb.leave_bal_id, elb.employee_id, elb.leave_type_id, lt.name as leave_type_name, coalesce(lt.is_paid,false) as is_paid, coalesce(elb.total_leave,0)::float8 as total_leave, coalesce(elb.available_leave,0)::float8 as available_leave, (coalesce(elb.total_leave,0) - coalesce(elb.available_leave,0))::float8 as used, elb.restaurant
      from employee_leave_balances elb
      join leave_types lt on lt.leave_type_id = elb.leave_type_id
      where elb.employee_id = $1`

    // Restrict by restaurant for non-superadmins
    if (session.role !== 'Admin') {
      const allowed = session.restaurant === 'Both' ? ['Lakay Ago','Aroo'] : session.restaurant ? [session.restaurant] : []
      if (allowed.length === 0) return NextResponse.json({ balances: [] })
      params.push(allowed)
      text += ` and elb.restaurant = ANY($${params.length})`
    }

    const { rows } = await query(text + ' order by elb.leave_bal_id', params)
    return NextResponse.json({ balances: rows })
  } catch (err) {
    console.error('employee by id balances GET error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request, context: { params: Promise<{ employeeId: string }> }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (session.role !== 'Admin' && !session.restaurant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { employeeId } = await context.params
    const body = await req.json().catch(() => ({}))
    const { leave_type_id, total_leave } = body
    if (!employeeId || !leave_type_id || total_leave == null) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const client = await getClient()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query(
        `insert into employee_leave_balances (employee_id, leave_type_id, total_leave, available_leave, restaurant, created_at, updated_at)
         select $1::int, $2::int, $3::numeric, $3::numeric, coalesce(lt.restaurant,'Both'), now(), now()
         from leave_types lt where lt.leave_type_id = $2
         on conflict (employee_id, leave_type_id) do update set total_leave = excluded.total_leave, updated_at = now()
         returning *`,
        [Number(employeeId), Number(leave_type_id), Number(total_leave)]
      )

      const created = rows[0]
      await client.query('COMMIT')

      if (created) {
        await logAudit({ user_id: session.user_id, restaurant: session.restaurant, action: 'assign_leave_type', table_name: 'employee_leave_balances', record_id: String(created.leave_bal_id), new_data: created })
        return NextResponse.json({ success: true, balance: created })
      }
      return NextResponse.json({ success: true })
    } catch (error: any) {
      await client.query('ROLLBACK')
      const msg = String(error?.message || error)
      if (msg.includes("This leave type is not assigned") || msg.includes('not available') || msg.includes('Cannot assign an archived')) {
        return NextResponse.json({ error: msg }, { status: 400 })
      }
      throw error
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('employee assign leave POST error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
