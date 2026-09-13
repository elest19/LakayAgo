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

    const params: any[] = []
    const where: string[] = []

    if (session.role !== 'SuperAdmin') {
      where.push(`restaurant = $${params.length + 1}`)
      params.push(session.restaurant)
    } else if (qRestaurant) {
      where.push(`restaurant = $${params.length + 1}`)
      params.push(qRestaurant)
    }

    let sql = 'SELECT * FROM services'
    if (where.length) sql += ` WHERE ${where.join(' AND ')}`
    sql += ' ORDER BY created_at DESC'

    const result = await query(sql, params)
    const services = result.rows

    // attach service_assets to each service
    for (const svc of services) {
      const assetsRes = await query(
        'SELECT sa.asset_id, sa.quantity_used, a.name FROM service_assets sa LEFT JOIN assets_inventory a ON a.asset_id = sa.asset_id WHERE sa.service_id = $1',
        [svc.service_id]
      )
      svc.assets = assetsRes.rows || []
    }

    return NextResponse.json({ services })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { service_type, restaurant, price, assets } = body
    const restaurantValue = restaurant || session.restaurant || 'Both'
    if (!service_type || price == null) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const result = await query(
      `INSERT INTO services (service_type, restaurant, price) VALUES ($1, $2, $3) RETURNING *`,
      [service_type, restaurantValue, Number(price)]
    )
    const created = result.rows[0]

    if (Array.isArray(assets) && assets.length > 0) {
      for (const a of assets) {
        const aid = Number(a.asset_id)
        const qty = Number(a.quantity || 0)
        if (!Number.isFinite(aid) || aid <= 0 || !Number.isFinite(qty) || qty <= 0) continue
        await query(
          'INSERT INTO service_assets (service_id, asset_id, quantity_used) VALUES ($1, $2, $3)',
          [created.service_id, aid, qty]
        )
      }
    }

    await logAudit({ user_id: session.user_id, restaurant: restaurantValue, action: 'create_service', table_name: 'services', record_id: String(created.service_id), new_data: created })

    return NextResponse.json({ service: created })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { service_id, service_type, restaurant, price, is_archived, assets } = body
    if (!service_id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const updates: string[] = []
    const values: any[] = []
    let idx = 1
    if (service_type !== undefined) { updates.push(`service_type = $${idx++}`); values.push(service_type) }
    if (restaurant !== undefined) { updates.push(`restaurant = $${idx++}`); values.push(restaurant) }
    if (price !== undefined) { updates.push(`price = $${idx++}`); values.push(Number(price)) }
    if (is_archived !== undefined) { updates.push(`is_archived = $${idx++}`); values.push(Boolean(is_archived)) }

    if (updates.length === 0 && !Array.isArray(assets)) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    let updated
    if (updates.length > 0) {
      values.push(service_id)
      const sql = `UPDATE services SET ${updates.join(', ')} WHERE service_id = $${idx} RETURNING *`
      const result = await query(sql, values)
      updated = result.rows[0]
    } else {
      const result = await query('SELECT * FROM services WHERE service_id = $1 LIMIT 1', [service_id])
      updated = result.rows[0]
    }

    if (Array.isArray(assets)) {
      await query('DELETE FROM service_assets WHERE service_id = $1', [service_id])
      for (const a of assets) {
        const aid = Number(a.asset_id)
        const qty = Number(a.quantity || 0)
        if (!Number.isFinite(aid) || aid <= 0 || !Number.isFinite(qty) || qty <= 0) continue
        await query(
          'INSERT INTO service_assets (service_id, asset_id, quantity_used) VALUES ($1, $2, $3)',
          [service_id, aid, qty]
        )
      }
    }

    await logAudit({ user_id: session.user_id, restaurant: restaurant || session.restaurant, action: 'update_service', table_name: 'services', record_id: String(service_id), new_data: updated })
    return NextResponse.json({ service: updated })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const result = await query(
      'UPDATE services SET is_archived = true WHERE service_id = $1 RETURNING *',
      [id]
    )
    const deleted = result.rows[0]
    if (!deleted) return NextResponse.json({ error: 'Service not found' }, { status: 404 })

    await logAudit({ user_id: session.user_id, restaurant: deleted.restaurant || session.restaurant, action: 'archive_service', table_name: 'services', record_id: String(id), new_data: deleted })
    return NextResponse.json({ service: deleted })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}