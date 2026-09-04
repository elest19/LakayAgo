import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../../../lib/session'
import { query } from '../../../../../lib/db'
import { logAudit } from '../../../../../lib/audit'

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

    // Validate against remaining balance to prevent over-deduction
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

    // Refresh cash advance status: if fully paid, mark as deducted
    try {
      const { rows: refreshed } = await query('select balance_remaining, is_fully_paid from cash_advances where cash_advances_id = $1 limit 1', [cashAdvancesId])
      const refreshedRow = refreshed[0]
      if (refreshedRow && refreshedRow.is_fully_paid) {
        await query("update cash_advances set status = 'deducted', updated_at = now() where cash_advances_id = $1", [cashAdvancesId])
      }
    } catch (e) {
      console.error('Failed to refresh cash advance status after payment', e)
    }

    return NextResponse.json({ payment })
  } catch (error) {
    console.error('cash_advance payment POST failed', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
