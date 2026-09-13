import { NextResponse } from 'next/server'
import { query, getClient } from '../../../lib/db'
import getSessionFromRequest from '../../../lib/session'
import { logAudit } from '../../../lib/audit'

export async function GET(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const toRestaurant = url.searchParams.get('to_restaurant')
    const fromRestaurant = url.searchParams.get('from_restaurant')
    const dateFrom = url.searchParams.get('date_from')
    const dateTo = url.searchParams.get('date_to')

    const filters: string[] = []
    const params: any[] = []

    if (fromRestaurant) { params.push(fromRestaurant); filters.push(`f.restaurant = $${params.length}`) }
    if (toRestaurant) { params.push(toRestaurant); filters.push(`t.restaurant = $${params.length}`) }
    if (dateFrom) { params.push(dateFrom); filters.push(`pit.created_at >= $${params.length}`) }
    if (dateTo) { params.push(dateTo); filters.push(`pit.created_at <= $${params.length}`) }

    let text = `select pit.*, f.name as from_name, f.restaurant as from_restaurant, t.name as to_name, t.restaurant as to_restaurant, u.name as transferred_by_name
      from production_inventory_transfers pit
      join production_inventory f on f.production_inventory_id = pit.from_production_inventory_id
      join production_inventory t on t.production_inventory_id = pit.to_production_inventory_id
      left join users u on u.user_id = pit.transferred_by`

    if (filters.length) text += ` where ${filters.join(' and ')}`
    text += ' order by pit.created_at desc'

    const result = await query(text, params)
    return NextResponse.json({ transfers: result.rows })
  } catch (err) {
    console.error('GET /production_inventory_transfers failed:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { from_production_inventory_id, quantity } = body
    if (!from_production_inventory_id || !quantity) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const client = await getClient()
    try {
      await client.query('BEGIN')

      // validate source exists and belongs to Lakay Ago
      const fromRes = await client.query(`select * from production_inventory where production_inventory_id = $1 for update`, [from_production_inventory_id])
      if (fromRes.rows.length === 0) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Source not found' }, { status: 404 })
      }
      const fromRow = fromRes.rows[0]
      if (fromRow.restaurant !== 'Lakay Ago') {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Source must belong to Lakay Ago' }, { status: 400 })
      }

      const fromStock = Number(fromRow.stock || 0)
      if (Number(quantity) > fromStock) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Quantity exceeds source stock' }, { status: 400 })
      }

      // find or create corresponding Aroo item (by name + restaurant = 'Aroo')
      const name = fromRow.name
      let toId: number | null = null
      const toRes = await client.query(`select * from production_inventory where name = $1 and restaurant = 'Aroo' for update`, [name])
      if (toRes.rows.length > 0) {
        toId = toRes.rows[0].production_inventory_id
      } else {
        const insertRes = await client.query(
          `insert into production_inventory(name, unit, stock, is_archived, restaurant, recipe_unit, conversion_factor, ingredient_category)
           values($1, $2, 0, false, 'Aroo', $3, $4, $5)
           returning *`,
          [fromRow.name, fromRow.unit || null, fromRow.recipe_unit || null, fromRow.conversion_factor ?? null, fromRow.ingredient_category || null]
        )
        toId = insertRes.rows[0].production_inventory_id
      }

      // insert transfer row (trigger will move stock)
      const insertTransfer = await client.query(
        `insert into production_inventory_transfers(from_production_inventory_id, to_production_inventory_id, quantity, transferred_by) values($1,$2,$3,$4) returning *`,
        [from_production_inventory_id, toId, Number(quantity), session.user_id]
      )

      const created = insertTransfer.rows[0]

      await client.query('COMMIT')

      await logAudit({
        user_id: session.user_id,
        restaurant: 'Lakay Ago',
        action: 'transfer_production_inventory',
        table_name: 'production_inventory_transfers',
        record_id: String(created.transfer_id),
        old_data: { from: from_production_inventory_id, to: toId },
        new_data: created,
      })

      return NextResponse.json({ transfer: created })
    } catch (err) {
      try { await client.query('ROLLBACK') } catch (e) {}
      console.error('POST /production_inventory_transfers failed (transaction):', err)
      return NextResponse.json({ error: 'Server error' }, { status: 500 })
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('POST /production_inventory_transfers failed:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}