import { NextResponse } from 'next/server'
import { getClient, query } from '../../../../lib/db'
import getSessionFromRequest from '../../../../lib/session'
import { logAudit } from '../../../../lib/audit'

export async function GET(req: Request, { params }: { params: Promise<{ transactionId: string }> }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { transactionId } = await params
    const txRes = await query('SELECT * FROM service_transactions WHERE service_transaction_id = $1 LIMIT 1', [transactionId])
    const tx = txRes.rows[0]
    if (!tx) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })

    const result = await query(
      `SELECT service_transaction_expense_id, service_transaction_id, name, amount, created_at
       FROM service_transaction_expenses
       WHERE service_transaction_id = $1
       ORDER BY created_at ASC`,
      [transactionId]
    )

    return NextResponse.json({ lines: result.rows })
  } catch (err) {
    console.error('Service transaction expenses fetch error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ transactionId: string }> }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { transactionId } = await params
    const body = await req.json()
    const rows = Array.isArray(body.updates) ? body.updates : Array.isArray(body.lines) ? body.lines : []

    if (!rows.length) return NextResponse.json({ ok: true, lines: [] })

    const txRes = await query('SELECT * FROM service_transactions WHERE service_transaction_id = $1 LIMIT 1', [transactionId])
    if (!txRes.rows[0]) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })

    const client = await getClient()
    try {
      await client.query('BEGIN')

      for (const row of rows) {
        const shouldDelete = row?._deleted === true || row?.delete === true
        const id = row?.service_transaction_expense_id !== undefined && row?.service_transaction_expense_id !== null && row?.service_transaction_expense_id !== '' ? Number(row.service_transaction_expense_id) : null

        if (shouldDelete) {
          if (id !== null && Number.isFinite(id) && id > 0) {
            await client.query('DELETE FROM service_transaction_expenses WHERE service_transaction_expense_id = $1 AND service_transaction_id = $2', [id, transactionId])
          }
          continue
        }

        const trimmedName = String(row?.name ?? '').trim()
        const amount = Number(row?.amount ?? 0)

        if (!trimmedName) {
          throw new Error('Each expense row requires a non-empty name.')
        }
        if (!Number.isFinite(amount) || amount < 0) {
          throw new Error('Expense amounts must be non-negative.')
        }

        if (id !== null && Number.isFinite(id) && id > 0) {
          await client.query(
            `UPDATE service_transaction_expenses
             SET name = $1, amount = $2
             WHERE service_transaction_expense_id = $3 AND service_transaction_id = $4`,
            [trimmedName, amount, id, transactionId]
          )
        } else {
          await client.query(
            `INSERT INTO service_transaction_expenses (service_transaction_id, name, amount)
             VALUES ($1, $2, $3)`,
            [transactionId, trimmedName, amount]
          )
        }
      }

      await client.query(
        `UPDATE service_transactions
         SET expenses = COALESCE((
           SELECT SUM(amount)
           FROM service_transaction_expenses
           WHERE service_transaction_id = $1
         ), 0)
         WHERE service_transaction_id = $1`,
        [transactionId]
      )

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw err
    } finally {
      client.release()
    }

    await logAudit({ user_id: session.user_id, restaurant: null, action: 'update_service_transaction_expenses', table_name: 'service_transaction_expenses', record_id: String(transactionId), new_data: rows })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Service transaction expenses update error', err)
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: message || 'Server error' }, { status: 400 })
  }
}
