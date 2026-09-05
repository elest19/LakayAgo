import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../../lib/session'
import { query } from '../../../../lib/db'

export async function GET(req: Request, context: any) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { params } = await context
    const periodId = Number((await params).periodId)
    if (!Number.isFinite(periodId)) return NextResponse.json({ error: 'Invalid period id' }, { status: 400 })

    const url = new URL(req.url)
    const employeeId = url.searchParams.get('employee_id')

    // If filtering by employee, return that employee's attendance records for the period
    if (employeeId) {
      const text = `
        select
          a.attendance_id,
          to_char(a.work_date, 'YYYY-MM-DD') as work_date,
          a.first_on_duty,
          a.first_off_duty,
          a.second_on_duty,
          a.second_off_duty,
          a.late_minutes,
          a.leave_early_minutes,
          a.overtime_minutes,
          a.total_minutes,
          a.on_leave,
          a.is_absent,
          e.name as employee_name
        from attendance a
        join employees e on e.employee_id = a.employee_id
        where a.period_id = $1 and a.employee_id = $2
        order by a.work_date asc
      `
      const { rows } = await query(text, [periodId, Number(employeeId)])
      return NextResponse.json({ records: rows })
    }

    // Otherwise return the list of employees for this period with their record counts
    const text = `
      select
        a.employee_id,
        e.name as employee_name,
        e.department,
        e.source_employee_id,
        count(a.attendance_id) as records_count
      from attendance a
      join employees e on e.employee_id = a.employee_id
      where a.period_id = $1
      group by a.employee_id, e.name, e.department, e.source_employee_id
      order by e.name asc
    `
    const { rows } = await query(text, [periodId])
    const employees = rows.map((row: any) => ({
      employeeId: row.employee_id,
      employeeName: row.employee_name,
      department: row.department,
      sourceID: row.source_employee_id,
      recordsCount: Number(row.records_count) || 0,
    }))

    return NextResponse.json({ employees })
  } catch (err) {
    console.error('Failed to load import detail', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}