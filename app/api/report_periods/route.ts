import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../lib/session'
import { query } from '../../../lib/db'
import { logAudit } from '../../../lib/audit'

export async function GET(req: Request) {
  const session = getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ALL_RESTAURANTS = ['Lakay Ago', 'Aroo']

  const url = new URL(req.url)
  const qRestaurant = url.searchParams.get('restaurant')

  let text = `
    select
      report_period_id,
      restaurant,
      to_char(period_start, 'YYYY-MM-DD') as period_start,
      to_char(period_end, 'YYYY-MM-DD') as period_end,
      to_char(tabulation_date, 'YYYY-MM-DD') as tabulation_date,
      source_file,
      created_at,
      status,
      coalesce(is_special_month, false) as is_special_month
    from report_periods
  `
  const params: any[] = []

  if (session.role === 'SuperAdmin') {
    // SuperAdmin sees everything, unless they explicitly filter via query param
    if (qRestaurant) {
      params.push(qRestaurant)
      text += ` where restaurant = $${params.length}`
    }
  } else {
    // Admin: resolve their allowed restaurant(s)
    const allowedRestaurants =
      session.restaurant === 'Both' ? ALL_RESTAURANTS
      : session.restaurant ? [session.restaurant]
      : []

    if (allowedRestaurants.length === 0) {
      // No restaurant assigned — return nothing rather than leaking all rows
      return NextResponse.json({ periods: [] })
    }

    params.push(allowedRestaurants)
    text += ` where restaurant = ANY($${params.length})`
  }

  text += ' order by period_start desc'
  const { rows } = await query(text, params)

  return NextResponse.json({ periods: rows })
}

export async function POST(req: Request) {
  const session = getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { period_start, period_end, tabulation_date, source_file, restaurant } = body
  const restaurantValue = restaurant || session.restaurant || 'Both'
  if (!restaurantValue) return NextResponse.json({ error: 'Restaurant required' }, { status: 403 })

  const isSpecial = Boolean(body.is_special_month)
  const text = `insert into report_periods(restaurant, period_start, period_end, tabulation_date, source_file, is_special_month, created_at) values($1,$2,$3,$4,$5,$6, now()) returning *`
  const { rows } = await query(text, [restaurantValue, period_start, period_end, tabulation_date ?? null, source_file ?? null, isSpecial])
  const created = rows[0]
  logAudit({ user_id: session.user_id, restaurant: restaurantValue, action: 'create_report_period', table_name: 'report_periods', record_id: String(created.report_period_id), new_data: created })
  return NextResponse.json({ period: created })
}
