import { NextResponse } from 'next/server'
import supabaseServer from '../../../lib/supabaseServer'
import getSessionFromRequest from '../../../lib/session'
import { logAudit } from '../../../lib/audit'

export async function GET(req: Request) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const qRestaurant = url.searchParams.get('restaurant_id')

    let query = supabaseServer.from('sales').select('*')
    if (session.role !== 'SuperAdmin') {
      query = query.eq('restaurants_id', session.restaurant_id)
    } else if (qRestaurant) {
      query = query.eq('restaurants_id', Number(qRestaurant))
    }

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 })

    return NextResponse.json({ sales: data })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const rows = body.sales
    if (!rows || !Array.isArray(rows)) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })

    const restaurantId = session.restaurant_id
    if (!restaurantId) return NextResponse.json({ error: 'Restaurant context required' }, { status: 403 })
    // Call DB-side RPC which performs an atomic insert of sales, stock transactions, and an audit log.
    const { data, error } = await supabaseServer.rpc('create_sales_with_stock_transactions', {
      p_restaurant_id: restaurantId,
      p_sales: rows,
      p_user_id: session.user_id,
      p_performed_by: String(session.user_id)
    })

    if (error) {
      console.error('RPC create_sales_with_stock_transactions failed', error)
      return NextResponse.json({ error: 'Database error', detail: error.message }, { status: 500 })
    }

    return NextResponse.json({ result: data })
  } catch (err) {
    console.error('Sales create error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
