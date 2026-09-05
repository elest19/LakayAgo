import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../../lib/session'
import { getClient } from '../../../../lib/db'
import { logAudit } from '../../../../lib/audit'

function normalizePayrollRow(row: any) {
  const employeeId = Number(row?.employee_id)
  if (!Number.isFinite(employeeId) || employeeId <= 0) {
    throw new Error('Each payroll row must include a valid employee_id')
  }

  const basePay = Math.max(0, Number(row?.gross_base ?? row?.base_pay ?? 0))
  const overtimePay = Math.max(0, Number(row?.overtime_pay ?? 0))
  const halfdayPay = Math.max(0, Number(row?.halfday_payment ?? 0))
  const holidayPay = Math.max(0, Number(row?.holiday_pay ?? 0))
  const paidLeavePay = Math.max(0, Number(row?.paid_leave_pay ?? 0))
  const grossPay = Math.max(0, Number(row?.gross_pay ?? basePay + overtimePay + halfdayPay + holidayPay + paidLeavePay))

  const sss = Math.max(0, Number(row?.sss_deduction ?? 0))
  const philhealth = Math.max(0, Number(row?.philhealth_deduction ?? 0))
  const pagibig = Math.max(0, Number(row?.pagibig_deduction ?? 0))
  const undertime = Math.max(0, Number(row?.undertime_deduction_total ?? row?.undertime_deduction ?? 0))
  const late = Math.max(0, Number(row?.late_deduction ?? row?.sum_late_min ?? 0))
  const cashAdvance = Math.max(0, Number(row?.cash_advance_deduction ?? 0))

  const totalDeduction = Number((sss + philhealth + pagibig + undertime + late + cashAdvance).toFixed(2))
  const netPay = (row?.net_pay_overridden === true) && (typeof row?.net_pay === 'number' || !Number.isNaN(Number(row?.net_pay)))
    ? Number(row.net_pay)
    : Number((grossPay - totalDeduction).toFixed(2))

  return {
    employee_id: employeeId,
    base_pay: Number(basePay.toFixed(2)),
    overtime_pay: Number(overtimePay.toFixed(2)),
    halfday_pay: Number(halfdayPay.toFixed(2)),
    holiday_pay: Number(holidayPay.toFixed(2)),
    paid_leave_pay: Number(paidLeavePay.toFixed(2)),
    gross_pay: Number(grossPay.toFixed(2)),
    sss_deduction: Number(sss.toFixed(2)),
    philhealth_deduction: Number(philhealth.toFixed(2)),
    pagibig_deduction: Number(pagibig.toFixed(2)),
    undertime_deduction: Number(undertime.toFixed(2)),
    late_deduction: Number(late.toFixed(2)),
    cash_advance_deduction: Number(cashAdvance.toFixed(2)),
    total_deduction: Number(totalDeduction.toFixed(2)),
    net_pay: Number(netPay.toFixed(2)),
  }
}

export async function POST(req: Request) {
  const session = getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const periodId = Number(body.period_id)
  const rows = Array.isArray(body.rows) ? body.rows : []
  if (!Number.isFinite(periodId)) return NextResponse.json({ error: 'Missing period_id' }, { status: 400 })
  if (rows.length === 0) return NextResponse.json({ error: 'No payroll rows provided' }, { status: 400 })

  const client = await getClient()
  try {
    await client.query('BEGIN')

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

    const insertText = `
      insert into payslips(
        report_period_id, restaurant, employee_id,
        base_pay, overtime_pay, halfday_pay, holiday_pay, paid_leave_pay, gross_pay,
        sss_deduction, philhealth_deduction, pagibig_deduction,
        undertime_deduction, late_deduction, cash_advance_deduction,
        total_deduction, net_pay, status
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) returning *
    `

    const inserted: any[] = []
    for (const rawRow of rows) {
      const row = normalizePayrollRow(rawRow)
      const params = [
        periodId,
        period.restaurant,
        row.employee_id,
        row.base_pay,
        row.overtime_pay,
        row.halfday_pay,
        row.holiday_pay,
        row.paid_leave_pay,
        row.gross_pay,
        row.sss_deduction,
        row.philhealth_deduction,
        row.pagibig_deduction,
        row.undertime_deduction,
        row.late_deduction,
        row.cash_advance_deduction,
        row.total_deduction,
        row.net_pay,
        'released'
      ]

      const { rows: createdRows } = await client.query(insertText, params)
      inserted.push(createdRows[0])
    }

    await client.query('update report_periods set status = $1 where report_period_id = $2', ['released', periodId])

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
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Approve failed' }, { status: 500 })
  } finally {
    client.release()
  }
}
