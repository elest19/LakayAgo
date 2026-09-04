import { NextResponse } from 'next/server'
import { query } from '../../../../lib/db'
import getSessionFromRequest from '../../../../lib/session'

export async function GET(req: Request) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const res = await query('SELECT * FROM holidays ORDER BY date DESC')
    return NextResponse.json(res.rows)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'SuperAdmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { date, holiday_name, type = 'REGULAR', active = true } = body
    if (!date || !holiday_name) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    const res = await query(
      `INSERT INTO holidays (date, holiday_name, type, active) VALUES ($1,$2,$3,$4) RETURNING *`,
      [date, holiday_name, type, active]
    )
    return NextResponse.json(res.rows[0], { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
