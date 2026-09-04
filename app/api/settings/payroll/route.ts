import { NextResponse } from 'next/server'
import { query } from '../../../../lib/db'
import getSessionFromRequest from '../../../../lib/session'

export async function GET(req: Request) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rows = await query('SELECT * FROM payroll_settings ORDER BY updated_at DESC LIMIT 1')
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
    const undertimeDeduction = Number(body.undertime_deduction)
    const undertimeDeductionRate = Number(body.undertime_deduction_rate)
    const undertimeDeductionRateType = String(body.undertime_deduction_rate_type ?? '').trim()

    if (!Number.isFinite(undertimeDeduction) || !Number.isFinite(undertimeDeductionRate) || !['Hour', 'Minute'].includes(undertimeDeductionRateType)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const existing = await query('SELECT id FROM payroll_settings ORDER BY updated_at DESC LIMIT 1')
    if (existing.rows.length) {
      const id = existing.rows[0].id
      const res = await query(
        `UPDATE payroll_settings
         SET undertime_deduction=$1,
             undertime_deduction_rate_type=$2,
             undertime_deduction_rate=$3
         WHERE id=$4 RETURNING *`,
        [undertimeDeduction, undertimeDeductionRateType, undertimeDeductionRate, id],
      )
      return NextResponse.json(res.rows[0])
    }

    const res = await query(
      `INSERT INTO payroll_settings (undertime_deduction, undertime_deduction_rate_type, undertime_deduction_rate)
       VALUES ($1,$2,$3) RETURNING *`,
      [undertimeDeduction, undertimeDeductionRateType, undertimeDeductionRate],
    )
    return NextResponse.json(res.rows[0])
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}