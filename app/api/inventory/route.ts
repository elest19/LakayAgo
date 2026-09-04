import { NextResponse } from 'next/server'
import supabaseServer from '../../../lib/supabaseServer'
import getSessionFromRequest from '../../../lib/session'
import { logAudit } from '../../../lib/audit'

export async function GET(req: Request) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const qRestaurant = url.searchParams.get('restaurant')

    let query = supabaseServer.from('inventory_display').select('*')
    if (session.role !== 'SuperAdmin') {
      query = query.eq('restaurant', session.restaurant)
    } else if (qRestaurant) {
      query = query.eq('restaurant', qRestaurant)
    }

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 })

    return NextResponse.json({ inventory: data })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { kitchen_id, name, price, stock, category, is_archived, restaurant } = body
    const restaurantValue = restaurant || session.restaurant || 'Both'

    if (category === 'Menu Item' && !kitchen_id) return NextResponse.json({ error: 'Menu Item must have kitchen_id' }, { status: 400 })
    if (price == null || Number(price) < 0) return NextResponse.json({ error: 'Invalid price' }, { status: 400 })

    const insert = {
      restaurant: restaurantValue,
      kitchen_id: kitchen_id ?? null,
      name: name ?? null,
      price: Number(price),
      stock: stock == null ? null : Number(stock),
      category,
      is_archived: Boolean(is_archived) || false,
    }

    const { data, error } = await supabaseServer.from('inventory').insert([insert]).select().limit(1)
    if (error) return NextResponse.json({ error: 'Database error', detail: error.message }, { status: 500 })

    const created = (data as any)[0]
    logAudit({ user_id: session.user_id, restaurant: restaurantValue, action: 'create_inventory', table_name: 'inventory', record_id: String(created.inventory_id), new_data: created })

    return NextResponse.json({ inventory: created })
  } catch (err) {
    console.error('Inventory create error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
