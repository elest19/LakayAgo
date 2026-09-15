import { NextResponse } from 'next/server'
import { query, getClient } from '../../../../lib/db'
import getSessionFromRequest from '../../../../lib/session'
import { logAudit } from '../../../../lib/audit'

function isTriggerFailure(message: string | undefined) {
  if (!message) return false
  return /(trigger|stock_transactions|kitchen_stock|production_stock|inventory|constraint|check|restaurant)/i.test(message)
}

export async function PUT(req: Request, { params }: { params: any }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const updates: any = {}
    if (body.item != null) updates.item = String(body.item).trim()
    if (body.cost != null) updates.cost = Number(body.cost)
    if (body.number_of_sales != null) updates.number_of_sales = Number(body.number_of_sales)
    if (body.discount != null) updates.discount = Number(body.discount)
    if (body.food_and_beverage_id != null) updates.food_and_beverage_id = Number(body.food_and_beverage_id)

    if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'No updates provided' }, { status: 400 })

    const existingResult = await query('SELECT * FROM sales WHERE sales_id = $1 LIMIT 1', [id])
    const existing = existingResult.rows[0]
    if (!existing) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })

    const newCost = updates.cost ?? Number(existing.cost)
    const newNumber = updates.number_of_sales ?? Number(existing.number_of_sales)
    const newDiscount = updates.discount ?? Number(existing.discount ?? 0)
    if (typeof newCost !== 'number' || Number.isNaN(newCost) || newCost < 0) return NextResponse.json({ error: 'Invalid cost' }, { status: 400 })
    if (!Number.isInteger(newNumber) || newNumber <= 0) return NextResponse.json({ error: 'Invalid number_of_sales' }, { status: 400 })
    if (typeof newDiscount !== 'number' || Number.isNaN(newDiscount) || newDiscount < 0) return NextResponse.json({ error: 'Invalid discount' }, { status: 400 })
    if (newDiscount > newCost * newNumber) return NextResponse.json({ error: 'Discount cannot exceed total cost', detail: { maxAllowed: newCost * newNumber } }, { status: 400 })

    if (updates.food_and_beverage_id != null) {
      const fbId = Number(updates.food_and_beverage_id)
      if (!Number.isFinite(fbId) || fbId <= 0) return NextResponse.json({ error: 'Invalid food_and_beverage_id' }, { status: 400 })

      // try inventory first, then packages
      const fbResult = await query('SELECT food_and_beverage_id, restaurant FROM food_and_beverage_inventory WHERE food_and_beverage_id = $1 LIMIT 1', [fbId])
      let fb = fbResult.rows[0]
      let source: 'item' | 'bundle' = 'item'
      if (!fb) {
        const pkgRes = await query('SELECT food_package_id as id, restaurant FROM food_packages WHERE food_package_id = $1 LIMIT 1', [fbId])
        if (!pkgRes.rows[0]) return NextResponse.json({ error: 'Invalid food_and_beverage_id' }, { status: 400 })
        fb = { food_and_beverage_id: pkgRes.rows[0].id, restaurant: pkgRes.rows[0].restaurant }
        source = 'bundle'
      }

      if (session.role !== 'SuperAdmin' && fb.restaurant !== session.restaurant) return NextResponse.json({ error: 'Mismatched restaurant for food item' }, { status: 403 })
    }

    const assignments: string[] = []
    const values: any[] = []
    let index = 1

    if (updates.item != null) {
      assignments.push(`item = $${index++}`)
      values.push(updates.item)
    }
    if (updates.cost != null) {
      assignments.push(`cost = $${index++}`)
      values.push(updates.cost)
    }
    if (updates.number_of_sales != null) {
      assignments.push(`number_of_sales = $${index++}`)
      values.push(updates.number_of_sales)
    }
    if (updates.discount != null) {
      assignments.push(`discount = $${index++}`)
      values.push(updates.discount)
    }
    if (updates.food_and_beverage_id != null) {
      assignments.push(`food_and_beverage_id = $${index++}`)
      values.push(updates.food_and_beverage_id)
    }

    if (assignments.length === 0) return NextResponse.json({ error: 'No updates provided' }, { status: 400 })

    values.push(id)
    const updateSql = `UPDATE sales SET ${assignments.join(', ')} WHERE sales_id = $${index} RETURNING *`
    const result = await query(updateSql, values)
    const data = result.rows[0]

    try {
      await logAudit({ user_id: session.user_id, restaurant: session.restaurant, action: 'update_sale', table_name: 'sales', record_id: String(id), old_data: existing, new_data: data })
    } catch (e) { console.error('Audit error', e) }

    return NextResponse.json({ sale: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Database error'
    console.error('Sale update error', err)
    return NextResponse.json({ error: isTriggerFailure(message) ? 'Sale update failed' : 'Server error', detail: message }, { status: isTriggerFailure(message) ? 400 : 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: any }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    // Only restore the ingredients stock when the client explicitly opts in
    const returnStock = new URL(req.url).searchParams.get('return_stock') === 'true'

    const existingResult = await query('SELECT * FROM sales WHERE sales_id = $1 LIMIT 1', [id])
    const existing = existingResult.rows[0]
    if (!existing) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })

    const client = await getClient()
    try {
      await client.query('BEGIN')

      if (!returnStock) {
        // Tell trg_after_sales_delete_deductions to skip restoring the
        // ingredient stock for this delete only.
        await client.query("SET LOCAL app.skip_sales_delete_deductions = 'on'")
      }

      const result = await client.query('DELETE FROM sales WHERE sales_id = $1 RETURNING *', [id])
      const data = result.rows[0]

      await client.query('COMMIT')

      try {
        await logAudit({ user_id: session.user_id, restaurant: session.restaurant, action: 'delete_sale', table_name: 'sales', record_id: String(id), old_data: existing, new_data: null })
      } catch (e) { console.error('Audit error', e) }

      return NextResponse.json({ ok: true, removed: existing, sale: data })
    } catch (txErr) {
      try { await client.query('ROLLBACK') } catch { /* transaction already aborted */ }
      throw txErr
    } finally {
      client.release()
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Database error'
    console.error('Sale delete error', err)
    return NextResponse.json({ error: isTriggerFailure(message) ? 'Sale could not be deleted' : 'Server error', detail: message }, { status: isTriggerFailure(message) ? 400 : 500 })
  }
}
