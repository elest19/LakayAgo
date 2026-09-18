import { NextResponse } from 'next/server'
import { query } from '../../../../../lib/db'
import getSessionFromRequest from '../../../../../lib/session'
import { logAudit } from '../../../../../lib/audit'

export async function PATCH(req: Request, { params }: { params: any }) {
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

    const result = await query(
      'UPDATE sub_services SET is_archived = true WHERE sub_service_id = $1 RETURNING *',
      [id]
    )
    const updated = result.rows[0]

    await logAudit({
      user_id: session.user_id,
      restaurant: updated.restaurant || session.restaurant,
      action: 'archive_sub_service',
      table_name: 'sub_services',
      record_id: String(id),
      old_data: existing,
      new_data: updated,
    })

    return NextResponse.json({ subService: updated })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
