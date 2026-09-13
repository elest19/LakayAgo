import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'
import getSessionFromRequest from '../../../lib/session'
import { logAudit } from '../../../lib/audit'

export async function GET(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const qRestaurant = url.searchParams.get('restaurant')

    let sql = 'SELECT * FROM expenses'
    const params: any[] = []
    const where: string[] = []

    if (session.role !== 'SuperAdmin') {
      where.push(`restaurant = $${params.length + 1}`)
      params.push(session.restaurant)
    } else if (qRestaurant) {
      where.push(`restaurant = $${params.length + 1}`)
      params.push(qRestaurant)
    }

    if (where.length) sql += ` WHERE ${where.join(' AND ')}`
    sql += ' ORDER BY created_at DESC'

    const result = await query(sql, params)
    const expenses = result.rows.map((r: any) => ({
      id: String(r.expense_id),
      expense: r.name,
      amount: Number(r.amount),
      restaurant: r.restaurant || 'Both',
      createdAt: r.created_at,
      createdBy: 'System',
    }))

    return NextResponse.json({ expenses })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { expense, amount, restaurant } = body
    if (!expense || amount == null) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    if (!restaurant) return NextResponse.json({ error: 'Restaurant is required' }, { status: 400 })

    const restaurantValue = restaurant || 'Lakay Ago'
    const result = await query(
      'INSERT INTO expenses (name, amount, restaurant) VALUES ($1, $2, $3) RETURNING *',
      [expense, Number(amount), restaurantValue]
    )
    const created = result.rows[0]

    await logAudit({ user_id: session.user_id, restaurant: restaurantValue, action: 'create_expense', table_name: 'expenses', record_id: String(created.expense_id), new_data: created })

    const expenseRecord = {
      id: String(created.expense_id),
      expense: created.name,
      amount: Number(created.amount),
      restaurant: created.restaurant || restaurantValue,
      createdAt: created.created_at,
      createdBy: 'System',
    }
    return NextResponse.json({ expense: expenseRecord })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}