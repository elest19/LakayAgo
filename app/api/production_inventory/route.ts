import { NextResponse } from 'next/server'
import { query, getClient } from '../../../lib/db'
import getSessionFromRequest from '../../../lib/session'
import { logAudit, logAuditWithClient } from '../../../lib/audit'
import { LOCATIONS, isLocation } from '../../../lib/locations'
import { VOLUME_UNITS, WEIGHT_UNITS, getConversionFactorForRecipeUnit, fullUnitName } from '../../../lib/unitConversions'

export async function GET(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const location = url.searchParams.get('location')

    let text = 'select * from production_inventory'
    const params: any[] = []
    if (location) {
      if (!isLocation(location)) return NextResponse.json({ error: 'Invalid location' }, { status: 400 })
      text += ' where location = $1'
      params.push(location)
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
    const { name, unit, stock, is_archived, recipe_unit, conversion_factor: cf, ingredient_category } = body
    let conversion_factor = cf
    if (!name || !unit) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    if (ingredient_category !== undefined && !['weight','volume','quantity'].includes(ingredient_category)) return NextResponse.json({ error: 'Invalid ingredient_category' }, { status: 400 })

    if (ingredient_category === 'volume') {
      if (!VOLUME_UNITS.includes(unit as any)) return NextResponse.json({ error: 'unit must be a volume unit for ingredient_category=volume' }, { status: 400 })
      if (!recipe_unit) return NextResponse.json({ error: 'recipe_unit is required for volume ingredients' }, { status: 400 })
      if (!VOLUME_UNITS.includes(fullUnitName(recipe_unit) as any)) return NextResponse.json({ error: 'recipe_unit must be a volume unit for ingredient_category=volume' }, { status: 400 })
      conversion_factor = getConversionFactorForRecipeUnit(ingredient_category, recipe_unit)
    }

    if (ingredient_category === 'weight') {
      if (!WEIGHT_UNITS.includes(unit as any)) return NextResponse.json({ error: 'unit must be a weight unit for ingredient_category=weight' }, { status: 400 })
      if (!recipe_unit) return NextResponse.json({ error: 'recipe_unit is required for weight ingredients' }, { status: 400 })
      if (!WEIGHT_UNITS.includes(fullUnitName(recipe_unit) as any)) return NextResponse.json({ error: 'recipe_unit must be a weight unit for ingredient_category=weight' }, { status: 400 })
      conversion_factor = getConversionFactorForRecipeUnit(ingredient_category, recipe_unit)
    }

    if (ingredient_category === 'quantity') conversion_factor = 1

    const location = 'Warehouse'
    const dupCheck = await query(
      'SELECT 1 FROM production_inventory WHERE LOWER(name) = LOWER($1) AND location = $2 LIMIT 1',
      [name, location]
    )
    if (dupCheck.rows.length > 0) return NextResponse.json({ error: 'A production item with this name already exists in Warehouse' }, { status: 409 })

    const client = await getClient()
    try {
      await client.query('BEGIN')
      const result = await client.query(
        `insert into production_inventory(name, unit, stock, is_archived, location, recipe_unit, conversion_factor, ingredient_category)
         values($1, $2, $3, $4, $5, $6, $7, $8)
         returning *`,
        [name, unit, Number(stock || 0), Boolean(is_archived), location, recipe_unit || null, conversion_factor !== undefined && conversion_factor !== null ? Number(conversion_factor) : null, ingredient_category || null]
      )
      const created = result.rows[0]
      await logAuditWithClient(client, {
        user_id: session.user_id,
        restaurant: location,
        action: 'create_production_inventory',
        table_name: 'production_inventory',
        record_id: String(created.production_inventory_id),
        new_data: created,
      })
      await client.query('COMMIT')
      return NextResponse.json({ production_inventory: created })
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw err
    } finally {
      client.release()
    }
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
    const { production_inventory_id, name, unit, stock, is_archived, location, restaurant, recipe_unit, conversion_factor: cf2, ingredient_category } = body
    let conversion_factor = cf2
    if (!production_inventory_id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    if (location !== undefined || restaurant !== undefined) {
      return NextResponse.json({ error: 'Location changes must be made through inventory transfers' }, { status: 400 })
    }

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
    if (recipe_unit !== undefined) { fields.push(`recipe_unit = $${i++}`); values.push(recipe_unit) }
    if (ingredient_category !== undefined) { if (!['weight','volume','quantity'].includes(ingredient_category)) return NextResponse.json({ error: 'Invalid ingredient_category' }, { status: 400 }); fields.push(`ingredient_category = $${i++}`); values.push(ingredient_category) }

    const effectiveCategory = ingredient_category ?? currentItem.ingredient_category
    const effectiveRecipeUnit = recipe_unit !== undefined ? recipe_unit : currentItem.recipe_unit

    if (effectiveCategory === 'volume') {
      if (unit !== undefined && !VOLUME_UNITS.includes(unit as any)) return NextResponse.json({ error: 'unit must be a volume unit for ingredient_category=volume' }, { status: 400 })
      if (effectiveRecipeUnit == null || effectiveRecipeUnit === '') return NextResponse.json({ error: 'recipe_unit is required for volume ingredients' }, { status: 400 })
      conversion_factor = getConversionFactorForRecipeUnit(effectiveCategory, effectiveRecipeUnit)
    }
    if (effectiveCategory === 'weight') {
      if (unit !== undefined && !WEIGHT_UNITS.includes(unit as any)) return NextResponse.json({ error: 'unit must be a weight unit for ingredient_category=weight' }, { status: 400 })
      if (effectiveRecipeUnit == null || effectiveRecipeUnit === '') return NextResponse.json({ error: 'recipe_unit is required for weight ingredients' }, { status: 400 })
      conversion_factor = getConversionFactorForRecipeUnit(effectiveCategory, effectiveRecipeUnit)
    }
    if (effectiveCategory === 'quantity') conversion_factor = 1

    if (conversion_factor !== undefined && conversion_factor !== null) {
      if (Number(conversion_factor) <= 0) return NextResponse.json({ error: 'Invalid conversion_factor' }, { status: 400 })
      fields.push(`conversion_factor = $${i++}`)
      values.push(Number(conversion_factor))
    }

    if (fields.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    values.push(production_inventory_id)

    const client = await getClient()
    try {
      await client.query('BEGIN')
      const locked = await client.query('select * from production_inventory where production_inventory_id = $1 for update', [production_inventory_id])
      if (locked.rows.length === 0) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      const oldItem = locked.rows[0]
      const result = await client.query(`update production_inventory set ${fields.join(', ')} where production_inventory_id = $${i} returning *`, values)
      if (result.rows.length === 0) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }

      const updated = result.rows[0]
      let auditAction = 'update_production_inventory'
      if (oldItem.is_archived === false && is_archived === true) auditAction = 'archive_production_inventory'
      if (oldItem.is_archived === true && is_archived === false) auditAction = 'restore_production_inventory'

      await logAuditWithClient(client, {
        user_id: session.user_id,
        restaurant: updated.location || null,
        action: auditAction,
        table_name: 'production_inventory',
        record_id: String(production_inventory_id),
        old_data: oldItem,
        new_data: updated,
      })
      await client.query('COMMIT')
      return NextResponse.json({ production_inventory: updated })
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw err
    } finally {
      client.release()
    }
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
    const id = Number(url.searchParams.get('id'))
    const hardDelete = url.searchParams.get('hard_delete') === 'true'
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    if (hardDelete) {
      const client = await getClient()
      try {
        await client.query('BEGIN')
        const existing = await client.query('select * from production_inventory where production_inventory_id = $1 for update', [id])
        if (existing.rows.length === 0) {
          await client.query('ROLLBACK')
          return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }
        const refs = await client.query(`
          select (select count(*)::int from food_and_beverage_recipe where production_inventory_id = $1) as recipes
        `, [id])
        if (Number(refs.rows[0].recipes) > 0) {
          await client.query('ROLLBACK')
          return NextResponse.json({ error: 'Item cannot be deleted because it is referenced by existing recipes' }, { status: 409 })
        }

        // Transfer history is not a recipe dependency. Remove only this item's
        // transfer records before deleting the location-specific inventory row.
        await client.query(`
          delete from production_inventory_transfers
          where from_production_inventory_id = $1 or to_production_inventory_id = $1
        `, [id])
        await client.query('delete from production_inventory where production_inventory_id = $1', [id])
        await logAuditWithClient(client, {
          user_id: session.user_id,
          restaurant: existing.rows[0].location || null,
          action: 'delete_production_inventory',
          table_name: 'production_inventory',
          record_id: String(id),
          old_data: existing.rows[0],
          description: `${existing.rows[0].name}: deleted at ${existing.rows[0].location || 'unknown location'} (row #${id}, stock ${existing.rows[0].stock} ${existing.rows[0].unit || ''})`,
        })
        await client.query('COMMIT')
        return NextResponse.json({ ok: true })
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined)
        throw err
      } finally {
        client.release()
      }
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')
      const existing = await client.query('select * from production_inventory where production_inventory_id = $1 for update', [id])
      if (existing.rows.length === 0) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      const deleted = (await client.query('update production_inventory set is_archived = true where production_inventory_id = $1 returning *', [id])).rows[0]
      await logAuditWithClient(client, {
        user_id: session.user_id,
        restaurant: deleted.location || null,
        action: 'archive_production_inventory',
        table_name: 'production_inventory',
        record_id: String(id),
        old_data: existing.rows[0],
        new_data: deleted,
      })
      await client.query('COMMIT')
      return NextResponse.json({ production_inventory: deleted })
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('DELETE /production_inventory failed:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}