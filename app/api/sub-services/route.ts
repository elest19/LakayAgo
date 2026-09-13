import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'
import getSessionFromRequest from '../../../lib/session'
import { logAudit } from '../../../lib/audit'

async function enrichSubService(row: any) {
  if (!row) return row

  if (row.food_package_id) {
    const pkgRes = await query('SELECT name FROM food_packages WHERE food_package_id = $1 LIMIT 1', [row.food_package_id])
    row.food_package_name = pkgRes.rows[0]?.name || null
  } else {
    row.food_package_name = null
  }

  return row
}

export async function GET(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const qRestaurant = url.searchParams.get('restaurant')
    const includeArchived = url.searchParams.get('includeArchived') === 'true' || url.searchParams.get('includeArchived') === '1'

    const params: any[] = []
    const where: string[] = []

    if (session.role !== 'SuperAdmin') {
      where.push(`restaurant = $${params.length + 1}`)
      params.push(session.restaurant)
    } else if (qRestaurant) {
      where.push(`restaurant = $${params.length + 1}`)
      params.push(qRestaurant)
    }

    if (!includeArchived) {
      where.push(`is_archived = false`)
    }

    let sql = 'SELECT * FROM sub_services'
    if (where.length) sql += ` WHERE ${where.join(' AND ')}`
    sql += ' ORDER BY created_at DESC'

    const result = await query(sql, params)
    const rows = result.rows || []

    for (const row of rows) {
      await enrichSubService(row)
    }

    return NextResponse.json({ subServices: rows })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const name = String(body.name ?? '').trim()
    const price = Number(body.price)
    const restaurantValue = String(body.restaurant || session.restaurant || 'Both').trim()

    if (!name) return NextResponse.json({ error: 'Sub-service name is required' }, { status: 400 })
    if (!Number.isFinite(price) || price < 0) return NextResponse.json({ error: 'Price must be a non-negative number' }, { status: 400 })

    const foodPackageId = body.food_package_id == null || body.food_package_id === '' || body.food_package_id === 'null'
      ? null
      : Number(body.food_package_id)

    if (foodPackageId !== null && (!Number.isFinite(foodPackageId) || foodPackageId <= 0)) {
      return NextResponse.json({ error: 'Food package is invalid' }, { status: 400 })
    }

    if (foodPackageId !== null) {
      const pkgRes = await query('SELECT food_package_id FROM food_packages WHERE food_package_id = $1 LIMIT 1', [foodPackageId])
      if (pkgRes.rows.length === 0) return NextResponse.json({ error: 'Food package not found' }, { status: 404 })
    }

    const result = await query(
      `INSERT INTO sub_services (name, price, restaurant, food_package_id, is_archived)
       VALUES ($1, $2, $3, $4, false)
       RETURNING *`,
      [name, price, restaurantValue, foodPackageId]
    )
    const created = result.rows[0]

    const hydrated = await enrichSubService(created)
    await logAudit({
      user_id: session.user_id,
      restaurant: restaurantValue,
      action: 'create_sub_service',
      table_name: 'sub_services',
      record_id: String(created.sub_service_id),
      new_data: hydrated,
    })

    return NextResponse.json({ subService: hydrated })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
