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

    async function hasPayrollSettingsSpecialMonthPayColumn() {
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

    const [hasSpecialMonthPay, attendanceSettingsResult] = await Promise.all([
      hasPayrollSettingsSpecialMonthPayColumn(),
      query('SELECT * FROM attendance_settings ORDER BY updated_at DESC LIMIT 1'),
    ])

    const payrollSettingsQuery = hasSpecialMonthPay
      ? 'SELECT * FROM payroll_settings ORDER BY updated_at DESC LIMIT 1'
      : 'SELECT id, undertime_deduction, undertime_deduction_rate_type, undertime_deduction_rate, NULL::date AS special_month_pay, created_at, updated_at FROM payroll_settings ORDER BY updated_at DESC LIMIT 1'
    const payrollSettingsResult = await query(payrollSettingsQuery)

    const payrollSettings = payrollSettingsResult.rows[0] || {
      undertime_deduction: 0,
      undertime_deduction_rate_type: 'Hour',
      undertime_deduction_rate: 1,
      special_month_pay: null,
    }
    const attendanceSettings = attendanceSettingsResult.rows[0] || {
      required_daily_hours: 8,
    }

    const employeeRestaurant = period.restaurant ?? session.restaurant ?? 'Both'

    const rawLimit = url.searchParams.get('limit')
    const rawOffset = url.searchParams.get('offset')
    const hasPagination = rawLimit !== null || rawOffset !== null
    const parsedLimit = rawLimit !== null ? Number(rawLimit) : null
    const parsedOffset = rawOffset !== null ? Number(rawOffset) : 0
    const limit = hasPagination
      ? Number.isFinite(parsedLimit) && Number(parsedLimit) > 0 ? Math.min(Math.floor(Number(parsedLimit)), 500) : 50
      : null
    const offset = hasPagination && Number.isFinite(parsedOffset) && Number(parsedOffset) >= 0
      ? Math.floor(Number(parsedOffset))
      : 0

    // TODO: update the frontend to pass pagination params once this ships.
    const employeeWhere = 'WHERE restaurant = $1'
    const employeeCountQuery = `SELECT COUNT(*)::int AS count FROM employees ${employeeWhere}`
    const employeeQuery = `SELECT employee_id, name, department, pay_per_day, sss, philhealth, pagibig, month_pay_13th, restaurant
       FROM employees
       ${employeeWhere}${limit !== null ? ' LIMIT $2 OFFSET $3' : ''}`

    const [employeeCountResult, employeeRowsResult] = await Promise.all([
      query(employeeCountQuery, [employeeRestaurant]),
      query(employeeQuery, limit !== null ? [employeeRestaurant, limit, offset] : [employeeRestaurant]),
    ])

    const employeeRows = employeeRowsResult.rows
    const totalEmployeeCount = Number(employeeCountResult.rows[0]?.count ?? 0)

    // batched across all employees to avoid N+1 queries for the same period data
    const holidayMapByDate: Record<string, string> = {}
    const { rows: holidayRows } = await query(
      'SELECT date, type FROM holidays WHERE date >= $1 AND date <= $2 AND active = true',
      [period.period_start, period.period_end],
    )
    for (const h of holidayRows) {
      const key = new Date(h.date).toISOString().slice(0, 10)
      holidayMapByDate[key] = String(h.type)
    }

    const employeeIds = employeeRows.map((employee: any) => employee.employee_id)
    const attendanceByEmployee = new Map<string, any[]>()
    if (employeeIds.length > 0) {
      // batched across all employees to avoid N+1 attendance fetches
      const { rows: attendanceRows } = await query(
        'SELECT * FROM attendance WHERE employee_id = ANY($1) AND work_date >= $2 AND work_date <= $3 ORDER BY employee_id, work_date',
        [employeeIds, period.period_start, period.period_end],
      )
      for (const attendanceRow of attendanceRows) {
        const key = String(attendanceRow.employee_id)
        const current = attendanceByEmployee.get(key) ?? []
        current.push(attendanceRow)
        attendanceByEmployee.set(key, current)
      }
    }

    const approvedLeaveByEmployee = new Map<string, any[]>()
    if (employeeIds.length > 0) {
      // batched across all employees to avoid N+1 leave requests fetches
      const { rows: approvedLeaveRows } = await query(
        `select lr.employee_id, lr.start_date, lr.end_date, coalesce(lt.is_paid, false) as is_paid
         from leave_requests lr
         left join leave_types lt on lt.leave_type_id = lr.leave_type_id
         where lr.employee_id = ANY($1) and lr.status = 'Approved' and lr.start_date <= $2 and lr.end_date >= $3`,
        [employeeIds, period.period_end, period.period_start],
      )
      for (const leaveRow of approvedLeaveRows) {
        const key = String(leaveRow.employee_id)
        const current = approvedLeaveByEmployee.get(key) ?? []
        current.push(leaveRow)
        approvedLeaveByEmployee.set(key, current)
      }
    }

    const rows: any[] = []
    const specialMonthPayRaw = payrollSettings.special_month_pay
    const specialMonthPayText = specialMonthPayRaw instanceof Date
      ? specialMonthPayRaw.toISOString().slice(0, 10)
      : String(specialMonthPayRaw ?? '').slice(0, 10)
    const periodStartDate = new Date(`${String(period.period_start).slice(0, 10)}T00:00:00Z`)
    const periodEndDate = new Date(`${String(period.period_end).slice(0, 10)}T00:00:00Z`)
    const specialMonthDate = specialMonthPayText && /^\d{4}-\d{2}-\d{2}$/.test(specialMonthPayText)
      ? new Date(`${specialMonthPayText}T00:00:00Z`)
      : null
    const specialMonthInPeriod = specialMonthDate
      ? specialMonthDate >= periodStartDate && specialMonthDate <= periodEndDate
      : false

    for (const employee of employeeRows) {
      const attendanceRowsForEmployee = attendanceByEmployee.get(String(employee.employee_id)) ?? []
      const payPerDay = toNumber(employee.pay_per_day, 0)
      const specialMonthPay = specialMonthInPeriod ? toNumber(employee.month_pay_13th, 0) : 0
      const leaveDateMap = new Map<string, boolean>()
      const approvedLeaveRowsForEmployee = approvedLeaveByEmployee.get(String(employee.employee_id)) ?? []
      for (const leave of approvedLeaveRowsForEmployee) {
        const start = new Date(leave.start_date)
        const end = new Date(leave.end_date)
        for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
          const key = new Date(cursor).toISOString().slice(0, 10)
          leaveDateMap.set(key, Boolean(leave.is_paid))
        }
      }

      let absentTotal = 0
      let presentTotal = 0
      let onLeaveTotal = 0
      let halfdayTotal = 0
      let lateMinutesTotal = 0
      let workedMinutesTotal = 0
      let overtimeMinutesTotal = 0
      let undertimeMinutesTotal = 0
      let holidayPay = 0
      let halfdayPayment = 0
      let paidLeavePay = 0

      for (const a of attendanceRowsForEmployee) {
        const isAbsent = Boolean(a.is_absent)
        const isOnLeave = Boolean(a.on_leave)
        const isHalfday = Boolean(a.is_halfday)
        const workDateKey = new Date(a.work_date).toISOString().slice(0, 10)
        const isHoliday = Boolean(holidayMapByDate[workDateKey])

        if (isOnLeave) {
          const leaveIsPaid = leaveDateMap.get(workDateKey) ?? false
          if (leaveIsPaid) {
            onLeaveTotal += 1
            paidLeavePay += payPerDay
          }
        } else if (isAbsent) {
          absentTotal += 1
        } else {
          const dow = new Date(a.work_date).getDay()
          const firstOn = a.first_on_duty
          const firstOff = a.first_off_duty
          if (!(dow === 0 || dow === 6) || firstOn !== null || firstOff !== null) {
            presentTotal += 1
          }
        }

        if (!isAbsent && !isOnLeave && !isHalfday) {
          lateMinutesTotal += toNumber(a.late_minutes, 0)
          undertimeMinutesTotal += toNumber(a.leave_early_minutes, 0)
        }

        if (isOnLeave) {
          // leave days are excluded from normal gross_base and absence counts; paid leave is accounted under paid_leave_pay
        } else if (!isAbsent && isHoliday) {
          const htype = String(holidayMapByDate[workDateKey])
          const baseAmount = isHalfday ? (payPerDay / 2) : payPerDay
          let dayHolidayPay = 0
          if (htype === 'REGULAR') {
            dayHolidayPay = baseAmount * 2
          } else if (htype === 'SPECIAL' || htype === 'SPECIAL_NON_WORKING') {
            dayHolidayPay = baseAmount * 0.3
          } else {
            dayHolidayPay = baseAmount * 0.3
          }
          holidayPay += dayHolidayPay
        } else if (!isAbsent && isHalfday && !isHoliday) {
          halfdayTotal += 1
          halfdayPayment += payPerDay / 2
        } else if (!isAbsent && !isHalfday && !isHoliday) {
          workedMinutesTotal += toNumber(a.total_minutes, 0)
        }

        if (!isAbsent && !isOnLeave && !isHalfday) {
          overtimeMinutesTotal += toNumber(a.overtime_minutes, 0)
        }
      }

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

      const grossPay = grossBase + halfdayPayment + overtimePay + holidayPay + paidLeavePay + specialMonthPay
      const attendanceDeduction = sumLateMin + undertimeDeductionTotal
      const totalDeduction = attendanceDeduction + healthDeduction
      const netPay = grossPay - totalDeduction

      rows.push({
        employee_id: employee.employee_id,
        employee_name: employee.name,
        pay_per_day: payPerDay,
        present_total: presentTotal,
        absent_total: absentTotal,
        on_leave_total: onLeaveTotal,
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
        paid_leave_pay: paidLeavePay,
        special_month: specialMonthPay,
        special_month_pay: specialMonthPay,
        halfday_payment: halfdayPayment,
        holiday_pay: holidayPay,
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
      count: totalEmployeeCount,
    })
  } catch (error) {
    console.error('payroll calculate failed', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
