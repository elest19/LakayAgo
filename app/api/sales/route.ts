import { NextResponse } from 'next/server'
import { query, getClient } from '../../../lib/db'
import getSessionFromRequest from '../../../lib/session'
import { convertRecipeQuantityToStockUnit } from '../../../lib/recipeConversion'

export async function GET(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const qRestaurant = url.searchParams.get('restaurant')

    const clauses: string[] = []
    const values: any[] = []

    if (session.role !== 'SuperAdmin') {
      clauses.push('s.restaurant = $1')
      values.push(session.restaurant)
    } else if (qRestaurant) {
      clauses.push('s.restaurant = $1')
      values.push(qRestaurant)
    }

    // Sales rows only store food_and_beverage_id, which may point at either a menu
    // item or a food package/bundle (see db/009_allow_sales_reference_bundles.sql),
    // so the category is derived here: an id that resolves to a menu item with the
    // same name is a menu item (mirroring the app/trigger lookup precedence),
    // otherwise a matching food_packages row means the sale was a bundle.
    let sql = `SELECT s.*,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM food_and_beverage_inventory fi
            WHERE fi.food_and_beverage_id = s.food_and_beverage_id AND fi.name = s.item
          ) THEN 'Menu Item'
          WHEN EXISTS (
            SELECT 1 FROM food_packages fp
            WHERE fp.food_package_id = s.food_and_beverage_id
          ) THEN 'Food Bundle'
          ELSE 'Menu Item'
        END AS category
      FROM sales s`
    if (clauses.length > 0) {
      sql += ` WHERE ${clauses.join(' AND ')}`
    }
    sql += ' ORDER BY s.created_at DESC'

    const result = await query(sql, values)
    return NextResponse.json({ sales: result.rows })
  } catch (err) {
    console.error('Sales fetch error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

function normalizeRestaurant(value: unknown, fallback = 'Both') {
  const candidate = String(value ?? '').trim()
  if (!candidate || candidate === 'null') return fallback
  return ['Lakay Ago', 'Aroo', 'Both'].includes(candidate) ? candidate : fallback
}

function isTriggerFailure(message: string | undefined) {
  if (!message) return false
  return /(trigger|stock_transactions|kitchen_stock|production_stock|inventory|constraint|check|restaurant)/i.test(message)
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const rows = body.sales
    if (!rows || !Array.isArray(rows)) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })

    const sessionRestaurant = normalizeRestaurant(session.restaurant, 'Both')
    const client = await getClient()
    try {
      await client.query('BEGIN')

      const inserts: string[] = []
      const values: any[] = []
      let paramIdx = 1

      for (const row of rows) {
        const itemFromBody = String(row.item ?? '').trim()
        const cost = Number(row.cost)
        const numberOfSales = Number(row.number_of_sales)
        const discount = Number(row.discount ?? 0)
        const fbId = Number(row.food_and_beverage_id)
        const requestedSource = String(row.source ?? '').trim().toLowerCase() // 'item'|'bundle' or ''

        if (!Number.isFinite(fbId) || fbId <= 0) throw new Error('food_and_beverage_id is required')
        if (!itemFromBody) throw new Error('Item name is required')
        if (!Number.isFinite(cost) || cost < 0) throw new Error('Invalid cost')
        if (!Number.isInteger(numberOfSales) || numberOfSales <= 0) throw new Error('Invalid number_of_sales')
        if (!Number.isFinite(discount) || discount < 0) throw new Error('Invalid discount')
        if (discount > cost * numberOfSales) throw new Error('Discount cannot exceed total cost')

        // validate existence either in inventory or packages depending on source
        let resolvedSource: 'item' | 'bundle' | null = null
        let lookupName = ''
        let lookupRestaurant: string | null = null

        if (requestedSource === 'bundle') {
          const pkgRes = await client.query('select food_package_id, name, price, restaurant from food_packages where food_package_id = $1 limit 1', [fbId])
          if (pkgRes.rows.length === 0) throw new Error('Invalid food_and_beverage_id for bundle')
          resolvedSource = 'bundle'
          lookupName = pkgRes.rows[0].name
          lookupRestaurant = pkgRes.rows[0].restaurant
        } else if (requestedSource === 'item') {
          const itemRes = await client.query('select food_and_beverage_id, name, price, restaurant from food_and_beverage_inventory where food_and_beverage_id = $1 limit 1', [fbId])
          if (itemRes.rows.length === 0) throw new Error('Invalid food_and_beverage_id for item')
          resolvedSource = 'item'
          lookupName = itemRes.rows[0].name
          lookupRestaurant = itemRes.rows[0].restaurant
        } else {
          // no source specified: try inventory first, then packages
          const itemRes = await client.query('select food_and_beverage_id, name, price, restaurant from food_and_beverage_inventory where food_and_beverage_id = $1 limit 1', [fbId])
          if (itemRes.rows.length > 0) {
            resolvedSource = 'item'
            lookupName = itemRes.rows[0].name
            lookupRestaurant = itemRes.rows[0].restaurant
          } else {
            const pkgRes = await client.query('select food_package_id, name, price, restaurant from food_packages where food_package_id = $1 limit 1', [fbId])
            if (pkgRes.rows.length > 0) {
              resolvedSource = 'bundle'
              lookupName = pkgRes.rows[0].name
              lookupRestaurant = pkgRes.rows[0].restaurant
            }
          }
          if (!resolvedSource) throw new Error('Invalid food_and_beverage_id')
        }

        // Enforce restaurant scoping for non-superadmin
        if (session.role !== 'SuperAdmin' && lookupRestaurant && lookupRestaurant !== session.restaurant) {
          throw new Error('Mismatched restaurant for selected item')
        }

        const saleRestaurant = normalizeRestaurant(row.restaurant ?? lookupRestaurant ?? sessionRestaurant, 'Both')

        // build parametrized insert tuple
        inserts.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`)
        values.push(saleRestaurant, fbId, String(lookupName || itemFromBody), cost, numberOfSales, discount)
      }

      const sql = `INSERT INTO sales (restaurant, food_and_beverage_id, item, cost, number_of_sales, discount) VALUES ${inserts.join(', ')} RETURNING *`
      const result = await client.query(sql, values)
      const createdRows = result.rows

      for (const sale of createdRows) {
        // Try to fetch recipe directly for the sold id (item case)
        const recipeRows = await client.query(
          `SELECT r.quantity_required, p.production_inventory_id, p.name, p.unit, p.recipe_unit, p.conversion_factor, p.ingredient_category
           FROM food_and_beverage_recipe r
           JOIN production_inventory p ON p.production_inventory_id = r.production_inventory_id
           WHERE r.food_and_beverage_id = $1`,
          [sale.food_and_beverage_id],
        )

        if (recipeRows.rows.length > 0) {
          for (const ingredient of recipeRows.rows) {
            const required = Number(ingredient.quantity_required ?? 0)
            const totalNeeded = required * Number(sale.number_of_sales)
            const stockConversion = convertRecipeQuantityToStockUnit(totalNeeded, ingredient)

            if (!Number.isFinite(stockConversion) || stockConversion <= 0) continue

            const stockCheck = await client.query(
              `SELECT stock FROM production_inventory WHERE production_inventory_id = $1 FOR UPDATE`,
              [ingredient.production_inventory_id],
            )
            const existingStock = Number(stockCheck.rows[0]?.stock ?? 0)
            if (existingStock < stockConversion) {
              throw new Error(`Insufficient stock for ${ingredient.name}. Needed ${stockConversion} ${ingredient.unit} but only ${existingStock} available.`)
            }

            await client.query(
              `UPDATE production_inventory SET stock = stock - $1 WHERE production_inventory_id = $2`,
              [stockConversion, ingredient.production_inventory_id],
            )
          }
        } else {
          // Bundle case: expand package items to their recipes
          const pkgItems = await client.query(
            `SELECT fpi.food_and_beverage_id, fpi.quantity as package_quantity, fi.name as item_name
             FROM food_package_items fpi
             LEFT JOIN food_and_beverage_inventory fi ON fi.food_and_beverage_id = fpi.food_and_beverage_id
             WHERE fpi.food_package_id = $1`,
            [sale.food_and_beverage_id],
          )

          for (const pkgItem of pkgItems.rows) {
            const compRecipe = await client.query(
              `SELECT r.quantity_required, p.production_inventory_id, p.name, p.unit, p.recipe_unit, p.conversion_factor, p.ingredient_category
               FROM food_and_beverage_recipe r
               JOIN production_inventory p ON p.production_inventory_id = r.production_inventory_id
               WHERE r.food_and_beverage_id = $1`,
              [pkgItem.food_and_beverage_id],
            )

            for (const ingredient of compRecipe.rows) {
              const required = Number(ingredient.quantity_required ?? 0) * Number(pkgItem.package_quantity ?? 1)
              const totalNeeded = required * Number(sale.number_of_sales)
              const stockConversion = convertRecipeQuantityToStockUnit(totalNeeded, ingredient)

              if (!Number.isFinite(stockConversion) || stockConversion <= 0) continue

              const stockCheck = await client.query(
                `SELECT stock FROM production_inventory WHERE production_inventory_id = $1 FOR UPDATE`,
                [ingredient.production_inventory_id],
              )
              const existingStock = Number(stockCheck.rows[0]?.stock ?? 0)
              if (existingStock < stockConversion) {
                throw new Error(`Insufficient stock for ${ingredient.name}. Needed ${stockConversion} ${ingredient.unit} but only ${existingStock} available.`)
              }

              await client.query(
                `UPDATE production_inventory SET stock = stock - $1 WHERE production_inventory_id = $2`,
                [stockConversion, ingredient.production_inventory_id],
              )
            }
          }
        }
      }

      await client.query('COMMIT')
      return NextResponse.json({ sales: createdRows ?? [] })
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Database error'
    console.error('Sales create error', err)
    return NextResponse.json(
      {
        error: isTriggerFailure(message) ? 'Sale could not be recorded' : (message.includes('Invalid ') || message.includes('required') || message.includes('cannot exceed total cost') || message.includes('Insufficient stock') ? message : 'Server error'),
        detail: message,
      },
      { status: isTriggerFailure(message) ? 400 : (message.includes('Invalid ') || message.includes('required') || message.includes('cannot exceed total cost') || message.includes('Insufficient stock') ? 400 : 500) },
    )
  }
}
