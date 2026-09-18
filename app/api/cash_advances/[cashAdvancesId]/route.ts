import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../../lib/session'
import { query, getClient } from '../../../../lib/db'
import { logAudit } from '../../../../lib/audit'

function normalizeCashAdvance(row: any) {
  const payments = Array.isArray(row.payments) ? row.payments : []

  return {
    cash_advances_id: String(row.cash_advances_id),
    employee_id: row.employee_id != null ? Number(row.employee_id) : null,
    employee_name: row.employee_name ?? 'Unknown Employee',
    restaurant: row.restaurant ?? 'Both',
    amount: Number(row.amount ?? 0),
    date_requested: row.date_requested ? String(row.date_requested).slice(0, 10) : null,
    date_released: row.date_released ? String(row.date_released).slice(0, 10) : null,
    status: row.status ?? 'pending',
    approved_by: row.approved_by ?? null,
    approved_name: row.approved_name ?? null,
    remarks: row.remarks ?? '',
    balance_remaining: Number(row.balance_remaining ?? 0),
    is_fully_paid: Boolean(row.is_fully_paid),
    created_at: row.created_at,
    updated_at: row.updated_at,
    payments: payments.map((payment: any) => ({
      cash_advance_payments_id: String(payment.cash_advance_payments_id),
      report_period_id: payment.report_period_id != null ? Number(payment.report_period_id) : null,
      report_period_label: payment.report_period_label ?? 'Selected period',
      amount_deducted: Number(payment.amount_deducted ?? 0),
      created_at: payment.created_at,
    })),
  }
}

async function fetchCashAdvanceById(cashAdvancesId: string) {
  const { rows } = await query(`
    select
      ca.cash_advances_id,
      ca.employee_id,
      e.name as employee_name,
      ca.restaurant,
      ca.amount,
      to_char(ca.date_requested, 'YYYY-MM-DD') as date_requested,
      to_char(ca.date_released, 'YYYY-MM-DD') as date_released,
      ca.status,
      ca.approved_by,
      ap.name as approved_name,
      ca.remarks,
      ca.balance_remaining,
      ca.is_fully_paid,
      ca.created_at,
      ca.updated_at,
      coalesce(
        json_agg(
          json_build_object(
            'cash_advance_payments_id', cap.cash_advance_payments_id,
            'report_period_id', cap.report_period_id,
            'report_period_label', concat(
              to_char(rp.period_start, 'YYYY-MM-DD'),
              ' to ',
              to_char(rp.period_end, 'YYYY-MM-DD')
            ),
            'amount_deducted', cap.amount_deducted,
            'created_at', cap.created_at
          )
        ) filter (where cap.cash_advance_payments_id is not null),
        '[]'::json
      ) as payments
    from cash_advances ca
    left join employees e on e.employee_id = ca.employee_id
    left join users ap on ap.user_id = ca.approved_by
    left join cash_advance_payments cap on cap.cash_advances_id = ca.cash_advances_id
    left join report_periods rp on rp.report_period_id = cap.report_period_id
    where ca.cash_advances_id = $1
    group by
      ca.cash_advances_id,
      e.name,
      ap.name
  `, [Number(cashAdvancesId)])

  return rows[0] ? normalizeCashAdvance(rows[0]) : null
}

export async function GET(_req: Request, context: { params: Promise<{ cashAdvancesId: string }> }) {
  try {
    const session = await getSessionFromRequest(_req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { cashAdvancesId } = await context.params
    const record = await fetchCashAdvanceById(cashAdvancesId)
    if (!record) return NextResponse.json({ error: 'Cash advance not found' }, { status: 404 })

    return NextResponse.json({ cash_advance: record })
  } catch (error) {
    console.error('cash_advance GET failed', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

async function resolveApproverUserId(session: any, body: any): Promise<string | null> {
  const explicitValue = body.approved_by
  if (explicitValue !== undefined && explicitValue !== null && explicitValue !== '') {
    const candidate = String(explicitValue).trim()
    if (candidate.length > 0) {
      return candidate
    }
  }

  return session?.user_id ?? null
}

export async function PATCH(req: Request, context: { params: Promise<{ cashAdvancesId: string }> }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { cashAdvancesId: rawCashAdvancesId } = await context.params
    const body = await req.json()
    const cashAdvancesId = Number(rawCashAdvancesId)

    if (!cashAdvancesId || Number.isNaN(cashAdvancesId)) {
      return NextResponse.json({ error: 'Invalid cash advance id' }, { status: 400 })
    }

    // Fetch current record to check current status and enforce transition rules
    const { rows: currentRows } = await query('select status from cash_advances where cash_advances_id = $1', [cashAdvancesId])
    if (currentRows.length === 0) {
      return NextResponse.json({ error: 'Cash advance not found' }, { status: 404 })
    }
    const currentStatus = currentRows[0].status
    const nextStatus = body.status ?? currentStatus

    // Enforce status transition rules
    if (body.status !== undefined && body.status !== currentStatus) {
      if (currentStatus === 'approved' && nextStatus !== 'released') {
        return NextResponse.json({ error: 'Approved advances can only be changed to Released' }, { status: 400 })
      }
      if (currentStatus === 'cancelled' || currentStatus === 'rejected' || currentStatus === 'released') {
        return NextResponse.json({ error: 'This advance status cannot be changed' }, { status: 400 })
      }
    }

    const updates: string[] = []
    const values: any[] = []

    if (body.status !== undefined) {
      updates.push(`status = $${values.length + 1}`)
      values.push(String(body.status))
    }

    if (body.remarks !== undefined) {
      updates.push(`remarks = $${values.length + 1}`)
      values.push(body.remarks ?? null)
    }

    // Auto-set approved_by when status changes to 'approved'
    if (body.approved_by !== undefined) {
      updates.push(`approved_by = $${values.length + 1}`)
      values.push(body.approved_by != null ? String(body.approved_by) : null)
    } else if (String(body.status ?? '').toLowerCase() === 'approved') {
      if (session?.user_id != null) {
        updates.push(`approved_by = $${values.length + 1}`)
        values.push(String(session.user_id))
      }
    }

    if (body.date_released !== undefined) {
      updates.push(`date_released = $${values.length + 1}`)
      values.push(body.date_released || null)
    } else if (body.status === 'released') {
      updates.push(`date_released = $${values.length + 1}`)
      values.push(new Date().toISOString().slice(0, 10))
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    values.push(cashAdvancesId)
    const text = `update cash_advances set ${updates.join(', ')} where cash_advances_id = $${values.length} returning *`

    const { rows } = await query(text, values)
    const updated = rows[0]

    logAudit({
      user_id: session.user_id,
      restaurant: updated.restaurant,
      action: 'update_cash_advance',
      table_name: 'cash_advances',
      record_id: String(updated.cash_advances_id),
      new_data: updated,
    })

    return NextResponse.json({ cash_advance: normalizeCashAdvance(updated) })
  } catch (error) {
    console.error('cash_advance PATCH failed', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ cashAdvancesId: string }> }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { cashAdvancesId: rawCashAdvancesId } = await context.params
    const cashAdvancesId = Number(rawCashAdvancesId)

    // Use transaction to delete payments and the cash advance
    const client = await getClient()
    try {
      await client.query('begin')

      // Delete all associated payments first
      await client.query('delete from cash_advance_payments where cash_advances_id = $1', [cashAdvancesId])

      // Then delete the cash advance
      const { rows } = await client.query('delete from cash_advances where cash_advances_id = $1 returning *', [cashAdvancesId])

      if (rows.length === 0) {
        await client.query('rollback')
        return NextResponse.json({ error: 'Cash advance not found' }, { status: 404 })
      }

      await client.query('commit')

      logAudit({
        user_id: session.user_id,
        restaurant: rows[0].restaurant,
        action: 'delete_cash_advance',
        table_name: 'cash_advances',
        record_id: String(rows[0].cash_advances_id),
        old_data: rows[0],
      })

      return NextResponse.json({ deleted: true })
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('cash_advance DELETE failed', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
