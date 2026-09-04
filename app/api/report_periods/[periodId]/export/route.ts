import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../../../lib/session'
import { query } from '../../../../../lib/db'
import ExcelJS from 'exceljs'

export async function GET(req: Request, context: any) {
  const session = getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { periodId } = await context.params

  const { rows: periodRows } = await query('select * from report_periods where report_period_id = $1 limit 1', [Number(periodId)])
  const period = periodRows[0]
  if (!period) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (session.role !== 'SuperAdmin' && period.restaurant !== session.restaurant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let rows
  if (period.restaurant && String(period.restaurant).toLowerCase() !== 'both') {
    const q = `select p.*, e.name as employee_name from payslips p left join employees e on e.employee_id = p.employee_id where p.report_period_id = $1 and p.restaurant = $2 order by p.employee_id`
    const res = await query(q, [Number(periodId), period.restaurant])
    rows = res.rows
  } else {
    const q = `select p.*, e.name as employee_name from payslips p left join employees e on e.employee_id = p.employee_id where p.report_period_id = $1 order by p.employee_id`
    const res = await query(q, [Number(periodId)])
    rows = res.rows
  }

  const headers = [
    'report_period_id', 'restaurant', 'employee_id', 'employee_name',
    'base_pay','overtime_pay','halfday_pay','holiday_pay','gross_pay',
    'sss_deduction','philhealth_deduction','pagibig_deduction','undertime_deduction','late_deduction','cash_advance_deduction','total_deduction','net_pay','status'
  ]

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Payroll')
  sheet.addRow(headers)

  for (const r of rows) {
    const vals = headers.map(h => r[h])
    sheet.addRow(vals)
  }

  // Auto width for columns
  sheet.columns.forEach((col) => {
    let max = 10
    col.eachCell({ includeEmpty: true }, (cell: any) => {
      const v = cell.value ? String(cell.value) : ''
      if (v.length > max) max = v.length
    })
    col.width = Math.min(50, max + 2)
  })

  const buffer = await workbook.xlsx.writeBuffer()

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="payroll-${periodId}.xlsx"`,
    },
  })
}
