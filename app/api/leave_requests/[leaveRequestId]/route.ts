import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../../lib/session'
import { getClient, query } from '../../../../lib/db'

function normalizeStatus(value: unknown) {
  if (value === 'Approve' || value === 'Approved') return 'Approved'
  if (value === 'Reject' || value === 'Rejected') return 'Rejected'
  return value
}

export async function PATCH(req: Request, context: { params: Promise<{ leaveRequestId: string }> | { leaveRequestId: string } }) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { leaveRequestId } = await Promise.resolve(context.params)
    const body = await req.json().catch(() => ({}))
    const incomingStatus = body.status ?? body.action ?? null
    const normalizedStatus = normalizeStatus(incomingStatus)

    if (!leaveRequestId || !['Approved', 'Rejected'].includes(String(normalizedStatus || ''))) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')

      const { rows: requestRows } = await client.query(
        `select leave_request_id, employee_id, leave_type_id, leave_type_name, restaurant, status, days, employee_name
         from leave_requests where leave_request_id = $1 for update`,
        [Number(leaveRequestId)]
      )

      const leaveRequest = requestRows[0]
      if (!leaveRequest) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Leave request not found' }, { status: 404 })
      }

      if (session.role !== 'SuperAdmin' && session.restaurant && session.restaurant !== 'Both' && leaveRequest.restaurant !== session.restaurant) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const finalStatus = String(normalizedStatus)
      let balanceUpdate: any = null

      if (finalStatus === 'Approved' && leaveRequest.status !== 'Approved') {
        const maybeLeaveTypeId = leaveRequest.leave_type_id
        const maybeBalanceRow = maybeLeaveTypeId
          ? await client.query(
              `select * from employee_leave_balances where employee_id = $1 and leave_type_id = $2 limit 1`,
              [Number(leaveRequest.employee_id), Number(maybeLeaveTypeId)]
            )
          : { rows: [] }

        if (maybeBalanceRow.rows[0]) {
          const available = Number(maybeBalanceRow.rows[0].available_leave ?? 0)
          const days = Number(leaveRequest.days ?? 0)
          const nextAvailable = Math.max(0, available - days)

          const { rows: updatedBalRows } = await client.query(
            `update employee_leave_balances
             set available_leave = $1, updated_at = now()
             where leave_bal_id = $2
             returning *`,
            [nextAvailable, maybeBalanceRow.rows[0].leave_bal_id]
          )

          balanceUpdate = updatedBalRows[0]
        }
      }

      const { rows: updatedRequestRows } = await client.query(
        `update leave_requests
         set status = $1, updated_at = now()
         where leave_request_id = $2
         returning leave_request_id, employee_id, employee_name, restaurant, leave_type_name, status, days, reason, start_date, end_date`,
        [finalStatus, Number(leaveRequestId)]
      )

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        leaveRequest: updatedRequestRows[0] || leaveRequest,
        balance: balanceUpdate,
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('Leave request update error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
