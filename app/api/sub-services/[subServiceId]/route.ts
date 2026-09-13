import { NextResponse } from 'next/server'
import { query } from '../../../../lib/db'
import getSessionFromRequest from '../../../../lib/session'
import { logAudit } from '../../../../lib/audit'

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

export async function GET(req: Request, { params }: { params: any }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { subServiceId } = await params
    const id = Number(subServiceId)
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'Invalid sub-service id' }, { status: 400 })

    const result = await query('SELECT * FROM sub_services WHERE sub_service_id = $1 LIMIT 1', [id])
    const row = result.rows[0]
    if (!row) return NextResponse.json({ error: 'Sub-service not found' }, { status: 404 })

    if (session.role !== 'SuperAdmin' && row.restaurant !== session.restaurant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const hydrated = await enrichSubService(row)
    return NextResponse.json({ subService: hydrated })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: any }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { subServiceId } = await params
    const id = Number(subServiceId)
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'Invalid sub-service id' }, { status: 400 })

    const existingRes = await query('SELECT * FROM sub_services WHERE sub_service_id = $1 LIMIT 1', [id])
    const existing = existingRes.rows[0]
    if (!existing) return NextResponse.json({ error: 'Sub-service not found' }, { status: 404 })
    if (session.role !== 'SuperAdmin' && existing.restaurant !== session.restaurant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const updates: string[] = []
    const values: any[] = []

    if (body.name !== undefined) {
      const name = String(body.name ?? '').trim()
      if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
      updates.push(`name = $${values.length + 1}`)
      values.push(name)
    }
    if (body.price !== undefined) {
      const price = Number(body.price)
      if (!Number.isFinite(price) || price < 0) return NextResponse.json({ error: 'Price must be a non-negative number' }, { status: 400 })
      updates.push(`price = $${values.length + 1}`)
      values.push(price)
    }
    if (body.restaurant !== undefined) {
      updates.push(`restaurant = $${values.length + 1}`)
      values.push(String(body.restaurant).trim() || existing.restaurant)
    }
    if (body.food_package_id !== undefined) {
      const foodPackageId = body.food_package_id == null || body.food_package_id === '' || body.food_package_id === 'null'
        ? null
        : Number(body.food_package_id)
      if (foodPackageId !== null && (!Number.isFinite(foodPackageId) || foodPackageId <= 0)) {
        return NextResponse.json({ error: 'Food package is invalid' }, { status: 400 })
      }
      updates.push(`food_package_id = $${values.length + 1}`)
      values.push(foodPackageId)
    }
    if (body.is_archived !== undefined) {
      updates.push(`is_archived = $${values.length + 1}`)
      values.push(Boolean(body.is_archived))
    }

    if (updates.length > 0) {
      values.push(id)
      const sql = `UPDATE sub_services SET ${updates.join(', ')} WHERE sub_service_id = $${values.length} RETURNING *`
      const updateRes = await query(sql, values)
      const updated = updateRes.rows[0]
      const hydrated = await enrichSubService(updated)
      await logAudit({
        user_id: session.user_id,
        restaurant: hydrated.restaurant || session.restaurant,
        action: 'update_sub_service',
        table_name: 'sub_services',
        record_id: String(id),
        new_data: hydrated,
      })
      return NextResponse.json({ subService: hydrated })
    }

    const hydrated = await enrichSubService(existing)
    return NextResponse.json({ subService: hydrated })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
