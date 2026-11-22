import { NextResponse } from 'next/server'
import { query, getClient } from '../../../lib/db'
import getSessionFromRequest from '../../../lib/session'
import { logAudit } from '../../../lib/audit'
import { isLocation } from '../../../lib/locations'

export async function GET(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const toLocation = url.searchParams.get('to_location')
    const fromLocation = url.searchParams.get('from_location')
    const dateFrom = url.searchParams.get('date_from')
    const dateTo = url.searchParams.get('date_to')

    const filters: string[] = []
    const params: any[] = []

    if (fromLocation) { params.push(fromLocation); filters.push(`f.location = $${params.length}`) }
    if (toLocation) { params.push(toLocation); filters.push(`t.location = $${params.length}`) }
    if (dateFrom) { params.push(dateFrom); filters.push(`pit.created_at >= $${params.length}`) }
    if (dateTo) { params.push(dateTo); filters.push(`pit.created_at <= $${params.length}`) }

    let text = `select pit.*, f.name as from_name, f.location as from_location, t.name as to_name, t.location as to_location, u.name as transferred_by_name
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
    const { from_production_inventory_id, to_location, quantity } = body
    if (!from_production_inventory_id || !to_location || quantity === undefined) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    if (!isLocation(to_location)) return NextResponse.json({ error: 'Invalid destination location' }, { status: 400 })

    const transferQuantity = Number(quantity)
    if (!Number.isFinite(transferQuantity) || transferQuantity <= 0) {
      return NextResponse.json({ error: 'Quantity must be greater than zero' }, { status: 400 })
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')

      const fromRes = await client.query(
        'select * from production_inventory where production_inventory_id = $1 for update',
        [from_production_inventory_id]
      )
      if (fromRes.rows.length === 0) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Source item not found' }, { status: 404 })
      }

      const fromRow = fromRes.rows[0]
      if (!isLocation(fromRow.location)) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Source item has an invalid location' }, { status: 400 })
      }
      if (fromRow.location === to_location) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'From and To locations must be different' }, { status: 400 })
      }
      if (Boolean(fromRow.is_archived)) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Archived source items cannot be transferred' }, { status: 409 })
      }

      const fromStock = Number(fromRow.stock || 0)
      if (transferQuantity > fromStock) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Quantity exceeds source stock' }, { status: 400 })
      }

      const toRes = await client.query(
        'select * from production_inventory where lower(name) = lower($1) and location = $2 for update',
        [fromRow.name, to_location]
      )

      let toId: number
      if (toRes.rows.length > 0) {
        const toRow = toRes.rows[0]
        if (Boolean(toRow.is_archived)) {
          await client.query('ROLLBACK')
          return NextResponse.json({ error: `Destination item "${fromRow.name}" is archived at ${to_location}` }, { status: 409 })
        }
        if (String(toRow.unit || '') !== String(fromRow.unit || '')) {
          await client.query('ROLLBACK')
          return NextResponse.json({ error: `Destination item "${fromRow.name}" at ${to_location} has a different unit (${toRow.unit || 'none'})` }, { status: 409 })
        }
        toId = Number(toRow.production_inventory_id)
      } else {
        const insertRes = await client.query(
          `insert into production_inventory(name, unit, stock, is_archived, location, recipe_unit, conversion_factor, ingredient_category)
           values($1, $2, 0, false, $3, $4, $5, $6)
           returning *`,
          [fromRow.name, fromRow.unit || null, to_location, fromRow.recipe_unit || null, fromRow.conversion_factor ?? null, fromRow.ingredient_category || null]
        )
        toId = Number(insertRes.rows[0].production_inventory_id)
      }

      const insertTransfer = await client.query(
        `insert into production_inventory_transfers(from_production_inventory_id, to_production_inventory_id, quantity, transferred_by)
         values($1,$2,$3,$4) returning *`,
        [from_production_inventory_id, toId, transferQuantity, session.user_id]
      )
      const created = insertTransfer.rows[0]

      await client.query('COMMIT')

      await logAudit({
        user_id: session.user_id,
        restaurant: to_location,
        action: 'transfer_production_inventory',
        table_name: 'production_inventory_transfers',
        record_id: String(created.transfer_id),
        old_data: { from: from_production_inventory_id, from_location: fromRow.location, to: toId, to_location },
        new_data: { ...created, item_name: fromRow.name },
      })

      return NextResponse.json({ transfer: created })
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined)
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