import { NextResponse } from 'next/server'
import { query } from '../../../../lib/db'
import getSessionFromRequest from '../../../../lib/session'
import { logAudit } from '../../../../lib/audit'

const VALID_PACKAGE_TYPES = ['catering_package', 'menu_bundle'] as const

type PackageType = typeof VALID_PACKAGE_TYPES[number]

function normalizePackageType(value: unknown, fallback: PackageType = 'catering_package'): PackageType {
  const candidate = String(value ?? '').trim().toLowerCase()
  if (!candidate) return fallback
  if (candidate === 'catering_package' || candidate === 'menu_bundle') return candidate
  throw new Error(`Invalid package type: ${String(value)}`)
}

function normalizePackageRows(rows: any[]) {
  return (rows || []).map((row) => ({
    ...row,
    items: Array.isArray(row.items) ? row.items : [],
    item_count: Array.isArray(row.items) ? row.items.length : Number(row.item_count || 0),
  }))
}

async function fetchPackageById(id: number) {
  const result = await query(
    `
      select fp.*, 
        coalesce(json_agg(json_build_object(
          'food_package_item_id', fpi.food_package_item_id,
          'food_and_beverage_id', fpi.food_and_beverage_id,
          'quantity', fpi.quantity,
          'name', fi.name
        )) filter (where fpi.food_package_item_id is not null), '[]') as items,
        count(fpi.food_package_item_id) as item_count
      from food_packages fp
      left join food_package_items fpi on fpi.food_package_id = fp.food_package_id
      left join food_and_beverage_inventory fi on fi.food_and_beverage_id = fpi.food_and_beverage_id
      where fp.food_package_id = $1
      group by fp.food_package_id
      limit 1
    `,
    [id]
  )

  return result.rows[0] ? normalizePackageRows(result.rows)[0] : null
}

async function upsertPackageItems(foodPackageId: number, items: Array<{ food_and_beverage_id: number | string; quantity: number | string }>) {
  await query('delete from food_package_items where food_package_id = $1', [foodPackageId])
  if (!Array.isArray(items) || items.length === 0) return

  for (const item of items) {
    const foodAndBeverageId = Number(item.food_and_beverage_id)
    const quantity = Number(item.quantity)
    if (!Number.isFinite(foodAndBeverageId) || foodAndBeverageId <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Each package item must include a valid food_and_beverage_id and a positive quantity.')
    }

    await query(
      'insert into food_package_items (food_package_id, food_and_beverage_id, quantity) values ($1, $2, $3)',
      [foodPackageId, foodAndBeverageId, quantity]
    )
  }
}

export async function GET(req: Request, { params }: { params: any }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = Number((await params).id)
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'Invalid package id' }, { status: 400 })

    const packageRow = await fetchPackageById(id)
    if (!packageRow) return NextResponse.json({ error: 'Package not found' }, { status: 404 })

    return NextResponse.json({ package: packageRow })
  } catch (err) {
    console.error('GET /api/food_packages/[id] failed', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: any }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const packageId = Number(id)
    const body = await req.json()

    if (!Number.isFinite(packageId) || packageId <= 0) return NextResponse.json({ error: 'Missing package id' }, { status: 400 })

    const updates: string[] = []
    const values: any[] = []

    if (body.name !== undefined) {
      updates.push('name = $' + (values.length + 1))
      values.push(String(body.name).trim())
    }
    if (body.price !== undefined) {
      updates.push('price = $' + (values.length + 1))
      values.push(Number(body.price))
    }
    if (body.restaurant !== undefined) {
      updates.push('restaurant = $' + (values.length + 1))
      values.push(body.restaurant)
    }
    if (body.is_archived !== undefined) {
      updates.push('is_archived = $' + (values.length + 1))
      values.push(Boolean(body.is_archived))
    }
    if (body.type !== undefined) {
      const nextType = normalizePackageType(body.type, 'catering_package')
      updates.push('type = $' + (values.length + 1))
      values.push(nextType)
    }

    if (updates.length > 0) {
      values.push(packageId)
      await query(`update food_packages set ${updates.join(', ')} where food_package_id = $${values.length}`, values)
    }

    if (Array.isArray(body.items)) {
      await upsertPackageItems(packageId, body.items)
    }

    const updatedPackage = await fetchPackageById(packageId)
    if (!updatedPackage) return NextResponse.json({ error: 'Package not found' }, { status: 404 })

    await logAudit({
      user_id: session.user_id,
      restaurant: updatedPackage.restaurant || session.restaurant,
      action: 'update_food_package',
      table_name: 'food_packages',
      record_id: String(packageId),
      new_data: updatedPackage,
    })

    return NextResponse.json({ package: updatedPackage })
  } catch (err) {
    console.error('PUT /api/food_packages/[id] failed', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 400 })
  }
}

export async function DELETE(req: Request, { params }: { params: any }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const packageId = Number(id)
    if (!Number.isFinite(packageId) || packageId <= 0) return NextResponse.json({ error: 'Missing package id' }, { status: 400 })

    // capture existing before archiving
    const existingRes = await query('SELECT * FROM food_packages WHERE food_package_id = $1 LIMIT 1', [packageId])
    const existing = existingRes.rows[0]
    if (!existing) return NextResponse.json({ error: 'Package not found' }, { status: 404 })

    const result = await query('update food_packages set is_archived = true where food_package_id = $1 returning *', [packageId])
    const deleted = result.rows[0]

    await logAudit({
      user_id: session.user_id,
      restaurant: deleted.restaurant || session.restaurant,
      action: 'archive_food_package',
      table_name: 'food_packages',
      record_id: String(packageId),
      old_data: existing,
      new_data: deleted,
    })

    return NextResponse.json({ package: deleted })
  } catch (err) {
    console.error('DELETE /api/food_packages/[id] failed', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
