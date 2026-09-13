import { NextResponse } from 'next/server'
import { query, getClient } from '../../../../../lib/db'
import getSessionFromRequest from '../../../../../lib/session'
import { logAudit } from '../../../../../lib/audit'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const { amount } = body

    const amountValue = Number(amount)
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const existingRes = await query('SELECT * FROM service_transactions WHERE service_transaction_id = $1 LIMIT 1', [id])
    const existing = existingRes.rows[0]
    if (!existing) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })

    const newBalance = Number(existing.balance || 0) + amountValue

    const client = await getClient()
    try {
      await client.query('BEGIN')

      const res = await client.query(
        `UPDATE service_transactions SET balance = $1 WHERE service_transaction_id = $2 RETURNING *`,
        [newBalance, id]
      )
      const updated = res.rows[0]

      await client.query('COMMIT')

      await logAudit({ user_id: session.user_id, restaurant: updated.restaurant || session.restaurant, action: 'add_payment', table_name: 'service_transactions', record_id: String(id), new_data: { ...updated, payment_amount: amountValue } })

      return NextResponse.json({ transaction: updated })
    } catch (e) {
      await client.query('ROLLBACK').catch(()=>{})
      throw e
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('Add payment failed', err)
    return NextResponse.json({ error: 'Failed to add payment' }, { status: 500 })
  }
}