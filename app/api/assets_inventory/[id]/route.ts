import { NextResponse } from 'next/server'
import { query } from '../../../../lib/db'
import getSessionFromRequest from '../../../../lib/session'
import { logAudit } from '../../../../lib/audit'

export async function PUT(req: Request, { params }: { params: any }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const { name, quantity, restaurant, is_archived, penalty_amount } = body

    if (!name && quantity == null && restaurant == null && is_archived == null) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    const existingResult = await query('SELECT * FROM assets_inventory WHERE asset_id = $1 LIMIT 1', [id])
    const existing = existingResult.rows[0]
    if (!existing) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

    const updates: string[] = []
    const values: any[] = []
    let index = 1

    if (name != null) { updates.push(`name = $${index++}`); values.push(name.trim()) }
    if (quantity != null) { updates.push(`quantity = $${index++}`); values.push(Number(quantity)) }
    if (restaurant != null) { updates.push(`restaurant = $${index++}`); values.push(restaurant) }
    if (is_archived != null) { updates.push(`is_archived = $${index++}`); values.push(Boolean(is_archived)) }
    if (penalty_amount != null) { updates.push(`penalty_amount = $${index++}`); values.push(Number(penalty_amount)) }

    if (updates.length === 0) return NextResponse.json({ error: 'No updates provided' }, { status: 400 })

    values.push(id)
    const sql = `UPDATE assets_inventory SET ${updates.join(', ')} WHERE asset_id = $${index} RETURNING *`
    const result = await query(sql, values)
    const updated = result.rows[0]

    await logAudit({ user_id: session.user_id, restaurant: updated.restaurant || session.restaurant, action: 'update_asset', table_name: 'assets_inventory', record_id: String(id), old_data: existing, new_data: updated })

    return NextResponse.json({ asset: updated })
  } catch (err) {
    console.error('Asset update error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: any }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const url = new URL(req.url)

    const existingResult = await query('SELECT * FROM assets_inventory WHERE asset_id = $1 LIMIT 1', [id])
    const existing = existingResult.rows[0]
    if (!existing) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

    // hard delete
    if (url.searchParams.get('hard_delete') === 'true') {
      try {
        const res = await query('DELETE FROM assets_inventory WHERE asset_id = $1 RETURNING *', [id])
        const deleted = res.rows[0]
        await logAudit({ user_id: session.user_id, restaurant: deleted.restaurant || session.restaurant, action: 'delete_asset', table_name: 'assets_inventory', record_id: String(id), old_data: deleted })
        return NextResponse.json({ deleted })
      } catch (e: any) {
        console.error('Asset hard delete failed', e)
        if (String(e.message || '').toLowerCase().includes('violat')) {
          return NextResponse.json({ error: 'Cannot delete: referenced by existing records' }, { status: 400 })
        }
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
      }
    }

    // soft-archive instead of hard delete
    try {
      const res = await query('UPDATE assets_inventory SET is_archived = true WHERE asset_id = $1 RETURNING *', [id])
      const archived = res.rows[0]
      await logAudit({ user_id: session.user_id, restaurant: archived.restaurant || session.restaurant, action: 'archive_asset', table_name: 'assets_inventory', record_id: String(id), old_data: existing, new_data: archived })
      return NextResponse.json({ asset: archived })
    } catch (e: any) {
      console.error('Asset archive failed', e)
      if (String(e.message || '').toLowerCase().includes('violat')) {
        return NextResponse.json({ error: 'Cannot archive: referenced by existing records' }, { status: 400 })
      }
      return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
  } catch (err) {
    console.error('Asset delete error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}