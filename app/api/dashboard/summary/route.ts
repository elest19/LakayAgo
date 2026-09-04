import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../../lib/session'
import { query } from '../../../../lib/db'

export async function GET(req: Request) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const qRestaurant = url.searchParams.get('restaurant')

    let restaurantFilter = qRestaurant
    if (!restaurantFilter && session.role === 'SuperAdmin') {
      restaurantFilter = null
    }

    if (!restaurantFilter) return NextResponse.json({ monthlyPayrollData: [], deptPayrollData: [], overtimeData: [] })

    // Monthly payroll approximation: sum pay_per_day / 2 per period
    const { rows: monthlyRows } = await query(
      `select rp.report_period_id, rp.period_start, coalesce(sum(e.pay_per_day::numeric)/2,0) as gross
       from report_periods rp
       left join employees e on e.restaurant = rp.restaurant
       where rp.restaurant = $1
       group by rp.report_period_id, rp.period_start
       order by rp.period_start desc
       limit 6`,
      [restaurantFilter]
    )

    const monthlyPayrollData = (monthlyRows || []).map((r: any) => ({
      month: new Date(r.period_start).toLocaleString('en-US', { month: 'short' }),
      gross: Math.round(Number(r.gross) || 0),
      net: Math.round((Number(r.gross) || 0) * 0.85),
    })).reverse()

    // Department payroll: group employees by department
    const { rows: deptRows } = await query(
      `select coalesce(department, 'Unassigned') as dept, count(*) as employees, coalesce(sum(pay_per_day::numeric)/2,0) as grossPay
       from employees
       where restaurant = $1
       group by coalesce(department, 'Unassigned')
       order by grossPay desc
       limit 12`,
      [restaurantFilter]
    )

    const deptPayrollData = (deptRows || []).map((r: any) => {
      const gross = Math.round(Number(r.grosspay) || 0)
      const deductions = Math.round(gross * 0.1)
      return { dept: r.dept, employees: Number(r.employees || 0), grossPay: gross, deductions, netPay: gross - deductions }
    })

    // Overtime-like data: sum total_minutes from attendance per period -> hours
    const { rows: otRows } = await query(
      `select rp.report_period_id, rp.period_start, coalesce(sum(a.total_minutes),0) as total_minutes
       from report_periods rp
       left join attendance a on a.period_id = rp.report_period_id
       where rp.restaurant = $1
       group by rp.report_period_id, rp.period_start
       order by rp.period_start desc
       limit 6`,
      [restaurantFilter]
    )

    const overtimeData = (otRows || []).map((r: any) => ({
      month: new Date(r.period_start).toLocaleString('en-US', { month: 'short' }),
      hours: Math.round((Number(r.total_minutes) || 0) / 60),
    })).reverse()

    return NextResponse.json({ monthlyPayrollData, deptPayrollData, overtimeData })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
