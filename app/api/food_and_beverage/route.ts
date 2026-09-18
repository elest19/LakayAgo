import { NextResponse } from 'next/server'
import { query, getClient } from '../../../lib/db'
import getSessionFromRequest from '../../../lib/session'
import { logAudit } from '../../../lib/audit'

const normalizeMenuCategory = (value: unknown) => value === 'Others' ? 'Others' : 'Menu Item'

const hasCategoryColumn = async () => {
  const result = await query(`
    select 1
    from information_schema.columns
    where table_schema = current_schema()
      and table_name = 'food_and_beverage_inventory'
      and column_name = 'category'
    limit 1
  `)
  return result.rows.length > 0
}

export async function GET(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const qRestaurant = url.searchParams.get('restaurant')
    const params: any[] = []
    const filters: string[] = []
    if (session.role !== 'SuperAdmin') {
      filters.push(`fi.restaurant = $${params.length + 1}`)
      params.push(session.restaurant)
    } else if (qRestaurant) {
      filters.push(`fi.restaurant = $${params.length + 1}`)
      params.push(qRestaurant)
    }

    const text = `
      select fi.*, coalesce(json_agg(json_build_object('recipe_id', r.recipe_id, 'production_inventory_id', r.production_inventory_id, 'quantity_required', r.quantity_required, 'name', p.name, 'unit', p.unit) ) filter (where r.recipe_id is not null), '[]') as recipe
      from food_and_beverage_inventory fi
      left join food_and_beverage_recipe r on r.food_and_beverage_id = fi.food_and_beverage_id
      left join production_inventory p on p.production_inventory_id = r.production_inventory_id
      ${filters.length ? 'where ' + filters.join(' and ') : ''}
      group by fi.food_and_beverage_id
      order by fi.created_at desc
    `

    const result = await query(text, params)
    return NextResponse.json({ items: result.rows })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const { name, price, restaurant, recipe, servings, category } = body
    const restaurantValue = restaurant || session.restaurant
    const normalizedCategory = normalizeMenuCategory(category)
    if (!name || price == null) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    if (!restaurantValue) return NextResponse.json({ error: 'Missing restaurant' }, { status: 400 })
    if (!Array.isArray(recipe) || recipe.length === 0) return NextResponse.json({ error: 'Recipe must be a non-empty array' }, { status: 400 })
    if (servings !== undefined && (Number.isNaN(Number(servings)) || !Number.isInteger(Number(servings)) || Number(servings) <= 0)) {
      return NextResponse.json({ error: 'servings must be a positive integer' }, { status: 400 })
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')

      // validate production_inventory ids belong to same restaurant
      const prodIds = recipe.map((r: any) => Number(r.production_inventory_id))
      const prodRes = await client.query(`select production_inventory_id, name, restaurant from production_inventory where production_inventory_id = any($1)`, [prodIds])
      if (prodRes.rows.length !== prodIds.length) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'One or more production inventory items not found' }, { status: 400 })
      }
      const mismatched = prodRes.rows.filter((row: { restaurant: string }) => row.restaurant !== restaurantValue)
      if (mismatched.length) {
        await client.query('ROLLBACK')
        const names = mismatched.map((row: { name: string }) => `${row.name} does not belong to ${restaurantValue}`).join('; ')
        return NextResponse.json({ error: names, detail: 'Recipe ingredients must match the selected restaurant' }, { status: 400 })
      }

      const hasColumn = await hasCategoryColumn()
      const insertSql = hasColumn
        ? `insert into food_and_beverage_inventory(name, price, restaurant, servings, category, is_archived) values($1,$2,$3,$4,$5,false) returning *`
        : `insert into food_and_beverage_inventory(name, price, restaurant, servings, is_archived) values($1,$2,$3,$4,false) returning *`
      const insertParams = hasColumn
        ? [name, Number(price), restaurantValue, servings ? Number(servings) : 1, normalizedCategory]
        : [name, Number(price), restaurantValue, servings ? Number(servings) : 1]
      const insertRes = await client.query(insertSql, insertParams)
      const created = insertRes.rows[0]

      // insert recipe rows
      for (const r of recipe) {
        await client.query(`insert into food_and_beverage_recipe(food_and_beverage_id, production_inventory_id, quantity_required) values($1,$2,$3)`, [created.food_and_beverage_id, Number(r.production_inventory_id), Number(r.quantity_required)])
      }

      await client.query('COMMIT')

      // fetch created item with recipe
      const itemRes = await query(`select fi.*, coalesce(json_agg(json_build_object('recipe_id', r.recipe_id, 'production_inventory_id', r.production_inventory_id, 'quantity_required', r.quantity_required, 'name', p.name, 'unit', p.unit) ) filter (where r.recipe_id is not null), '[]') as recipe from food_and_beverage_inventory fi left join food_and_beverage_recipe r on r.food_and_beverage_id = fi.food_and_beverage_id left join production_inventory p on p.production_inventory_id = r.production_inventory_id where fi.food_and_beverage_id = $1 group by fi.food_and_beverage_id`, [created.food_and_beverage_id])

      const newItem = itemRes.rows[0]
      await logAudit({ user_id: session.user_id, restaurant: restaurantValue, action: 'create_food_and_beverage', table_name: 'food_and_beverage_inventory', record_id: String(created.food_and_beverage_id), new_data: newItem })

      return NextResponse.json({ item: newItem })
    } catch (err) {
      try { await client.query('ROLLBACK') } catch (e) {}
      console.error('POST /food_and_beverage failed:', err)
      return NextResponse.json({ error: 'Server error' }, { status: 500 })
    } finally {
      client.release()
    }
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const { food_and_beverage_id, name, price, restaurant, recipe, is_archived, servings, category } = body
    if (!food_and_beverage_id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    if (servings !== undefined && (Number.isNaN(Number(servings)) || !Number.isInteger(Number(servings)) || Number(servings) <= 0)) {
      return NextResponse.json({ error: 'servings must be a positive integer' }, { status: 400 })
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')

      // update main row
      const updates: any[] = []
      const setParts: string[] = []
      let idx = 1
      const hasColumn = await hasCategoryColumn()
      if (name !== undefined) { setParts.push(`name = $${idx++}`); updates.push(name) }
      if (price !== undefined) { setParts.push(`price = $${idx++}`); updates.push(Number(price)) }
      if (restaurant !== undefined) { setParts.push(`restaurant = $${idx++}`); updates.push(restaurant) }
      if (category !== undefined && hasColumn) { setParts.push(`category = $${idx++}`); updates.push(normalizeMenuCategory(category)) }
      if (is_archived !== undefined) { setParts.push(`is_archived = $${idx++}`); updates.push(Boolean(is_archived)) }
      if (servings !== undefined) { setParts.push(`servings = $${idx++}`); updates.push(Number(servings)) }

      if (setParts.length) {
        updates.push(food_and_beverage_id)
        await client.query(`update food_and_beverage_inventory set ${setParts.join(', ')} where food_and_beverage_id = $${updates.length}`, updates)
      }

      // replace recipe if provided
      if (Array.isArray(recipe)) {
        // validate production ids
        const prodIds = recipe.map((r: any) => Number(r.production_inventory_id))
        const prodRes = await client.query(`select production_inventory_id, name, restaurant from production_inventory where production_inventory_id = any($1)`, [prodIds])
        if (prodRes.rows.length !== prodIds.length) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'One or more production inventory items not found' }, { status: 400 }) }
        const restaurantValue = restaurant || (await client.query(`select restaurant from food_and_beverage_inventory where food_and_beverage_id = $1`, [food_and_beverage_id])).rows[0].restaurant
        const mismatched = prodRes.rows.filter((row: { restaurant: string }) => row.restaurant !== restaurantValue)
        if (mismatched.length) { await client.query('ROLLBACK'); const names = mismatched.map((row: { name: string }) => `${row.name} does not belong to ${restaurantValue}`).join('; '); return NextResponse.json({ error: names, detail: 'Recipe ingredients must match the selected restaurant' }, { status: 400 }) }

        // delete existing recipe rows
        await client.query(`delete from food_and_beverage_recipe where food_and_beverage_id = $1`, [food_and_beverage_id])
        // insert new rows
        for (const r of recipe) {
          await client.query(`insert into food_and_beverage_recipe(food_and_beverage_id, production_inventory_id, quantity_required) values($1,$2,$3)`, [food_and_beverage_id, Number(r.production_inventory_id), Number(r.quantity_required)])
        }
      }

      await client.query('COMMIT')

      const itemRes = await query(`select fi.*, coalesce(json_agg(json_build_object('recipe_id', r.recipe_id, 'production_inventory_id', r.production_inventory_id, 'quantity_required', r.quantity_required, 'name', p.name, 'unit', p.unit) ) filter (where r.recipe_id is not null), '[]') as recipe from food_and_beverage_inventory fi left join food_and_beverage_recipe r on r.food_and_beverage_id = fi.food_and_beverage_id left join production_inventory p on p.production_inventory_id = r.production_inventory_id where fi.food_and_beverage_id = $1 group by fi.food_and_beverage_id`, [food_and_beverage_id])
      const updatedItem = itemRes.rows[0]
      await logAudit({ user_id: session.user_id, restaurant: restaurant || session.restaurant, action: 'update_food_and_beverage', table_name: 'food_and_beverage_inventory', record_id: String(food_and_beverage_id), new_data: updatedItem })
      return NextResponse.json({ item: updatedItem })
    } catch (err) {
      try { await client.query('ROLLBACK') } catch (e) {}
      console.error('PUT /food_and_beverage failed:', err)
      return NextResponse.json({ error: 'Server error' }, { status: 500 })
    } finally { client.release() }
  } catch (err) {
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

    // Hard delete (permanent): the menu item's recipe rows are removed together with the item,
    // and deletion is only allowed while the item is not referenced by sales or food packages.
    if (url.searchParams.get('hard_delete') === 'true') {
      const client = await getClient()
      try {
        await client.query('BEGIN')
        const existingRes = await client.query(`select * from food_and_beverage_inventory where food_and_beverage_id = $1 for update`, [id])
        const existing = existingRes.rows[0]
        if (!existing) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Menu item not found' }, { status: 404 }) }

        const refs = await client.query(
          `select
             (select count(*) from sales where food_and_beverage_id = $1) as sales_count,
             (select count(*) from food_package_items where food_and_beverage_id = $1) as package_count`,
          [id]
        )
        const salesCount = Number(refs.rows[0]?.sales_count || 0)
        const packageCount = Number(refs.rows[0]?.package_count || 0)
        if (salesCount > 0 || packageCount > 0) {
          await client.query('ROLLBACK')
          const references = [
            salesCount > 0 ? `${salesCount} sales record${salesCount === 1 ? '' : 's'}` : null,
            packageCount > 0 ? `${packageCount} food package${packageCount === 1 ? '' : 's'}` : null,
          ].filter(Boolean).join(' and ')
          return NextResponse.json({ error: `Cannot delete: this menu item is still referenced by ${references}. Remove those references first.` }, { status: 400 })
        }

        // recipe rows belong to the menu item, so they go with it
        await client.query(`delete from food_and_beverage_recipe where food_and_beverage_id = $1`, [id])
        const deletedRes = await client.query(`delete from food_and_beverage_inventory where food_and_beverage_id = $1 returning *`, [id])
        await client.query('COMMIT')
        const deleted = deletedRes.rows[0]
        await logAudit({ user_id: session.user_id, restaurant: deleted.restaurant || session.restaurant, action: 'delete_food_and_beverage', table_name: 'food_and_beverage_inventory', record_id: String(id), old_data: deleted })
        return NextResponse.json({ deleted })
      } catch (err: any) {
        try { await client.query('ROLLBACK') } catch (e) {}
        console.error('DELETE /food_and_beverage hard delete failed:', err)
        const message = String(err?.message || '')
        if (message.toLowerCase().includes('cannot delete')) {
          return NextResponse.json({ error: message }, { status: 400 })
        }
        return NextResponse.json({ error: 'Cannot delete: referenced by existing records' }, { status: 400 })
      } finally { client.release() }
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')
      const existingRes = await client.query(`select * from food_and_beverage_inventory where food_and_beverage_id = $1 for update`, [id])
      const existing = existingRes.rows[0]
      if (!existing) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Not found' }, { status: 404 }) }

      const { rows } = await client.query(`update food_and_beverage_inventory set is_archived = true where food_and_beverage_id = $1 returning *`, [id])
      if (rows.length === 0) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Not found' }, { status: 404 }) }
      // Archiving is reversible, so the recipe rows are kept — restoring the item brings
      // its ingredient list back intact. Recipe rows are only removed on hard delete.
      await client.query('COMMIT')
      const deleted = rows[0]
      await logAudit({ user_id: session.user_id, restaurant: deleted.restaurant || session.restaurant, action: 'archive_food_and_beverage', table_name: 'food_and_beverage_inventory', record_id: String(id), old_data: existing, new_data: deleted })
      return NextResponse.json({ item: deleted })
    } catch (err) {
      try { await client.query('ROLLBACK') } catch (e) {}
      console.error('DELETE /food_and_beverage failed:', err)
      return NextResponse.json({ error: 'Server error' }, { status: 500 })
    } finally { client.release() }
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
