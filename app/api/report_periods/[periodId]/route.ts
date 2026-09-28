import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../../lib/session'
import { query } from '../../../../lib/db'
import { logAudit } from '../../../../lib/audit'

export async function GET(req: Request, context: any) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { periodId } = await context.params
  const { rows } = await query('select * from report_periods where report_period_id = $1 limit 1', [Number(periodId)])
  const period = rows[0]
  if (!period) return NextResponse.json({ period: null })
  if (session.role !== 'Admin' && period.restaurant !== session.restaurant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  // ensure boolean defaults when DB null
  period.is_sss_enabled = period.is_sss_enabled === null || period.is_sss_enabled === undefined ? true : period.is_sss_enabled
  period.is_philhealth_enabled = period.is_philhealth_enabled === null || period.is_philhealth_enabled === undefined ? true : period.is_philhealth_enabled
  period.is_pagibig_enabled = period.is_pagibig_enabled === null || period.is_pagibig_enabled === undefined ? true : period.is_pagibig_enabled
  return NextResponse.json({ period })
}

export async function PUT(req: Request, context: any) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { periodId } = await context.params
  const body = await req.json()
  const allowed: any = {}
  ;['tabulation_date','source_file','restaurant','is_special_month','is_sss_enabled','is_philhealth_enabled','is_pagibig_enabled'].forEach(k => { if (k in body) allowed[k] = body[k] })

  const { rows: existingRows } = await query('select * from report_periods where report_period_id = $1 limit 1', [Number(periodId)])
  const existing = existingRows[0]
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (session.role !== 'Admin' && existing.restaurant !== session.restaurant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Lock editing of benefit flags once payroll processing moved past editable statuses
  const editableStatuses = ['Pending','Attendance Imported','Validation Required','Ready for Payroll']
  const editingFlags = ['is_sss_enabled','is_philhealth_enabled','is_pagibig_enabled']
  if (!editableStatuses.includes(existing.status || 'Pending')) {
    // If request attempts to change any of the locked flags, deny
    for (const f of editingFlags) {
      if (f in body && body[f] !== (existing[f] === undefined ? true : existing[f])) {
        return NextResponse.json({ error: `Cannot change ${f} once payroll processing has advanced` }, { status: 403 })
      }
    }
  }

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

export async function DELETE(req: Request, context: any) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { periodId } = await context.params

  const { rows: existingRows } = await query('select * from report_periods where report_period_id = $1 limit 1', [Number(periodId)])
  const existing = existingRows[0]
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (session.role !== 'Admin' && existing.restaurant !== session.restaurant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    await query('delete from report_periods where report_period_id = $1', [Number(periodId)])
    logAudit({ user_id: session.user_id, restaurant: existing.restaurant, action: 'delete_report_period', table_name: 'report_periods', record_id: String(periodId), old_data: existing, new_data: null })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Failed to delete report_period', err)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
