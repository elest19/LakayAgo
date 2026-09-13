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

    let sql = 'SELECT * FROM assets_inventory'
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

    // by default exclude archived assets unless explicitly requested
    const includeArchived = url.searchParams.get('includeArchived') === 'true' || url.searchParams.get('includeArchived') === '1'
    if (!includeArchived) {
      if (where.length) {
        sql += ' AND is_archived = false'
      } else {
        sql += ' WHERE is_archived = false'
      }
    }

    sql += ' ORDER BY created_at DESC'

    const result = await query(sql, params)
    return NextResponse.json({ assets: result.rows })
  } catch (err) {
    console.error('Assets fetch error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { name, quantity, restaurant, is_archived, penalty_amount } = body
    const restaurantValue = restaurant || session.restaurant
    if (!name || quantity == null) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    if (!restaurantValue) return NextResponse.json({ error: 'Restaurant context required' }, { status: 403 })

    const insert = { name, quantity: Number(quantity), restaurant: restaurantValue, is_archived: Boolean(is_archived), penalty_amount: Number(penalty_amount || 0) }
    const result = await query(
      `INSERT INTO assets_inventory (name, quantity, restaurant, is_archived, penalty_amount) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [insert.name, insert.quantity, insert.restaurant, insert.is_archived, insert.penalty_amount]
    )
    const created = result.rows[0]

    await logAudit({ user_id: session.user_id, restaurant: restaurantValue, action: 'create_asset', table_name: 'assets_inventory', record_id: String(created.asset_id), new_data: created })

    return NextResponse.json({ asset: created })
  } catch (err) {
    console.error('Asset create error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}