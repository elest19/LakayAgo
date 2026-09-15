import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../../lib/session'
import { logAudit } from '../../../../lib/audit'
import { query } from '../../../../lib/db'

export async function PUT(req: Request, context: any) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const paramsObj = context && typeof context.params !== 'undefined' ? await context.params : {}
    const attendanceId = Number(paramsObj.attendanceId ?? paramsObj?.attendance_id)
    if (!Number.isFinite(attendanceId)) {
      return NextResponse.json({ error: 'Invalid attendance id' }, { status: 400 })
    }

    const body = await req.json()

    const { rows: existingRows } = await query('select * from attendance where attendance_id = $1 limit 1', [attendanceId])
    const existing = existingRows[0]
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (session.role !== 'SuperAdmin' && existing.restaurant !== session.restaurant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const normalizeTime = (value: unknown) => {
      if (value === null || value === undefined || value === '') return null
      const raw = String(value).trim()
      if (!raw) return null
      if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(raw)) return null
      const [hours, minutes] = raw.split(':').map(Number)
      if (Number.isNaN(hours) || Number.isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return null
      }
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    }

    const normalizeInteger = (value: unknown) => {
      const num = Number(value)
      if (!Number.isFinite(num)) return null
      return Math.max(0, Math.round(num))
    }

    const allowed: Record<string, any> = {}
    const fieldMap: Record<string, string> = {
      firstOnDuty: 'first_on_duty',
      firstOffDuty: 'first_off_duty',
      secondOnDuty: 'second_on_duty',
      secondOffDuty: 'second_off_duty',
      first_on_duty: 'first_on_duty',
      first_off_duty: 'first_off_duty',
      second_on_duty: 'second_on_duty',
      second_off_duty: 'second_off_duty',
      lateMinutes: 'late_minutes',
      late_minutes: 'late_minutes',
      leaveEarlyMinutes: 'leave_early_minutes',
      leave_early_minutes: 'leave_early_minutes',
      undertimeMinutes: 'leave_early_minutes',
      overtimeMinutes: 'overtime_minutes',
      overtime_minutes: 'overtime_minutes',
      totalMinutes: 'total_minutes',
      total_minutes: 'total_minutes',
      is_absent: 'is_absent',
      on_leave: 'on_leave',
    }

    const firstOnDutyValue = body.firstOnDuty ?? body.first_on_duty ?? existing.first_on_duty
    const firstOffDutyValue = body.firstOffDuty ?? body.first_off_duty ?? existing.first_off_duty

    for (const [frontKey, dbCol] of Object.entries(fieldMap)) {
      if (!(frontKey in body)) continue
      const incomingValue = body[frontKey]

      if (dbCol === 'first_on_duty' || dbCol === 'first_off_duty' || dbCol === 'second_on_duty' || dbCol === 'second_off_duty') {
        const normalized = normalizeTime(incomingValue)
        if (normalized !== null) {
          allowed[dbCol] = normalized
        }
        continue
      }

      if (dbCol === 'late_minutes' || dbCol === 'leave_early_minutes' || dbCol === 'overtime_minutes' || dbCol === 'total_minutes') {
        const normalized = normalizeInteger(incomingValue)
        if (normalized !== null) allowed[dbCol] = normalized
        continue
      }

      if (dbCol === 'is_absent' || dbCol === 'on_leave') {
        allowed[dbCol] = Boolean(incomingValue)
        continue
      }

      allowed[dbCol] = incomingValue
    }

    if ('status' in body) {
      const status = String(body.status ?? '').trim()
      if (status) {
        const normalizedStatus = status.toLowerCase()
        allowed.is_absent = normalizedStatus === 'absent'
        allowed.on_leave = normalizedStatus === 'leave' || normalizedStatus === 'on leave'
      }
    }

    const firstOnDuty = normalizeTime(firstOnDutyValue)
    const firstOffDuty = normalizeTime(firstOffDutyValue)
    if (firstOnDuty && firstOffDuty) {
      const [inHour, inMinute] = firstOnDuty.split(':').map(Number)
      const [outHour, outMinute] = firstOffDuty.split(':').map(Number)
      const inMinutes = inHour * 60 + inMinute
      const outMinutes = outHour * 60 + outMinute
      const calculatedTotalMinutes = Math.max(0, outMinutes - inMinutes)
      if (!('total_minutes' in body) && !('totalMinutes' in body)) {
        allowed.total_minutes = calculatedTotalMinutes
      }
    }

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: 'No valid attendance fields were provided' }, { status: 400 })
    }

    const sets = [] as string[]
    const queryParams: any[] = []
    let idx = 1
    for (const [key, value] of Object.entries(allowed)) {
      queryParams.push(value)
      sets.push(`${key} = $${idx}`)
      idx++
    }

    queryParams.push(attendanceId)
    const text = `update attendance set ${sets.join(', ')}, updated_at = now() where attendance_id = $${idx} returning *`
    const { rows } = await query(text, queryParams)

    if (!rows[0]) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 })
    }

    const updated = rows[0]
    logAudit({
      user_id: session.user_id,
      restaurant: existing.restaurant,
      action: 'update_attendance',
      table_name: 'attendance',
      record_id: String(attendanceId),
      old_data: existing,
      new_data: updated,
    })

    return NextResponse.json({ attendance: updated })
  } catch (err) {
    console.error('attendance PUT failed', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}