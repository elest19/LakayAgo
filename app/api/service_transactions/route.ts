import { NextResponse } from 'next/server'
import { query, getClient } from '../../../lib/db'
import getSessionFromRequest from '../../../lib/session'
import { logAudit } from '../../../lib/audit'

export async function GET(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const qRestaurant = url.searchParams.get('restaurant')
    const status = url.searchParams.get('status')
    const start = url.searchParams.get('start')
    const end = url.searchParams.get('end')

    const params: any[] = []
    const where: string[] = []

    if (session.role !== 'SuperAdmin') {
      where.push(`st.restaurant = $${params.length + 1}`)
      params.push(session.restaurant)
    } else if (qRestaurant) {
      where.push(`st.restaurant = $${params.length + 1}`)
      params.push(qRestaurant)
    }

    if (status) { where.push(`status = $${params.length + 1}`); params.push(status) }
    if (start) { where.push(`service_date >= $${params.length + 1}`); params.push(start) }
    if (end) { where.push(`service_date <= $${params.length + 1}`); params.push(end) }

    let sql = `
      SELECT st.*, 
        CASE 
          WHEN st.status IN ('Finalized', 'Fully Paid') THEN coalesce((
            SELECT sum(greatest(sa.quantity_used - coalesce(sta.quantity_returned, 0), 0) * coalesce(ai.penalty_amount, 0))
            FROM service_assets sa
            LEFT JOIN service_transaction_assets sta
              ON sta.asset_id = sa.asset_id AND sta.service_transaction_id = st.service_transaction_id
            LEFT JOIN assets_inventory ai ON ai.asset_id = sa.asset_id
            WHERE sa.service_id = st.service_id
          ), 0)
          ELSE 0
        END as asset_penalty
      FROM service_transactions st
    `
    if (where.length) sql += ` WHERE ${where.join(' AND ')}`
    sql += ' ORDER BY st.service_date DESC, st.created_at DESC'

    const result = await query(sql, params)
    return NextResponse.json({ transactions: result.rows })
  } catch (err) {
    console.error('Service transactions fetch error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { service_id, service_date, price, downpayment, discount, expenses, penalty, status, balance, deductions_applied: _deductionsApplied } = body
    if (!service_id || !service_date || price == null) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const penaltyValue = Number(penalty ?? 0)
    if (!Number.isFinite(penaltyValue) || penaltyValue < 0) return NextResponse.json({ error: 'Penalty must be a non-negative number' }, { status: 400 })

    const statusValue = status && ['Under Reservation', 'Partial Payment', 'Finalized', 'Fully Paid'].includes(status) ? status : null

    const balanceValue = balance !== undefined ? Number(balance) : (Number(price) - Number(downpayment || 0))
    if (!Number.isFinite(balanceValue) || balanceValue < 0) return NextResponse.json({ error: 'Balance must be a non-negative number' }, { status: 400 })

    const client = await getClient()
    try {
      await client.query('BEGIN')

      // ensure service exists and not archived
      const svcRes = await client.query('SELECT service_id, price, restaurant, is_archived FROM services WHERE service_id = $1 LIMIT 1', [service_id])
      const svc = svcRes.rows[0]
      if (!svc) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Service not found' }, { status: 404 }) }
      if (svc.is_archived) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Service is archived' }, { status: 400 }) }

      const insertRes = await client.query(
        `INSERT INTO service_transactions (service_id, service_date, price, downpayment, discount, expenses, penalty, status, balance) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [service_id, service_date, Number(price), Number(downpayment || 0), Number(discount || 0), Number(expenses || 0), penaltyValue, statusValue, balanceValue]
      )
      const created = insertRes.rows[0]

      await client.query('COMMIT')

      await logAudit({ user_id: session.user_id, restaurant: svc.restaurant || session.restaurant, action: 'create_service_transaction', table_name: 'service_transactions', record_id: String(created.service_transaction_id), new_data: created })

      return NextResponse.json({ transaction: created })
    } catch (err) {
      await client.query('ROLLBACK').catch(()=>{})
      throw err
    } finally { client.release() }
  } catch (err) {
    console.error('Service transaction create error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
