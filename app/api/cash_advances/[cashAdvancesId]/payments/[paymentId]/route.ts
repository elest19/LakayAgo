import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../../../../lib/session'
import { query } from '../../../../../../lib/db'
import { logAudit } from '../../../../../../lib/audit'

export async function DELETE(req: Request, context: { params: Promise<{ cashAdvancesId: string; paymentId: string }> }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { cashAdvancesId: rawCashAdvancesId, paymentId: rawPaymentId } = await context.params
    const cashAdvancesId = Number(rawCashAdvancesId)
    const paymentId = Number(rawPaymentId)

    if (!cashAdvancesId || Number.isNaN(cashAdvancesId) || !paymentId || Number.isNaN(paymentId)) {
      return NextResponse.json({ error: 'Invalid cash advance or payment id' }, { status: 400 })
    }

    // Verify the payment belongs to the cash advance
    const { rows: paymentRows } = await query(
      'select cash_advance_payments_id, cash_advances_id, amount_deducted from cash_advance_payments where cash_advance_payments_id = $1 and cash_advances_id = $2 limit 1',
      [paymentId, cashAdvancesId]
    )

    if (paymentRows.length === 0) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    const payment = paymentRows[0]

    // Delete the payment
    const { rows } = await query('delete from cash_advance_payments where cash_advance_payments_id = $1 returning *', [paymentId])

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    logAudit({
      user_id: session.user_id,
      restaurant: session.restaurant || 'Both',
      action: 'delete_cash_advance_payment',
      table_name: 'cash_advance_payments',
      record_id: String(paymentId),
      old_data: payment,
    })

    // Refresh cash advance status after deletion
    try {
      const { rows: refreshed } = await query('select balance_remaining, is_fully_paid, status from cash_advances where cash_advances_id = $1 limit 1', [cashAdvancesId])
      const refreshedRow = refreshed[0]
      if (refreshedRow && !refreshedRow.is_fully_paid && refreshedRow.status === 'deducted') {
        await query("update cash_advances set status = 'approved', updated_at = now() where cash_advances_id = $1", [cashAdvancesId])
      }
    } catch (e) {
      console.error('Failed to refresh cash advance status after payment deletion', e)
    }

    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error('cash_advance payment DELETE failed', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}