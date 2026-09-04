import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../lib/session'
import { query } from '../../../lib/db'

export async function GET(req: Request) {
  const session = getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const periodId = url.searchParams.get('period_id')
  const qRestaurant = url.searchParams.get('restaurant')

  // join employees to provide display fields (employees.name => employee_name)
  let text = `select p.*, e.name as employee_name, e.department from payslips p left join employees e on e.employee_id = p.employee_id`
  const params: any[] = []
  const where: string[] = []

  // Determine restaurant filter: explicit query param wins; otherwise restrict by session.restaurant unless it's 'Both'
  const restaurantToFilter = qRestaurant || session.restaurant
  if (restaurantToFilter && restaurantToFilter !== 'Both') {
    params.push(restaurantToFilter)
    where.push(`p.restaurant = $${params.length}`)
  }

  if (periodId) {
    const pid = Number(periodId)
    if (Number.isFinite(pid)) {
      params.push(pid)
      where.push(`p.report_period_id = $${params.length}`)
    }
  }

  if (where.length) text += ' where ' + where.join(' and ')
  text += ' order by employee_name'

  try {
    const { rows } = await query(text, params)
    // query executed
    return NextResponse.json({ payslips: rows })
  } catch (err) {
    console.error('payslips fetch error', err)
    console.error('payslips: query', text, 'params', params)
    return NextResponse.json({ error: 'Failed to fetch payslips' }, { status: 500 })
  }
}
