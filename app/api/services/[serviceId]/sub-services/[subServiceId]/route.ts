import { NextResponse } from 'next/server'
import { query } from '../../../../../../lib/db'
import getSessionFromRequest from '../../../../../../lib/session'
import { logAudit } from '../../../../../../lib/audit'

async function ensureServiceAccess(session: any, serviceId: number) {
  const serviceRes = await query('SELECT service_id, restaurant FROM services WHERE service_id = $1 LIMIT 1', [serviceId])
  const service = serviceRes.rows[0]
  if (!service) throw new Error('Service not found')
  if (session.role !== 'SuperAdmin' && service.restaurant !== session.restaurant) {
    throw new Error('Forbidden')
  }
  return service
}

export async function DELETE(req: Request, { params }: { params: any }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { serviceId, subServiceId } = await params
    const service_id = Number(serviceId)
    const sub_service_id = Number(subServiceId)

    if (!Number.isFinite(service_id) || service_id <= 0) {
      return NextResponse.json({ error: 'Invalid service id' }, { status: 400 })
    }
    if (!Number.isFinite(sub_service_id) || sub_service_id <= 0) {
      return NextResponse.json({ error: 'Invalid sub-service id' }, { status: 400 })
    }

    await ensureServiceAccess(session, service_id)

    const result = await query(
      'DELETE FROM service_sub_services WHERE service_id = $1 AND sub_service_id = $2 RETURNING *',
      [service_id, sub_service_id]
    )
    const deleted = result.rows[0]

    if (!deleted) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    await logAudit({
      user_id: session.user_id,
      restaurant: session.restaurant,
      action: 'detach_sub_service',
      table_name: 'service_sub_services',
      record_id: String(deleted.service_sub_service_id),
      old_data: deleted,
      new_data: null,
    })

    return NextResponse.json({ ok: true, attachment: deleted })
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
