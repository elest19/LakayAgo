import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../../lib/session'
import { query } from '../../../../lib/db'

function toNumber(value: unknown, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

export async function GET(req: Request) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const rawPeriodId = url.searchParams.get('period_id')
    const periodNumber = Number(rawPeriodId)

    if (!rawPeriodId || !Number.isFinite(periodNumber)) {
      return NextResponse.json({ error: 'period_id must be a valid number' }, { status: 400 })
    }

    const { rows: periodRows } = await query(
      'select * from report_periods where report_period_id = $1 limit 1',
      [periodNumber],
    )
    const period = periodRows[0]
    if (!period) return NextResponse.json({ error: 'Period not found' }, { status: 404 })

    if (session.role !== 'SuperAdmin' && period.restaurant !== session.restaurant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { rows: payrollRows } = await query(
      'SELECT * FROM payroll_settings ORDER BY updated_at DESC LIMIT 1',
    )
    const payrollSettings = payrollRows[0] || {
      undertime_deduction: 0,
      undertime_deduction_rate_type: 'Hour',
      undertime_deduction_rate: 1,
    }

    const { rows: attendanceRows } = await query(
      'SELECT * FROM attendance_settings ORDER BY updated_at DESC LIMIT 1',
    )
    const attendanceSettings = attendanceRows[0] || {
      required_daily_hours: 8,
    }

    const employeeRestaurant = period.restaurant ?? session.restaurant ?? 'Both'
    const { rows: employeeRows } = await query(
      `SELECT employee_id, name, department, pay_per_day, sss, philhealth, pagibig, restaurant
       FROM employees
       WHERE restaurant = $1`,
      [employeeRestaurant],
    )

    const rows: any[] = []

    for (const employee of employeeRows) {
      const { rows: attendanceSummary } = await query(
        `SELECT
          count(*) FILTER (WHERE is_absent = true) AS absent_total,
          -- present_total: exclude weekend rows (Sat/Sun) that have no on/off duty times
          count(*) FILTER (
            WHERE is_absent = false
              AND NOT (
                extract(dow from work_date) IN (0, 6)
                AND first_on_duty IS NULL
                AND first_off_duty IS NULL
              )
          ) AS present_total,
          count(*) FILTER (WHERE is_halfday = true) AS halfday_total,
          coalesce(sum(late_minutes) FILTER (WHERE is_absent = false AND is_halfday = false), 0) AS late_minutes_total,
          coalesce(sum(total_minutes) FILTER (WHERE is_absent = false AND is_halfday = false), 0) AS worked_minutes_total,
          coalesce(sum(overtime_minutes) FILTER (WHERE is_absent = false AND is_halfday = false), 0) AS overtime_minutes_total,
          coalesce(sum(leave_early_minutes) FILTER (WHERE is_absent = false AND is_halfday = false AND leave_early_minutes > 0), 0) AS undertime_minutes_total
        FROM attendance
        WHERE employee_id = $1
          AND work_date >= $2
          AND work_date <= $3`,
        [employee.employee_id, period.period_start, period.period_end],
      )

      const summary = attendanceSummary[0] || {}
      const payPerDay = toNumber(employee.pay_per_day, 0)
      const absentTotal = toNumber(summary.absent_total, 0)
      const presentTotal = toNumber(summary.present_total, 0)
      const halfdayTotal = toNumber(summary.halfday_total, 0)
      const lateMinutesTotal = toNumber(summary.late_minutes_total, 0)
      const workedMinutesTotal = toNumber(summary.worked_minutes_total, 0)
      const overtimeMinutesTotal = toNumber(summary.overtime_minutes_total, 0)
      const undertimeMinutesTotal = toNumber(summary.undertime_minutes_total, 0)

      const halfdayPayment = halfdayTotal * (payPerDay / 2)
      const sumLateMin = (lateMinutesTotal / 15) * 50
      const undertimeDeductionRateType = String(payrollSettings.undertime_deduction_rate_type || 'Hour').trim()
      const undertimeDeductionRate = toNumber(payrollSettings.undertime_deduction_rate, 0)
      const rateInMinutes = undertimeDeductionRateType === 'Minute' ? undertimeDeductionRate : undertimeDeductionRate * 60
      const undertimeDeductionTotal = rateInMinutes > 0 ? (undertimeMinutesTotal / rateInMinutes) * toNumber(payrollSettings.undertime_deduction, 0) : 0
      const requiredDailyMinutes = (toNumber(attendanceSettings.required_daily_hours, 8) || 8) * 60
      const grossBase = requiredDailyMinutes > 0 ? (workedMinutesTotal / requiredDailyMinutes) * payPerDay : 0
      const overtimePay = (overtimeMinutesTotal / 60) * (payPerDay / 8)
      const healthDeduction =
        toNumber(employee.sss, 0) +
        toNumber(employee.philhealth, 0) +
        toNumber(employee.pagibig, 0)

      const grossPay = grossBase + halfdayPayment + overtimePay
      const attendanceDeduction = sumLateMin + undertimeDeductionTotal
      const totalDeduction = attendanceDeduction + healthDeduction
      const netPay = grossPay - totalDeduction

      rows.push({
        employee_id: employee.employee_id,
        employee_name: employee.name,
        pay_per_day: payPerDay,
        present_total: presentTotal,
        absent_total: absentTotal,
        halfday_total: halfdayTotal,
        worked_minutes_total: workedMinutesTotal,
        late_minutes_total: lateMinutesTotal,
        overtime_minutes_total: overtimeMinutesTotal,
        undertime_minutes_total: undertimeMinutesTotal,
        required_daily_minutes: requiredDailyMinutes,
        required_daily_hours: toNumber(attendanceSettings.required_daily_hours, 8) || 8,
        rate_in_minutes: rateInMinutes,
        undertime_deduction_rate_type: undertimeDeductionRateType,
        undertime_deduction: toNumber(payrollSettings.undertime_deduction, 0),
        undertime_deduction_rate: undertimeDeductionRate,
        deductions: totalDeduction,
        net_pay: netPay,
        gross_pay: grossPay,
        halfday_payment: halfdayPayment,
        attendance_deduction: attendanceDeduction,
        total_deduction: totalDeduction,
        health_deduction: healthDeduction,
        sss_deduction: toNumber(employee.sss, 0),
        philhealth_deduction: toNumber(employee.philhealth, 0),
        pagibig_deduction: toNumber(employee.pagibig, 0),
        sum_late_min: sumLateMin,
        undertime_deduction_total: undertimeDeductionTotal,
        gross_base: grossBase,
        overtime_pay: overtimePay,
        employee_department: employee.department || '',
      })
    }

    return NextResponse.json({
      period,
      rows,
      payroll: rows,
    })
  } catch (error) {
    console.error('payroll calculate failed', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
