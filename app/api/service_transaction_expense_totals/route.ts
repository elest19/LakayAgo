import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'
import getSessionFromRequest from '../../../lib/session'

// Returns the sum of the expense lines (service_transaction_expenses) for every
// transaction, regardless of transaction status. Used by the Transactions tab so
// the Expenses field always reflects the Transaction Expenses modal lines total.
export async function GET(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const result = await query(
      `SELECT service_transaction_id, SUM(amount) AS total
       FROM service_transaction_expenses
       GROUP BY service_transaction_id`
    )

    const totals: Record<string, number> = {}
    for (const row of result.rows) {
      totals[String(row.service_transaction_id)] = Number(row.total || 0)
    }

    return NextResponse.json({ totals })
  } catch (err) {
    console.error('Service transaction expense totals fetch error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
