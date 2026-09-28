import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../../lib/session'
import { getClient, query } from '../../../../lib/db'
import { logAudit } from '../../../../lib/audit'

export async function PATCH(req: Request, context: { params: Promise<{ leaveBalId: string }> }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (session.role !== 'Admin' && !session.restaurant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { leaveBalId } = await context.params
    const body = await req.json().catch(() => ({}))
    const { total_leave } = body
    if (!leaveBalId || total_leave == null) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    try {
      const { rows } = await query(`update employee_leave_balances set total_leave = $1, updated_at = now() where leave_bal_id = $2 returning *`, [Number(total_leave), Number(leaveBalId)])
      if (!rows || rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const updated = rows[0]
      await logAudit({ user_id: session.user_id, restaurant: session.restaurant, action: 'update_employee_leave_balance', table_name: 'employee_leave_balances', record_id: String(leaveBalId), new_data: updated })
      return NextResponse.json({ success: true, balance: updated })
    } catch (error: any) {
      const msg = String(error?.message || error)
      if (msg.includes('total') || msg.toLowerCase().includes('cannot') || msg.includes('Insufficient')) {
        return NextResponse.json({ error: 'Total leave cannot be lower than leave already used or invalid' }, { status: 400 })
      }
      throw error
    }
  } catch (err) {
    console.error('employee_leave_balances PATCH error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ leaveBalId: string }> }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (session.role !== 'Admin' && !session.restaurant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { leaveBalId } = await context.params
    if (!leaveBalId) return NextResponse.json({ error: 'Missing leaveBalId' }, { status: 400 })

    const client = await getClient()
    try {
      await client.query('BEGIN')
      const { rows: existingRows } = await client.query(`select * from employee_leave_balances where leave_bal_id = $1 for update`, [Number(leaveBalId)])
      const existing = existingRows[0]
      if (!existing) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }

      const { rows: reqRows } = await client.query(`select 1 from leave_requests where employee_id = $1 and leave_type_id = $2 limit 1`, [existing.employee_id, existing.leave_type_id])
      if (reqRows && reqRows.length > 0) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Cannot remove assignment with existing leave requests' }, { status: 400 })
      }

      const { rows: deletedRows } = await client.query(`delete from employee_leave_balances where leave_bal_id = $1 returning *`, [Number(leaveBalId)])
      await client.query('COMMIT')

      const deleted = deletedRows[0]
      await logAudit({ user_id: session.user_id, restaurant: session.restaurant, action: 'delete_employee_leave_balance', table_name: 'employee_leave_balances', record_id: String(leaveBalId), old_data: deleted })
      return NextResponse.json({ success: true })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('employee_leave_balances DELETE error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
