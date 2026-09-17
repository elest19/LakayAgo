import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'
import getSessionFromRequest from '../../../lib/session'
import { logAudit } from '../../../lib/audit'
import db from '../../../lib/db'
import { VOLUME_UNITS, WEIGHT_UNITS, isSpoonUnit, getConversionFactorForRecipeUnit, fullUnitName } from '../../../lib/unitConversions'

export async function GET(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const restaurant = url.searchParams.get('restaurant')

    const allowed = ['Aroo', 'Lakay Ago']
    let text = 'select * from production_inventory'
    const params: any[] = []
    if (restaurant && allowed.includes(restaurant)) {
      text += ' where restaurant = $1'
      params.push(restaurant)
    }
    text += ' order by created_at desc'

    const result = await query(text, params)

    return NextResponse.json({ production_inventory: result.rows })
  } catch (err) {
    console.error('GET /production_inventory failed:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { name, unit, stock, is_archived, restaurant, recipe_unit, conversion_factor: cf, ingredient_category } = body
    let conversion_factor = cf
    if (!name || !unit || !restaurant) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    if (!['Aroo', 'Lakay Ago'].includes(restaurant)) return NextResponse.json({ error: 'Invalid restaurant' }, { status: 400 })
    if (ingredient_category !== undefined && !['weight','volume','quantity'].includes(ingredient_category)) return NextResponse.json({ error: 'Invalid ingredient_category' }, { status: 400 })

    // Category-specific validation
    if (ingredient_category === 'volume') {
      if (!VOLUME_UNITS.includes(unit as any)) return NextResponse.json({ error: 'unit must be a volume unit for ingredient_category=volume' }, { status: 400 })
      if (recipe_unit && !VOLUME_UNITS.includes(fullUnitName(recipe_unit) as any)) return NextResponse.json({ error: 'recipe_unit must be a volume unit for ingredient_category=volume' }, { status: 400 })
      if (recipe_unit == null || recipe_unit === '') return NextResponse.json({ error: 'recipe_unit is required for volume ingredients' }, { status: 400 })
      conversion_factor = getConversionFactorForRecipeUnit(ingredient_category, recipe_unit)
    }

    if (ingredient_category === 'weight') {
      if (!WEIGHT_UNITS.includes(unit as any)) return NextResponse.json({ error: 'unit must be a weight unit for ingredient_category=weight' }, { status: 400 })
      if (recipe_unit && !WEIGHT_UNITS.includes(fullUnitName(recipe_unit) as any)) return NextResponse.json({ error: 'recipe_unit must be a weight unit for ingredient_category=weight' }, { status: 400 })
      if (recipe_unit == null || recipe_unit === '') return NextResponse.json({ error: 'recipe_unit is required for weight ingredients' }, { status: 400 })
      conversion_factor = getConversionFactorForRecipeUnit(ingredient_category, recipe_unit)
    }

    if (ingredient_category === 'quantity') {
      if (recipe_unit && recipe_unit !== unit) return NextResponse.json({ error: `recipe_unit is not applicable for quantity ingredients` }, { status: 400 })
      conversion_factor = 1
    }

    // Check for duplicate name+restaurant
    const dupCheck = await query(
      'SELECT 1 FROM production_inventory WHERE LOWER(name) = LOWER($1) AND restaurant = $2 LIMIT 1',
      [name, restaurant]
    )
    if (dupCheck.rows.length > 0) return NextResponse.json({ error: 'A production item with this name already exists for the selected restaurant' }, { status: 409 })

    // Use Supabase if configured, else use direct Postgres
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const result = await query(
        `insert into production_inventory(name, unit, stock, is_archived, restaurant, recipe_unit, conversion_factor, ingredient_category)
          values($1, $2, $3, $4, $5, $6, $7, $8)
          returning *`,
        [name, unit, Number(stock || 0), Boolean(is_archived), restaurant, recipe_unit || null, conversion_factor !== undefined && conversion_factor !== null ? Number(conversion_factor) : null, ingredient_category || null]
        )

      const created = result.rows[0]
      await logAudit({
        user_id: session.user_id,
        restaurant: restaurant,
        action: 'create_production_inventory',
        table_name: 'production_inventory',
        record_id: String(created.production_inventory_id),
        new_data: created,
      })

      return NextResponse.json({ production_inventory: created })
    }

    const result = await query(
      `insert into production_inventory(name, unit, stock, is_archived, restaurant, recipe_unit, conversion_factor, ingredient_category)
       values($1, $2, $3, $4, $5, $6, $7, $8)
       returning *`,
      [name, unit, Number(stock || 0), Boolean(is_archived), restaurant, recipe_unit || null, conversion_factor !== undefined ? Number(conversion_factor) : null, ingredient_category || null]
    )

    const created = result.rows[0]
    await logAudit({
      user_id: session.user_id,
      restaurant: restaurant,
      action: 'create_production_inventory',
      table_name: 'production_inventory',
      record_id: String(created.production_inventory_id),
      new_data: created,
    })

    return NextResponse.json({ production_inventory: created })
  } catch (err) {
    console.error('POST /production_inventory failed:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { production_inventory_id, name, unit, stock, is_archived, restaurant, recipe_unit, conversion_factor: cf2, ingredient_category } = body
    let conversion_factor = cf2
    if (!production_inventory_id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const currentRow = await query('select * from production_inventory where production_inventory_id = $1 limit 1', [production_inventory_id])
    if (currentRow.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const currentItem = currentRow.rows[0]

    const fields: string[] = []
    const values: any[] = []
    let i = 1

    if (name !== undefined) { fields.push(`name = $${i++}`); values.push(name) }
    if (unit !== undefined) { fields.push(`unit = $${i++}`); values.push(unit) }
    if (stock !== undefined) { fields.push(`stock = $${i++}`); values.push(Number(stock)) }
    if (is_archived !== undefined) { fields.push(`is_archived = $${i++}`); values.push(Boolean(is_archived)) }
    if (restaurant !== undefined) { if (!['Aroo','Lakay Ago'].includes(restaurant)) return NextResponse.json({ error: 'Invalid restaurant' }, { status: 400 }); fields.push(`restaurant = $${i++}`); values.push(restaurant) }
    if (recipe_unit !== undefined) { fields.push(`recipe_unit = $${i++}`); values.push(recipe_unit) }
    if (ingredient_category !== undefined) { if (!['weight','volume','quantity'].includes(ingredient_category)) return NextResponse.json({ error: 'Invalid ingredient_category' }, { status: 400 }); fields.push(`ingredient_category = $${i++}`); values.push(ingredient_category) }

    // PUT-specific category/unit checks when present in update
    const effectiveCategory = ingredient_category ?? currentItem.ingredient_category
    const effectiveRecipeUnit = recipe_unit !== undefined ? recipe_unit : currentItem.recipe_unit

    if (effectiveCategory === 'volume') {
      if (unit !== undefined && !VOLUME_UNITS.includes(unit as any)) return NextResponse.json({ error: 'unit must be a volume unit for ingredient_category=volume' }, { status: 400 })
      if (effectiveRecipeUnit == null || effectiveRecipeUnit === '') return NextResponse.json({ error: 'recipe_unit is required for volume ingredients' }, { status: 400 })
      if (recipe_unit !== undefined && recipe_unit && !VOLUME_UNITS.includes(fullUnitName(recipe_unit) as any)) return NextResponse.json({ error: 'recipe_unit must be a volume unit for ingredient_category=volume' }, { status: 400 })
      conversion_factor = getConversionFactorForRecipeUnit(effectiveCategory, effectiveRecipeUnit)
    }
    if (effectiveCategory === 'weight') {
      if (unit !== undefined && !WEIGHT_UNITS.includes(unit as any)) return NextResponse.json({ error: 'unit must be a weight unit for ingredient_category=weight' }, { status: 400 })
      if (effectiveRecipeUnit == null || effectiveRecipeUnit === '') return NextResponse.json({ error: 'recipe_unit is required for weight ingredients' }, { status: 400 })
      if (recipe_unit !== undefined && recipe_unit && !WEIGHT_UNITS.includes(fullUnitName(recipe_unit) as any)) return NextResponse.json({ error: 'recipe_unit must be a weight unit for ingredient_category=weight' }, { status: 400 })
      conversion_factor = getConversionFactorForRecipeUnit(effectiveCategory, effectiveRecipeUnit)
    }
    if (effectiveCategory === 'quantity') {
      if (recipe_unit !== undefined && recipe_unit && recipe_unit !== unit) return NextResponse.json({ error: 'recipe_unit is not applicable for quantity ingredients' }, { status: 400 })
      conversion_factor = 1
    }

    if (conversion_factor !== undefined && conversion_factor !== null) {
      if (Number(conversion_factor) <= 0) return NextResponse.json({ error: 'Invalid conversion_factor' }, { status: 400 })
      fields.push(`conversion_factor = $${i++}`)
      values.push(Number(conversion_factor))
    }

    if (fields.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

    values.push(production_inventory_id)

    const result = await query(
      `update production_inventory set ${fields.join(', ')} where production_inventory_id = $${i}
       returning *`,
      values
    )

    if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = result.rows[0]
    await logAudit({
      user_id: session.user_id,
      restaurant: updated.restaurant || null,
      action: 'update_production_inventory',
      table_name: 'production_inventory',
      record_id: String(production_inventory_id),
      new_data: updated,
    })

    return NextResponse.json({ production_inventory: updated })
  } catch (err) {
    console.error('PUT /production_inventory failed:', err)
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

    // hard delete: permanently remove the item. Refused while it is still
    // referenced by menu recipes or stock transfers (the FKs are RESTRICT).
    if (url.searchParams.get('hard_delete') === 'true') {
      const client = await db.getClient()
      try {
        await client.query('BEGIN')
        const { rows } = await client.query(
          `select * from production_inventory where production_inventory_id = $1 for update`,
          [id]
        )
        if (rows.length === 0) {
          await client.query('ROLLBACK')
          return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }
        const refs = await client.query(
          `select
             (select count(*)::int from food_and_beverage_recipe where production_inventory_id = $1) as recipes,
             (select count(*)::int from production_inventory_transfers where from_production_inventory_id = $1 or to_production_inventory_id = $1) as transfers`,
          [id]
        )
        const { recipes, transfers } = refs.rows[0]
        if (recipes > 0 || transfers > 0) {
          await client.query('ROLLBACK')
          const reasons: string[] = []
          if (recipes > 0) reasons.push(`${recipes} menu recipe${recipes === 1 ? '' : 's'}`)
          if (transfers > 0) reasons.push(`${transfers} stock transfer${transfers === 1 ? '' : 's'}`)
          return NextResponse.json(
            { error: `Cannot delete: this production item is still referenced by ${reasons.join(' and ')}. Remove those references first.` },
            { status: 400 }
          )
        }
        await client.query(`delete from production_inventory where production_inventory_id = $1`, [id])
        await client.query('COMMIT')
        await logAudit({
          user_id: session.user_id,
          restaurant: null,
          action: 'delete_production_inventory',
          table_name: 'production_inventory',
          record_id: String(id),
          new_data: rows[0],
        })
        return NextResponse.json({ deleted: true })
      } catch (err) {
        try { await client.query('ROLLBACK') } catch (e) {}
        console.error('DELETE /production_inventory (hard) failed:', err)
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
      } finally { client.release() }
    }

    // soft-delete by setting is_archived
    const result = await query(
      `update production_inventory set is_archived = true where production_inventory_id = $1
       returning *`,
      [id]
    )

    if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const deleted = result.rows[0]
    await logAudit({
      user_id: session.user_id,
      restaurant: null,
      action: 'archive_production_inventory',
      table_name: 'production_inventory',
      record_id: String(id),
      new_data: deleted,
    })

    return NextResponse.json({ production_inventory: deleted })
  } catch (err) {
    console.error('DELETE /production_inventory failed:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}