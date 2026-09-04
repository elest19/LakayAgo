import { NextResponse } from 'next/server'
import supabaseServer from '../../../../lib/supabaseServer'
import getSessionFromRequest from '../../../../lib/session'
import { logAudit } from '../../../../lib/audit'

export async function GET(req: Request, context: any) {
  try {
    const { params } = await (context as any)
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const inventoryId = Number((await params).inventoryId)
    const { data, error } = await supabaseServer.from('inventory_display').select('*').eq('inventory_id', inventoryId).limit(1)
    if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 })
    const item = (data as any)[0]
    if (!item) return NextResponse.json({ inventory: null })
    if (session.role !== 'SuperAdmin' && item.restaurant !== session.restaurant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return NextResponse.json({ inventory: item })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(req: Request, context: any) {
  try {
    const { params } = await (context as any)
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const inventoryId = Number((await params).inventoryId)
    const body = await req.json()

    const { data: existingRows } = await supabaseServer.from('inventory').select('*').eq('inventory_id', inventoryId).limit(1)
    const existing = (existingRows as any)?.[0]
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (session.role !== 'SuperAdmin' && existing.restaurant !== session.restaurant) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const allowed: any = {}
    ;['kitchen_id','name','price','stock','category','is_archived','restaurant'].forEach(k => { if (k in body) allowed[k] = body[k] })

    const { data, error } = await supabaseServer.from('inventory').update(allowed).eq('inventory_id', inventoryId).select().limit(1)
    if (error) return NextResponse.json({ error: 'Database error' }, { status: 500 })

    const updated = (data as any)[0]
    logAudit({ user_id: session.user_id, restaurant: existing.restaurant, action: 'update_inventory', table_name: 'inventory', record_id: String(inventoryId), old_data: existing, new_data: updated })

    return NextResponse.json({ inventory: updated })
  } catch (err) {
    console.error('Inventory update error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
