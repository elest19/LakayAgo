import { NextResponse } from 'next/server'
import { query } from '../../../../../lib/db'
import getSessionFromRequest from '../../../../../lib/session'

export async function PUT(req: Request, ctx: any) {
  try {
    const { params } = await ctx || {}
    const { holidayId } = await params || {}
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'SuperAdmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const { date, holiday_name, type, active } = body

    if (!date || !holiday_name) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    const res = await query(
      `UPDATE holidays SET date=$1, holiday_name=$2, type=$3, active=$4 WHERE id=$5 RETURNING *`,
      [date, holiday_name, type, active, holidayId]
    )
    return NextResponse.json(res.rows[0])
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: Request, ctx: any) {
  try {
    const { params } = await ctx || {}
    const { holidayId } = await params || {}
    const session = getSessionFromRequest(_req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'SuperAdmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    await query('DELETE FROM holidays WHERE id=$1', [holidayId])
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
