import { NextResponse } from 'next/server'
import { query } from '../../../../lib/db'
import getSessionFromRequest from '../../../../lib/session'

async function hasSpecialMonthPayColumn() {
  const res = await query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'payroll_settings'
        AND column_name = 'special_month_pay'
    ) AS has_column
  `)
  return Boolean(res.rows[0]?.has_column)
}

export async function GET(req: Request) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const hasColumn = await hasSpecialMonthPayColumn()
    const queryText = hasColumn
      ? 'SELECT * FROM payroll_settings ORDER BY updated_at DESC LIMIT 1'
      : 'SELECT id, undertime_deduction, undertime_deduction_rate_type, undertime_deduction_rate, NULL::date AS special_month_pay, created_at, updated_at FROM payroll_settings ORDER BY updated_at DESC LIMIT 1'
    const rows = await query(queryText)
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
    const specialMonthPayRaw = body.special_month_pay
    const specialMonthPay = specialMonthPayRaw === null || specialMonthPayRaw === undefined || String(specialMonthPayRaw).trim() === ''
      ? null
      : String(specialMonthPayRaw).slice(0, 10)
    const hasColumn = await hasSpecialMonthPayColumn()

    if (!Number.isFinite(undertimeDeduction) || !Number.isFinite(undertimeDeductionRate) || !['Hour', 'Minute'].includes(undertimeDeductionRateType)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    if (specialMonthPay && !/^\d{4}-\d{2}-\d{2}$/.test(specialMonthPay)) {
      return NextResponse.json({ error: 'Invalid special_month_pay date' }, { status: 400 })
    }

    const existing = await query('SELECT id FROM payroll_settings ORDER BY updated_at DESC LIMIT 1')
    if (existing.rows.length) {
      const id = existing.rows[0].id
      if (hasColumn) {
        const res = await query(
          `UPDATE payroll_settings
           SET undertime_deduction=$1,
               undertime_deduction_rate_type=$2,
               undertime_deduction_rate=$3,
               special_month_pay=$4
           WHERE id=$5 RETURNING *`,
          [undertimeDeduction, undertimeDeductionRateType, undertimeDeductionRate, specialMonthPay, id],
        )
        return NextResponse.json(res.rows[0])
      }

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

    if (hasColumn) {
      const res = await query(
        `INSERT INTO payroll_settings (undertime_deduction, undertime_deduction_rate_type, undertime_deduction_rate, special_month_pay)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [undertimeDeduction, undertimeDeductionRateType, undertimeDeductionRate, specialMonthPay],
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