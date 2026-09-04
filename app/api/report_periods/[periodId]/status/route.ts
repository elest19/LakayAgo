import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../../../lib/session'
import { query } from '../../../../../lib/db'
import { logAudit } from '../../../../../lib/audit'

export async function POST(req: Request, context: any) {
  const session = getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { periodId } = await context.params
  const body = await req.json()
  const { status } = body
  if (!status) return NextResponse.json({ error: 'Missing status' }, { status: 400 })

  const { rows: existingRows } = await query('select * from report_periods where report_period_id = $1 limit 1', [Number(periodId)])
  const existing = existingRows[0]
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (session.role !== 'SuperAdmin' && existing.restaurant !== session.restaurant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { rows } = await query('update report_periods set status = $1 where report_period_id = $2 returning *', [status, Number(periodId)])
  const updated = rows[0]
  logAudit({ user_id: session.user_id, restaurant: existing.restaurant, action: 'update_report_period_status', table_name: 'report_periods', record_id: String(periodId), old_data: existing, new_data: updated, description: `status => ${status}` })
  return NextResponse.json({ period: updated })
}

export async function PUT(req: Request, context: any) {
  return POST(req, context)
}
