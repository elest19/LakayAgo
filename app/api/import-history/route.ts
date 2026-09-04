import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../lib/session'
import { query } from '../../../lib/db'

export async function GET(req: Request) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const qRestaurant = url.searchParams.get('restaurant')

    const ALL_RESTAURANTS = ['Lakay Ago', 'Aroo']

    let text = `
      select
        rp.report_period_id,
        rp.restaurant,
        rp.period_start,
        rp.period_end,
        rp.tabulation_date,
        rp.source_file,
        rp.created_at,
        rp.status,
        count(a.attendance_id) as records_count,
        count(distinct a.employee_id) as employees_count
      from report_periods rp
      left join attendance a
        on a.period_id = rp.report_period_id
        and a.restaurant = rp.restaurant
    `
    const params: any[] = []

    if (session.role === 'SuperAdmin') {
      if (qRestaurant) {
        params.push(qRestaurant)
        text += ` where rp.restaurant = $${params.length}`
      }
    } else {
      const allowedRestaurants =
        session.restaurant === 'Both' ? ['Lakay Ago', 'Aroo']
        : session.restaurant ? [session.restaurant]
        : []

      if (allowedRestaurants.length === 0) {
        return NextResponse.json({ imports: [] })
      }

      params.push(allowedRestaurants)
      text += ` where rp.restaurant = ANY($${params.length})`
    }

    text += `
      group by rp.report_period_id, rp.restaurant, rp.period_start, rp.period_end, rp.tabulation_date, rp.source_file, rp.created_at, rp.status
      order by rp.period_start desc
    `

    const { rows } = await query(text, params)

    const imports = rows.map((row: any) => ({
      id: row.report_period_id,
      dateImported: row.created_at ? new Date(row.created_at).toLocaleString() : '',
      fileName: row.source_file || '',
      records: Number(row.records_count) || 0,
      employees: Number(row.employees_count) || 0,
      importedBy: row.restaurant || 'system',
      status: row.status || 'Unknown',
      periodStart: row.period_start,
      periodEnd: row.period_end,
    }))

    return NextResponse.json({ imports })
  } catch (err) {
    console.error('Failed to load import history', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}