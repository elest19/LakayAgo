import { NextResponse } from 'next/server'
import { query } from '../../../../lib/db'
import getSessionFromRequest from '../../../../lib/session'
import { logAudit } from '../../../../lib/audit'

const serializeExpense = (row: any) => ({
  id: String(row.expense_id),
  expense: row.name,
  amount: Number(row.amount),
  restaurant: row.restaurant || 'Lakay Ago',
  createdAt: row.created_at,
  createdBy: 'System',
})

export async function GET(req: Request, { params }: { params: any }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { expenseId } = await params
    const { rows } = await query('SELECT * FROM expenses WHERE expense_id = $1 LIMIT 1', [expenseId])
    const row = rows[0]
    if (!row) return NextResponse.json({ error: 'Expense not found' }, { status: 404 })

    if (session.role !== 'SuperAdmin' && row.restaurant !== session.restaurant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ expense: serializeExpense(row) })
  } catch (err) {
    console.error('GET /api/expenses/[expenseId] failed', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: any }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { expenseId } = await params
    const body = await req.json()
    const { expense, amount, restaurant } = body

    if (!expense && amount == null && !restaurant) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    const existingResult = await query('SELECT * FROM expenses WHERE expense_id = $1 LIMIT 1', [expenseId])
    const existing = existingResult.rows[0]
    if (!existing) return NextResponse.json({ error: 'Expense not found' }, { status: 404 })

    if (session.role !== 'SuperAdmin' && existing.restaurant !== session.restaurant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updates: Record<string, any> = {}
    if (expense != null) updates.name = String(expense).trim()
    if (amount != null) {
      const parsed = Number(amount)
      if (Number.isNaN(parsed) || parsed < 0) {
        return NextResponse.json({ error: 'Invalid expense amount' }, { status: 400 })
      }
      updates.amount = parsed
    }
    if (restaurant != null) {
      const value = String(restaurant).trim()
      if (!value) return NextResponse.json({ error: 'Restaurant is required' }, { status: 400 })
      updates.restaurant = value
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 })
    }

    const assignments: string[] = []
    const values: any[] = []
    let index = 1

    Object.entries(updates).forEach(([key, value]) => {
      assignments.push(`${key} = $${index}`)
      values.push(value)
      index += 1
    })

    values.push(expenseId)
    const result = await query(`UPDATE expenses SET ${assignments.join(', ')} WHERE expense_id = $${index} RETURNING *`, values)
    const updated = result.rows[0]

    await logAudit({
      user_id: session.user_id,
      restaurant: updated.restaurant || existing.restaurant,
      action: 'update_expense',
      table_name: 'expenses',
      record_id: String(expenseId),
      old_data: existing,
      new_data: updated,
    })

    return NextResponse.json({ expense: serializeExpense(updated) })
  } catch (err) {
    console.error('PUT /api/expenses/[expenseId] failed', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: any }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { expenseId } = await params
    const existingResult = await query('SELECT * FROM expenses WHERE expense_id = $1 LIMIT 1', [expenseId])
    const existing = existingResult.rows[0]
    if (!existing) return NextResponse.json({ error: 'Expense not found' }, { status: 404 })

    if (session.role !== 'SuperAdmin' && existing.restaurant !== session.restaurant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const deletedResult = await query('DELETE FROM expenses WHERE expense_id = $1 RETURNING *', [expenseId])
    const deleted = deletedResult.rows[0]

    await logAudit({
      user_id: session.user_id,
      restaurant: existing.restaurant,
      action: 'delete_expense',
      table_name: 'expenses',
      record_id: String(expenseId),
      old_data: existing,
      new_data: null,
    })

    return NextResponse.json({ ok: true, expense: serializeExpense(deleted) })
  } catch (err) {
    console.error('DELETE /api/expenses/[expenseId] failed', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
