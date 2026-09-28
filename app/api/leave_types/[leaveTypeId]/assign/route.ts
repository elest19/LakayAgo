import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../../../lib/session'
import { getClient, query } from '../../../../../lib/db'
import { logAudit } from '../../../../../lib/audit'

export async function GET(req: Request, context: { params: Promise<{ leaveTypeId: string }> }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { leaveTypeId } = await context.params
    if (!leaveTypeId) return NextResponse.json({ error: 'Missing leaveTypeId' }, { status: 400 })

    const params: any[] = [Number(leaveTypeId)]
    let text = `select elb.leave_bal_id, elb.employee_id, elb.leave_type_id, lt.name as leave_type_name, coalesce(elb.total_leave,0) as total_leave, coalesce(elb.available_leave,0) as available_leave, elb.restaurant
      from employee_leave_balances elb
      join leave_types lt on lt.leave_type_id = elb.leave_type_id
      where elb.leave_type_id = $1`

    if (session.role !== 'Admin') {
      const allowed = session.restaurant === 'Both' ? ['Lakay Ago','Aroo'] : session.restaurant ? [session.restaurant] : []
      if (allowed.length === 0) return NextResponse.json({ assignments: [] })
      params.push(allowed)
      text += ` and elb.restaurant = ANY($${params.length})`
    }

    const { rows } = await query(text + ' order by elb.employee_id', params)
    return NextResponse.json({ assignments: rows })
  } catch (err) {
    console.error('leave-type assignments GET error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// Bulk assign: body { employee_ids: number[], total_leave: number }
export async function POST(req: Request, context: { params: Promise<{ leaveTypeId: string }> }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'Admin' && !session.restaurant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { leaveTypeId } = await context.params
    const body = await req.json().catch(() => ({}))
    const { employee_ids, total_leave } = body
    if (!leaveTypeId || !Array.isArray(employee_ids) || employee_ids.length === 0 || total_leave == null) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const client = await getClient()
    try {
      await client.query('BEGIN')
      const results: any[] = []
      for (const eid of employee_ids) {
        const { rows } = await client.query(
          `insert into employee_leave_balances (employee_id, leave_type_id, total_leave, available_leave, restaurant, created_at, updated_at)
           select $1::int, $2::int, $3::numeric, $3::numeric, coalesce(lt.restaurant,'Both'), now(), now()
           from leave_types lt where lt.leave_type_id = $2
           on conflict (employee_id, leave_type_id) do update set total_leave = excluded.total_leave, updated_at = now()
           returning *`,
          [Number(eid), Number(leaveTypeId), Number(total_leave)]
        )
        if (rows && rows[0]) results.push(rows[0])
      }
      await client.query('COMMIT')

      await logAudit({ user_id: session.user_id, restaurant: session.restaurant, action: 'bulk_assign_leave_type', table_name: 'employee_leave_balances', record_id: String(leaveTypeId), new_data: { count: results.length } })
      return NextResponse.json({ success: true, assigned: results })
    } catch (error: any) {
      await client.query('ROLLBACK')
      const msg = String(error?.message || error)
      if (msg.includes('Cannot assign') || msg.includes('archived') || msg.includes('not available')) {
        return NextResponse.json({ error: msg }, { status: 400 })
      }
      throw error
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('leave-type bulk assign POST error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
