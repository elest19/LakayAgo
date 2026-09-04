import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../../lib/session'
import { logAudit } from '../../../../lib/audit'
import { query } from '../../../../lib/db'

export async function PUT(req: Request, context: any) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { params } = await (context as any)
    const attendanceId = Number((await params).attendanceId)
    const body = await req.json()

    const { rows: existingRows } = await query('select * from attendance where attendance_id = $1 limit 1', [attendanceId])
    const existing = existingRows[0]
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (session.role !== 'SuperAdmin' && existing.restaurant !== session.restaurant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const allowed: any = {}
    const fieldMap: Record<string, string> = {
      firstOnDuty: 'first_on_duty',
      firstOffDuty: 'first_off_duty',
      secondOnDuty: 'second_on_duty',
      secondOffDuty: 'second_off_duty',
      lateMinutes: 'late_minutes',
      late_minutes: 'late_minutes',
      leaveEarlyMinutes: 'leave_early_minutes',
      leave_early_minutes: 'leave_early_minutes',
      overtimeMinutes: 'overtime_minutes',
      overtime_minutes: 'overtime_minutes',
      undertimeMinutes: 'leave_early_minutes',
      totalMinutes: 'total_minutes',
      total_minutes: 'total_minutes',
      first_on_duty: 'first_on_duty',
      first_off_duty: 'first_off_duty',
      second_on_duty: 'second_on_duty',
      second_off_duty: 'second_off_duty',
      is_absent: 'is_absent',
    }
    for (const [frontKey, dbCol] of Object.entries(fieldMap)) {
      if (frontKey in body) allowed[dbCol] = body[frontKey]
    }
    // Map status text to is_absent boolean
    if ('status' in body) {
      allowed.is_absent = String(body.status).toLowerCase() === 'absent'
    }

    const sets = [] as string[]
    const queryParams: any[] = []
    let idx = 1
    for (const k of Object.keys(allowed)) {
      queryParams.push((allowed as any)[k])
      sets.push(`${k} = $${idx}`)
      idx++
    }
    queryParams.push(attendanceId)
    const text = `update attendance set ${sets.join(', ')}, updated_at = now() where attendance_id = $${idx} returning *`
    const { rows } = await query(text, queryParams)
    const updated = rows[0]
    logAudit({ user_id: session.user_id, restaurant: existing.restaurant, action: 'update_attendance', table_name: 'attendance', record_id: String(attendanceId), old_data: existing, new_data: updated })

    return NextResponse.json({ attendance: updated })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}