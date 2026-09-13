import { NextResponse } from 'next/server'
import { query } from '../../../../../lib/db'
import getSessionFromRequest from '../../../../../lib/session'
import { logAudit } from '../../../../../lib/audit'

async function ensureServiceAccess(session: any, serviceId: number) {
  const serviceRes = await query('SELECT service_id, restaurant FROM services WHERE service_id = $1 LIMIT 1', [serviceId])
  const service = serviceRes.rows[0]
  if (!service) throw new Error('Service not found')
  if (session.role !== 'SuperAdmin' && service.restaurant !== session.restaurant) {
    throw new Error('Forbidden')
  }
  return service
}

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

    const { serviceId } = await params
    const service_id = Number(serviceId)
    if (!Number.isFinite(service_id) || service_id <= 0) {
      return NextResponse.json({ error: 'Invalid service id' }, { status: 400 })
    }

    await ensureServiceAccess(session, service_id)

    const url = new URL(req.url)
    const includeArchived = url.searchParams.get('includeArchived') === 'true' || url.searchParams.get('includeArchived') === '1'

    let sql = `
      SELECT ss.*
      FROM service_sub_services sss
      JOIN sub_services ss ON ss.sub_service_id = sss.sub_service_id
      WHERE sss.service_id = $1
    `
    const values: any[] = [service_id]

    if (!includeArchived) {
      sql += ' AND ss.is_archived = false'
    }

    sql += ' ORDER BY ss.created_at DESC'

    const result = await query(sql, values)
    const rows = result.rows || []

    for (const row of rows) {
      await enrichSubService(row)
    }

    return NextResponse.json({ subServices: rows })
  } catch (err) {
    if (err instanceof Error && err.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (err instanceof Error && err.message === 'Service not found') {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: any }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { serviceId } = await params
    const service_id = Number(serviceId)
    if (!Number.isFinite(service_id) || service_id <= 0) {
      return NextResponse.json({ error: 'Invalid service id' }, { status: 400 })
    }

    await ensureServiceAccess(session, service_id)

    const body = await req.json()
    const sub_service_id = Number(body.sub_service_id)
    if (!Number.isFinite(sub_service_id) || sub_service_id <= 0) {
      return NextResponse.json({ error: 'Sub-service id is required' }, { status: 400 })
    }

    const subServiceRes = await query('SELECT * FROM sub_services WHERE sub_service_id = $1 LIMIT 1', [sub_service_id])
    const subService = subServiceRes.rows[0]
    if (!subService) return NextResponse.json({ error: 'Sub-service not found' }, { status: 404 })
    if (session.role !== 'SuperAdmin' && subService.restaurant !== session.restaurant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const insertRes = await query(
      `INSERT INTO service_sub_services (service_id, sub_service_id)
       VALUES ($1, $2)
       ON CONFLICT (service_id, sub_service_id) DO NOTHING
       RETURNING *`,
      [service_id, sub_service_id]
    )

    const attached = insertRes.rows[0] || { service_id, sub_service_id }
    const hydrated = await enrichSubService(subService)

    await logAudit({
      user_id: session.user_id,
      restaurant: subService.restaurant || session.restaurant,
      action: 'attach_sub_service',
      table_name: 'service_sub_services',
      record_id: String(attached.service_sub_service_id || `${service_id}:${sub_service_id}`),
      new_data: hydrated,
    })

    return NextResponse.json({ subService: hydrated })
  } catch (err) {
    if (err instanceof Error && err.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (err instanceof Error && err.message === 'Service not found') {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
