import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'
import getSessionFromRequest from '../../../lib/session'
import { logAudit } from '../../../lib/audit'

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
    type: row?.type ?? 'catering_package',
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

async function listPackages(session: any, restaurantFilter?: string | null, includeArchived = false, packageType?: PackageType | null) {
  const params: any[] = []
  const filters: string[] = []

  if (session.role !== 'SuperAdmin') {
    filters.push(`fp.restaurant = $${params.length + 1}`)
    params.push(session.restaurant)
  } else if (restaurantFilter) {
    filters.push(`fp.restaurant = $${params.length + 1}`)
    params.push(restaurantFilter)
  }

  if (packageType) {
    filters.push(`fp.type = $${params.length + 1}`)
    params.push(packageType)
  }

  if (!includeArchived) {
    filters.push(`fp.is_archived = false`)
  }

  // by default, hide special packages unless explicitly requested via restaurantFilter or includeSpecial param
  // caller may pass a restaurantFilter and include special via separate flag handled at GET

  const whereClause = filters.length ? `where ${filters.join(' and ')}` : ''

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
      ${whereClause}
      group by fp.food_package_id
      order by fp.created_at desc
    `,
    params
  )

  return normalizePackageRows(result.rows)
}

export async function GET(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const restaurant = url.searchParams.get('restaurant')
    const includeArchived = url.searchParams.get('includeArchived') === 'true' || url.searchParams.get('includeArchived') === '1'
    const requestedType = url.searchParams.get('type')
    const packageType = requestedType ? normalizePackageType(requestedType) : null
    const includeSpecial = url.searchParams.get('includeSpecial') === 'true' || url.searchParams.get('includeSpecial') === '1'

    const packages = await listPackages(session, restaurant, includeArchived, packageType)
    // filter out special packages unless requested
    const finalPackages = includeSpecial ? packages : packages.filter(p => !p.is_special)
    return NextResponse.json({ packages: finalPackages })
  } catch (err) {
    console.error('GET /api/food_packages failed', err)
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
    const restaurantValue = body.restaurant || session.restaurant || 'Both'
    const items = Array.isArray(body.items) ? body.items : []
    const packageType = normalizePackageType(body.type, 'catering_package')

    if (!name || Number.isNaN(price) || price < 0) {
      return NextResponse.json({ error: 'Missing or invalid package name/price' }, { status: 400 })
    }

    const insertResult = await query(
      `
        insert into food_packages (name, price, restaurant, is_archived, type, is_special)
        values ($1, $2, $3, $4, $5, $6)
        returning *
      `,
      [name, price, restaurantValue, Boolean(body.is_archived), packageType, Boolean(body.is_special)]
    )

    const created = insertResult.rows[0]

    try {
      await upsertPackageItems(created.food_package_id, items)
    } catch (itemErr) {
      // mark the created package as archived instead of hard-deleting to avoid FK/trigger problems
      try { await query('update food_packages set is_archived = true where food_package_id = $1', [created.food_package_id]) } catch (e) {}
      return NextResponse.json({ error: String(itemErr instanceof Error ? itemErr.message : 'Package items invalid') }, { status: 400 })
    }

    const packageWithItems = await fetchPackageById(created.food_package_id)
    await logAudit({
      user_id: session.user_id,
      restaurant: restaurantValue,
      action: 'create_food_package',
      table_name: 'food_packages',
      record_id: String(created.food_package_id),
      new_data: packageWithItems,
    })

    return NextResponse.json({ package: packageWithItems })
  } catch (err) {
    console.error('POST /api/food_packages failed', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const packageId = Number(body.food_package_id ?? body.id)
    if (!Number.isFinite(packageId) || packageId <= 0) {
      return NextResponse.json({ error: 'Missing package id' }, { status: 400 })
    }

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

    if (updates.length === 0 && !Array.isArray(body.items)) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    if (updates.length > 0) {
      values.push(packageId)
      await query(`update food_packages set ${updates.join(', ')} where food_package_id = $${values.length}`, values)
    }

    if (body.is_special !== undefined) {
      await query('update food_packages set is_special = $1 where food_package_id = $2', [Boolean(body.is_special), packageId])
    }

    if (Array.isArray(body.items)) {
      await upsertPackageItems(packageId, body.items)
    }

    const updatedPackage = await fetchPackageById(packageId)
    await logAudit({
      user_id: session.user_id,
      restaurant: updatedPackage?.restaurant || session.restaurant,
      action: 'update_food_package',
      table_name: 'food_packages',
      record_id: String(packageId),
      new_data: updatedPackage,
    })

    return NextResponse.json({ package: updatedPackage })
  } catch (err) {
    console.error('PUT /api/food_packages failed', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 400 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const id = Number(url.searchParams.get('id') ?? req.headers.get('x-package-id'))
    const packageId = Number.isFinite(id) && id > 0 ? id : Number((await req.json().catch(() => ({}))).id)

    if (!Number.isFinite(packageId) || packageId <= 0) {
      return NextResponse.json({ error: 'Missing package id' }, { status: 400 })
    }

    // hard delete (permanent): food_package_items rows cascade and services/sub_services
    // references are set null. Deletion is blocked by the database while the package is
    // still referenced by sales (prevent_delete_if_referenced_by_sales_package trigger).
    if (url.searchParams.get('hard_delete') === 'true') {
      try {
        const result = await query('DELETE FROM food_packages WHERE food_package_id = $1 RETURNING *', [packageId])
        const deleted = result.rows[0]
        if (!deleted) return NextResponse.json({ error: 'Package not found' }, { status: 404 })
        await logAudit({
          user_id: session.user_id,
          restaurant: deleted.restaurant || session.restaurant,
          action: 'delete_food_package',
          table_name: 'food_packages',
          record_id: String(packageId),
          old_data: deleted,
        })
        return NextResponse.json({ deleted })
      } catch (e: any) {
        console.error('Food package hard delete failed', e)
        if (String(e.message || '').toLowerCase().includes('violat')) {
          return NextResponse.json({ error: 'Cannot delete: referenced by existing records' }, { status: 400 })
        }
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
      }
    }

    const result = await query(
      'update food_packages set is_archived = true where food_package_id = $1 returning *',
      [packageId]
    )

    const deleted = result.rows[0]
    if (!deleted) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 })
    }

    await logAudit({
      user_id: session.user_id,
      restaurant: deleted.restaurant || session.restaurant,
      action: 'archive_food_package',
      table_name: 'food_packages',
      record_id: String(packageId),
      new_data: deleted,
    })

    return NextResponse.json({ package: deleted })
  } catch (err) {
    console.error('DELETE /api/food_packages failed', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
