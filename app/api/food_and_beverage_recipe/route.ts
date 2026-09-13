import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'
import getSessionFromRequest from '../../../lib/session'
import { logAudit } from '../../../lib/audit'

export async function GET(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const fbId = url.searchParams.get('food_and_beverage_id')
    const params: any[] = []
    let text = 'select * from food_and_beverage_recipe'
    if (fbId) {
      text += ' where food_and_beverage_id = $1'
      params.push(Number(fbId))
    }
    text += ' order by recipe_id asc'

    const result = await query(text, params)
    return NextResponse.json({ recipe: result.rows })
  } catch (err) {
    console.error('GET /food_and_beverage_recipe failed:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { food_and_beverage_id, production_inventory_id, quantity_required } = body
    if (!food_and_beverage_id || !production_inventory_id || quantity_required === undefined || quantity_required === null) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const dupCheck = await query(`select * from food_and_beverage_recipe where food_and_beverage_id = $1 and production_inventory_id = $2 limit 1`, [Number(food_and_beverage_id), Number(production_inventory_id)])
    if (dupCheck.rows.length > 0) return NextResponse.json({ error: 'Duplicate recipe row' }, { status: 409 })

    const result = await query(`insert into food_and_beverage_recipe(food_and_beverage_id, production_inventory_id, quantity_required) values($1,$2,$3) returning *`, [Number(food_and_beverage_id), Number(production_inventory_id), Number(quantity_required)])

    const created = result.rows[0]
    logAudit({ user_id: session.user_id, restaurant: null, action: 'create_recipe', table_name: 'food_and_beverage_recipe', record_id: String(created.recipe_id), new_data: created })
    return NextResponse.json({ recipe: created })
  } catch (err) {
    console.error('POST /food_and_beverage_recipe failed:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { recipe_id, production_inventory_id, quantity_required } = body
    if (!recipe_id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const updates: any[] = []
    const setParts: string[] = []
    let idx = 1
    if (production_inventory_id !== undefined) { setParts.push(`production_inventory_id = $${idx++}`); updates.push(Number(production_inventory_id)) }
    if (quantity_required !== undefined) { setParts.push(`quantity_required = $${idx++}`); updates.push(Number(quantity_required)) }
    if (setParts.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    updates.push(recipe_id)

    const result = await query(`update food_and_beverage_recipe set ${setParts.join(', ')} where recipe_id = $${idx} returning *`, updates)
    if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = result.rows[0]
    logAudit({ user_id: session.user_id, restaurant: null, action: 'update_recipe', table_name: 'food_and_beverage_recipe', record_id: String(recipe_id), new_data: updated })
    return NextResponse.json({ recipe: updated })
  } catch (err) {
    console.error('PUT /food_and_beverage_recipe failed:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const result = await query(`delete from food_and_beverage_recipe where recipe_id = $1 returning *`, [id])
    if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const deleted = result.rows[0]
    logAudit({ user_id: session.user_id, restaurant: null, action: 'delete_recipe', table_name: 'food_and_beverage_recipe', record_id: String(id), old_data: deleted })
    return NextResponse.json({ recipe: deleted })
  } catch (err) {
    console.error('DELETE /food_and_beverage_recipe failed:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}