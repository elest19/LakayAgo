import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'
import getSessionFromRequest from '../../../lib/session'
import { logAudit } from '../../../lib/audit'

function normalizeItemRow(row: any) {
  return {
    ...row,
    food_package_id: Number(row.food_package_id),
    food_and_beverage_id: Number(row.food_and_beverage_id),
    quantity: Number(row.quantity),
  }
}

export async function GET(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const pkgId = url.searchParams.get('food_package_id')

    let sql = 'select * from food_package_items'
    const values: any[] = []
    if (pkgId) {
      sql += ' where food_package_id = $1'
      values.push(Number(pkgId))
    }
    sql += ' order by food_package_item_id desc'

    const result = await query(sql, values)
    return NextResponse.json({ items: result.rows.map(normalizeItemRow) })
  } catch (err) {
    console.error('GET /api/food_package_items failed', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const foodPackageId = Number(body.food_package_id)
    const foodAndBeverageId = Number(body.food_and_beverage_id)
    const quantity = Number(body.quantity)

    if (!Number.isFinite(foodPackageId) || foodPackageId <= 0 || !Number.isFinite(foodAndBeverageId) || foodAndBeverageId <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const packageResult = await query('select restaurant from food_packages where food_package_id = $1 limit 1', [foodPackageId])
    if (!packageResult.rows[0]) return NextResponse.json({ error: 'Food package not found' }, { status: 404 })

    const existing = await query(
      'select 1 from food_package_items where food_package_id = $1 and food_and_beverage_id = $2 limit 1',
      [foodPackageId, foodAndBeverageId]
    )
    if (existing.rows[0]) return NextResponse.json({ error: 'Duplicate package item' }, { status: 409 })

    const insertResult = await query(
      'insert into food_package_items (food_package_id, food_and_beverage_id, quantity) values ($1, $2, $3) returning *',
      [foodPackageId, foodAndBeverageId, quantity]
    )

    const created = normalizeItemRow(insertResult.rows[0])
    await logAudit({
      user_id: session.user_id,
      restaurant: packageResult.rows[0].restaurant || session.restaurant,
      action: 'create_package_item',
      table_name: 'food_package_items',
      record_id: String(created.food_package_item_id),
      new_data: created,
    })

    return NextResponse.json({ item: created })
  } catch (err) {
    console.error('POST /api/food_package_items failed', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const foodPackageItemId = Number(body.food_package_item_id)
    if (!Number.isFinite(foodPackageItemId) || foodPackageItemId <= 0) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const updates: string[] = []
    const values: any[] = []

    if (body.food_package_id !== undefined) {
      const pkgId = Number(body.food_package_id)
      if (!Number.isFinite(pkgId) || pkgId <= 0) return NextResponse.json({ error: 'Invalid package id' }, { status: 400 })
      updates.push(`food_package_id = $${values.length + 1}`)
      values.push(pkgId)
    }

    if (body.food_and_beverage_id !== undefined) {
      const itemId = Number(body.food_and_beverage_id)
      if (!Number.isFinite(itemId) || itemId <= 0) return NextResponse.json({ error: 'Invalid menu item id' }, { status: 400 })
      updates.push(`food_and_beverage_id = $${values.length + 1}`)
      values.push(itemId)
    }

    if (body.quantity !== undefined) {
      const qty = Number(body.quantity)
      if (!Number.isFinite(qty) || qty <= 0) return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 })
      updates.push(`quantity = $${values.length + 1}`)
      values.push(qty)
    }

    if (updates.length === 0) return NextResponse.json({ error: 'No updates provided' }, { status: 400 })

    values.push(foodPackageItemId)
    const result = await query(`update food_package_items set ${updates.join(', ')} where food_package_item_id = $${values.length} returning *`, values)
    if (!result.rows[0]) return NextResponse.json({ error: 'Package item not found' }, { status: 404 })

    const updated = normalizeItemRow(result.rows[0])
    await logAudit({
      user_id: session.user_id,
      restaurant: session.restaurant,
      action: 'update_package_item',
      table_name: 'food_package_items',
      record_id: String(foodPackageItemId),
      new_data: updated,
    })

    return NextResponse.json({ item: updated })
  } catch (err) {
    console.error('PUT /api/food_package_items failed', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const existing = await query('select * from food_package_items where food_package_item_id = $1 limit 1', [Number(id)])
    if (!existing.rows[0]) return NextResponse.json({ error: 'Package item not found' }, { status: 404 })

    const result = await query('delete from food_package_items where food_package_item_id = $1 returning *', [Number(id)])
    const deleted = normalizeItemRow(result.rows[0])
    await logAudit({
      user_id: session.user_id,
      restaurant: session.restaurant,
      action: 'delete_package_item',
      table_name: 'food_package_items',
      record_id: String(id),
      old_data: deleted,
    })

    return NextResponse.json({ item: deleted })
  } catch (err) {
    console.error('DELETE /api/food_package_items failed', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 })
  }
}
