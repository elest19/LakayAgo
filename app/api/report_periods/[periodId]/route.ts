import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../../lib/session'
import { query } from '../../../../lib/db'
import { logAudit } from '../../../../lib/audit'

export async function GET(req: Request, context: any) {
  const session = getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { periodId } = await context.params
  const { rows } = await query('select * from report_periods where report_period_id = $1 limit 1', [Number(periodId)])
  const period = rows[0]
  if (!period) return NextResponse.json({ period: null })
  if (session.role !== 'SuperAdmin' && period.restaurant !== session.restaurant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return NextResponse.json({ period })
}

export async function PUT(req: Request, context: any) {
  const session = getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { periodId } = await context.params
  const body = await req.json()
  const allowed: any = {}
  ;['tabulation_date','source_file','restaurant'].forEach(k => { if (k in body) allowed[k] = body[k] })

  const { rows: existingRows } = await query('select * from report_periods where report_period_id = $1 limit 1', [Number(periodId)])
  const existing = existingRows[0]
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (session.role !== 'SuperAdmin' && existing.restaurant !== session.restaurant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sets: string[] = []
  const params: any[] = []
  let idx = 1
  for (const k of Object.keys(allowed)) { params.push(allowed[k]); sets.push(`${k} = $${idx}`); idx++ }
  params.push(Number(periodId))
  const text = `update report_periods set ${sets.join(', ')}, created_at = created_at where report_period_id = $${idx} returning *`
  const { rows } = await query(text, params)
  const updated = rows[0]
  logAudit({ user_id: session.user_id, restaurant: existing.restaurant, action: 'update_report_period', table_name: 'report_periods', record_id: String(periodId), old_data: existing, new_data: updated })
  return NextResponse.json({ period: updated })
}
