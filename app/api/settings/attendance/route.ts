import { NextResponse } from 'next/server'
import { query } from '../../../../lib/db'
import getSessionFromRequest from '../../../../lib/session'

export async function GET(req: Request) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rows = await query('SELECT * FROM attendance_settings ORDER BY updated_at DESC LIMIT 1')
    return NextResponse.json(rows.rows[0] ?? null)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'SuperAdmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { grace_period, required_daily_hours, break_duration, overtime_threshold, start_time, end_time, half_day } = body

    if (
      typeof grace_period !== 'number' || typeof required_daily_hours !== 'number' ||
      typeof break_duration !== 'number' || typeof overtime_threshold !== 'number'
    ) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const effectiveHalfDay = typeof half_day === 'string' && half_day.trim() ? half_day.trim() : '12:00:00'

    const existing = await query('SELECT id FROM attendance_settings ORDER BY updated_at DESC LIMIT 1')
    if (existing.rows.length) {
      const id = existing.rows[0].id
      const res = await query(
        `UPDATE attendance_settings SET grace_period=$1, required_daily_hours=$2, break_duration=$3, overtime_threshold=$4, start_time=$5, end_time=$6, half_day=$7 WHERE id=$8 RETURNING *`,
        [grace_period, required_daily_hours, break_duration, overtime_threshold, start_time, end_time, effectiveHalfDay, id]
      )
      return NextResponse.json(res.rows[0])
    }

    const res = await query(
      `INSERT INTO attendance_settings (grace_period, required_daily_hours, break_duration, overtime_threshold, start_time, end_time, half_day) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [grace_period, required_daily_hours, break_duration, overtime_threshold, start_time, end_time, effectiveHalfDay]
    )
    return NextResponse.json(res.rows[0])
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
