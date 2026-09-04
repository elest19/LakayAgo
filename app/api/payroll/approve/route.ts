import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../../lib/session'
import { getClient } from '../../../../lib/db'
import { logAudit } from '../../../../lib/audit'

export async function POST(req: Request) {
  const session = getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const periodId = Number(body.period_id)
  const rows = body.rows || []
  if (!Number.isFinite(periodId)) return NextResponse.json({ error: 'Missing period_id' }, { status: 400 })

  const client = await getClient()
  try {
    await client.query('BEGIN')

    // Verify report period exists and belongs to user
    const { rows: periodRows } = await client.query('select * from report_periods where report_period_id = $1 limit 1', [periodId])
    const period = periodRows[0]
    if (!period) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Report period not found' }, { status: 404 })
    }
    if (session.role !== 'SuperAdmin' && period.restaurant !== session.restaurant) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Insert payslips. Recompute totals server-side and persist cash advance deductions.
    const insertText = `
      insert into payslips(
        report_period_id, restaurant, employee_id,
        base_pay, overtime_pay, halfday_pay, holiday_pay, gross_pay,
        sss_deduction, philhealth_deduction, pagibig_deduction,
        undertime_deduction, late_deduction, cash_advance_deduction,
        total_deduction, net_pay, status
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) returning *
    `

    const inserted: any[] = []
    for (const r of rows) {
      const basePay = Number(r.gross_base ?? r.base_pay ?? 0)
      const overtimePay = Number(r.overtime_pay ?? 0)
      const halfdayPay = Number(r.halfday_payment ?? 0)
      const holidayPay = Number(r.holiday_pay ?? 0)
      const grossPay = Number(r.gross_pay ?? basePay + overtimePay + halfdayPay + holidayPay)

      const sss = Number(r.sss_deduction ?? 0)
      const phil = Number(r.philhealth_deduction ?? 0)
      const pagibig = Number(r.pagibig_deduction ?? 0)
      const undertime = Number(r.undertime_deduction_total ?? r.undertime_deduction ?? 0)
      const late = Number(r.late_deduction ?? r.sum_late_min ?? 0)
      const cashAdvance = Number(r.cash_advance_deduction ?? 0)

      const totalDeduction = Number((sss + phil + pagibig + undertime + late + cashAdvance).toFixed(2))
      // honor client-provided override when flagged; otherwise compute server-side
      const netPay = (r.net_pay_overridden || r.net_pay_overridden === true) && (typeof r.net_pay === 'number' || !Number.isNaN(Number(r.net_pay)))
        ? Number(r.net_pay)
        : Number((grossPay - totalDeduction).toFixed(2))

      const params = [
        periodId,
        period.restaurant,
        r.employee_id ?? null,
        basePay,
        overtimePay,
        halfdayPay,
        holidayPay,
        grossPay,
        sss,
        phil,
        pagibig,
        undertime,
        late,
        cashAdvance,
        totalDeduction,
        netPay,
        'released'
      ]

      const { rows: createdRows } = await client.query(insertText, params)
      inserted.push(createdRows[0])
    }

    // Update period status to released
    await client.query('update report_periods set status = $1 where report_period_id = $2', ['released', periodId])

    // Mark cash advances as deducted where they are fully paid for this period.
    // This will set `status = deducted` for advances that have been fully paid
    // according to the cash_advance_payments for the approved report period.
    await client.query(`
      update cash_advances set status = 'deducted', updated_at = now()
      where is_fully_paid = true and cash_advances_id in (
        select distinct cap.cash_advances_id from cash_advance_payments cap where cap.report_period_id = $1
      )
    `, [periodId])

    await client.query('COMMIT')
    logAudit({ user_id: session.user_id, restaurant: period.restaurant, action: 'approve_payroll', table_name: 'payslips', record_id: String(periodId), new_data: { count: inserted.length } })
    return NextResponse.json({ ok: true, inserted_count: inserted.length })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('approve payroll error', err)
    return NextResponse.json({ error: 'Approve failed' }, { status: 500 })
  } finally {
    client.release()
  }
}
