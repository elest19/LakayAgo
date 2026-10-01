import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../lib/session'
import { query } from '../../../lib/db'
import { logAudit } from '../../../lib/audit'

export async function GET(req: Request) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ALL_RESTAURANTS = ['Lakay Ago', 'Aroo']

  const url = new URL(req.url)

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
      coalesce(is_sss_enabled, true) as is_sss_enabled,
      coalesce(is_philhealth_enabled, true) as is_philhealth_enabled,
      coalesce(is_pagibig_enabled, true) as is_pagibig_enabled
    from report_periods
  `
  const params: any[] = []

  if (session.role === 'Admin') {
    if (session.restaurant && session.restaurant !== 'Both') {
      params.push(session.restaurant)
      text += ` where restaurant = $${params.length}`
    }
  } else {
    const allowedRestaurants =
      session.restaurant === 'Both' ? ALL_RESTAURANTS
      : session.restaurant ? [session.restaurant]
      : []

    if (allowedRestaurants.length === 0) {
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
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { period_start, period_end, tabulation_date, source_file, restaurant } = body
  const restaurantValue = restaurant || session.restaurant || 'Both'
  if (!restaurantValue) return NextResponse.json({ error: 'Restaurant required' }, { status: 403 })
  const isSss = body.is_sss_enabled === undefined ? true : Boolean(body.is_sss_enabled)
  const isPhil = body.is_philhealth_enabled === undefined ? true : Boolean(body.is_philhealth_enabled)
  const isPagibig = body.is_pagibig_enabled === undefined ? true : Boolean(body.is_pagibig_enabled)
  const text = `insert into report_periods(restaurant, period_start, period_end, tabulation_date, source_file, is_sss_enabled, is_philhealth_enabled, is_pagibig_enabled, created_at) values($1,$2,$3,$4,$5,$6,$7,$8, now()) returning *`
  const { rows } = await query(text, [restaurantValue, period_start, period_end, tabulation_date ?? null, source_file ?? null, isSss, isPhil, isPagibig])
  const created = rows[0]
  logAudit({ user_id: session.user_id, restaurant: restaurantValue, action: 'create_report_period', table_name: 'report_periods', record_id: String(created.report_period_id), new_data: created })
  return NextResponse.json({ period: created })
}
