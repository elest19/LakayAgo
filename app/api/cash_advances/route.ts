import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../lib/session'
import { logAudit } from '../../../lib/audit'
import { query } from '../../../lib/db'

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
    approved_by: row.approved_by != null ? Number(row.approved_by) : null,
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

export async function GET(req: Request) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
      left join employees ap on ap.employee_id = ca.approved_by
      left join cash_advance_payments cap on cap.cash_advances_id = ca.cash_advances_id
      left join report_periods rp on rp.report_period_id = cap.report_period_id
      group by
        ca.cash_advances_id,
        e.name,
        ap.name
      order by ca.date_requested desc, ca.cash_advances_id desc
    `)

    return NextResponse.json({ cash_advances: rows.map(normalizeCashAdvance) })
  } catch (error) {
    console.error('cash_advances GET failed', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const employeeId = Number(body.employee_id)
    const amount = Number(body.amount)
    const dateRequested = body.date_requested
    const restaurant = body.restaurant || session.restaurant || 'Both'

    if (!employeeId || !dateRequested || Number.isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Employee, amount, and requested date are required' }, { status: 400 })
    }

    const text = `
      insert into cash_advances (
        employee_id,
        restaurant,
        amount,
        date_requested,
        remarks,
        balance_remaining,
        status,
        is_fully_paid
      ) values ($1, $2, $3, $4, $5, $3, 'pending', false)
      returning *
    `

    const { rows } = await query(text, [employeeId, restaurant, amount, dateRequested, body.remarks ?? null])
    const created = rows[0]

    logAudit({
      user_id: session.user_id,
      restaurant,
      action: 'create_cash_advance',
      table_name: 'cash_advances',
      record_id: String(created.cash_advances_id),
      new_data: created,
    })

    return NextResponse.json({ cash_advance: normalizeCashAdvance(created) })
  } catch (error) {
    console.error('cash_advances POST failed', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
