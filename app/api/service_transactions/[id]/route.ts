import { NextResponse } from 'next/server'
import { query } from '../../../../lib/db'
import getSessionFromRequest from '../../../../lib/session'
import { logAudit } from '../../../../lib/audit'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const res = await query('SELECT * FROM service_transactions WHERE service_transaction_id = $1 LIMIT 1', [id])
    const row = res.rows[0]
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ transaction: row })
  } catch (err) {
    console.error('GET service_transaction failed', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    if (Object.prototype.hasOwnProperty.call(body, 'expenses')) {
      return NextResponse.json({ error: 'Expenses are derived from transaction expense lines and cannot be set directly.' }, { status: 400 })
    }

    const { price, downpayment, discount, penalty, status, service_date, balance, deductions_applied: _deductionsApplied } = body

    const existingRes = await query('SELECT * FROM service_transactions WHERE service_transaction_id = $1 LIMIT 1', [id])
    const existing = existingRes.rows[0]
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updates: string[] = []
    const values: any[] = []
    let idx = 1
    const nextStatus = status !== undefined ? status : existing.status

    if (price !== undefined) { updates.push(`price = $${idx++}`); values.push(Number(price)) }
    if (downpayment !== undefined) { updates.push(`downpayment = $${idx++}`); values.push(Number(downpayment)) }
    if (discount !== undefined) { updates.push(`discount = $${idx++}`); values.push(Number(discount)) }
    if (penalty !== undefined) {
      const penaltyValue = Number(penalty)
      if (!Number.isFinite(penaltyValue) || penaltyValue < 0) return NextResponse.json({ error: 'Penalty must be a non-negative number' }, { status: 400 })
      updates.push(`penalty = $${idx++}`)
      values.push(penaltyValue)
    }
    if (status !== undefined) { updates.push(`status = $${idx++}`); values.push(status) }
    if (service_date !== undefined) { updates.push(`service_date = $${idx++}`); values.push(service_date) }
    if (balance !== undefined) {
      const balanceValue = Number(balance)
      if (!Number.isFinite(balanceValue) || balanceValue < 0) return NextResponse.json({ error: 'Balance must be a non-negative number' }, { status: 400 })
      updates.push(`balance = $${idx++}`)
      values.push(balanceValue)
    }

    if (updates.length === 0) return NextResponse.json({ error: 'No updates provided' }, { status: 400 })

    values.push(id)
    const sql = `UPDATE service_transactions SET ${updates.join(', ')} WHERE service_transaction_id = $${idx} RETURNING *`
    const result = await query(sql, values)
    const updated = result.rows[0]

    await logAudit({ user_id: session.user_id, restaurant: updated.restaurant || session.restaurant, action: 'update_service_transaction', table_name: 'service_transactions', record_id: String(id), new_data: updated })
    return NextResponse.json({ transaction: updated })
  } catch (err) {
    console.error('PUT service_transaction failed', err)
    const message = err instanceof Error ? err.message : 'Server error'
    const isInventoryIssue = /Insufficient production inventory|Production inventory .* not found/i.test(message)
    return NextResponse.json({ error: isInventoryIssue ? message : 'Server error' }, { status: isInventoryIssue ? 400 : 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const existingRes = await query('SELECT * FROM service_transactions WHERE service_transaction_id = $1 LIMIT 1', [id])
    const existing = existingRes.rows[0]
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const result = await query('DELETE FROM service_transactions WHERE service_transaction_id = $1 RETURNING *', [id])
    const deleted = result.rows[0]
    await logAudit({ user_id: session.user_id, restaurant: deleted.restaurant || session.restaurant, action: 'delete_service_transaction', table_name: 'service_transactions', record_id: String(id), old_data: existing, new_data: null })
    return NextResponse.json({ ok: true, removed: deleted })
  } catch (err) {
    console.error('DELETE service_transaction failed', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
