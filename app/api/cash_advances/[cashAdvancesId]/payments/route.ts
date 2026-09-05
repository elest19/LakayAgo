import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../../../lib/session'
import { query } from '../../../../../lib/db'
import { logAudit } from '../../../../../lib/audit'

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

async function fetchCashAdvanceById(cashAdvancesId: number) {
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
    where ca.cash_advances_id = $1
    group by
      ca.cash_advances_id,
      e.name,
      ap.name
  `, [cashAdvancesId])

  return rows[0] ? normalizeCashAdvance(rows[0]) : null
}

export async function POST(req: Request, context: { params: Promise<{ cashAdvancesId: string }> | { cashAdvancesId: string } }) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const params = await Promise.resolve(context.params)
    const cashAdvancesId = Number(params.cashAdvancesId)
    const body = await req.json()
    const amountDeducted = Number(body.amount_deducted)
    const reportPeriodId = body.report_period_id != null ? Number(body.report_period_id) : null

    if (!cashAdvancesId || Number.isNaN(cashAdvancesId) || Number.isNaN(amountDeducted) || amountDeducted <= 0) {
      return NextResponse.json({ error: 'Valid cash advance and amount are required' }, { status: 400 })
    }

    const { rows: caRows } = await query('select cash_advances_id, amount, balance_remaining, is_fully_paid from cash_advances where cash_advances_id = $1 limit 1', [cashAdvancesId])
    const ca = caRows[0]
    if (!ca) return NextResponse.json({ error: 'Cash advance not found' }, { status: 404 })

    const remaining = Number(ca.balance_remaining ?? ca.amount ?? 0)
    if (amountDeducted > remaining) {
      return NextResponse.json({ error: 'Deduction exceeds remaining balance', remaining_balance: remaining }, { status: 400 })
    }

    const { rows } = await query(`
      insert into cash_advance_payments (cash_advances_id, report_period_id, amount_deducted)
      values ($1, $2, $3)
      returning *
    `, [cashAdvancesId, reportPeriodId, amountDeducted])

    const payment = rows[0]

    logAudit({
      user_id: session.user_id,
      restaurant: session.restaurant || 'Both',
      action: 'create_cash_advance_payment',
      table_name: 'cash_advance_payments',
      record_id: String(payment.cash_advance_payments_id),
      new_data: payment,
    })

    try {
      const { rows: refreshed } = await query('select balance_remaining, is_fully_paid, status from cash_advances where cash_advances_id = $1 limit 1', [cashAdvancesId])
      const refreshedRow = refreshed[0]
      if (refreshedRow && refreshedRow.is_fully_paid && refreshedRow.status !== 'deducted') {
        await query("update cash_advances set status = 'deducted', updated_at = now() where cash_advances_id = $1", [cashAdvancesId])
      }
    } catch (e) {
      console.error('Failed to refresh cash advance status after payment', e)
    }

    const cashAdvance = await fetchCashAdvanceById(cashAdvancesId)

    return NextResponse.json({ payment, cash_advance: cashAdvance })
  } catch (error) {
    console.error('cash_advance payment POST failed', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
