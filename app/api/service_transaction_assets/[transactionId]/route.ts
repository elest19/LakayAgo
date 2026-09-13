import { NextResponse } from 'next/server'
import { query, getClient } from '../../../../lib/db'
import getSessionFromRequest from '../../../../lib/session'
import { logAudit } from '../../../../lib/audit'

export async function GET(req: Request, { params }: { params: Promise<{ transactionId: string }> }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { transactionId } = await params
    // fetch transaction and its service
    const txRes = await query('select * from service_transactions where service_transaction_id = $1 limit 1', [transactionId])
    const tx = txRes.rows[0]
    if (!tx) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })

    // expected assets from service_assets
    const expectedRes = await query(
      `select sta.service_id, sta.asset_id, sa.quantity_used as assigned_quantity, a.name as asset_name, a.penalty_amount
       from service_transaction_assets sta
       join service_assets sa on sa.service_id = sta.service_id and sa.asset_id = sta.asset_id
       left join assets_inventory a on a.asset_id = sta.asset_id
       where sta.service_transaction_id = $1
       union all
       select $2 as service_id, sa.asset_id, sa.quantity_used as assigned_quantity, a.name as asset_name, a.penalty_amount
       from service_assets sa
       left join assets_inventory a on a.asset_id = sa.asset_id
       where sa.service_id = $2
         and not exists (
           select 1 from service_transaction_assets sta2
           where sta2.service_transaction_id = $1 and sta2.asset_id = sa.asset_id
         )`,
      [transactionId, tx.service_id]
    )

    const expected = expectedRes.rows || []

    // existing returned quantities
    const returnedRes = await query('select * from service_transaction_assets where service_transaction_id = $1', [transactionId])
    const returnedMap: Record<number, any> = {}
    for (const r of returnedRes.rows) returnedMap[Number(r.asset_id)] = r

    const lines = expected.map((e: any) => {
      const ret = returnedMap[Number(e.asset_id)]
      const quantity_returned = ret ? Number(ret.quantity_returned) : 0
      const missing = Math.max(Number(e.assigned_quantity || 0) - quantity_returned, 0)
      const penalty_rate = Number(e.penalty_amount || 0)
      const penalty = missing * penalty_rate
      return { asset_id: e.asset_id, asset_name: e.asset_name, assigned_quantity: Number(e.assigned_quantity), quantity_returned, quantity_missing: missing, penalty_amount: penalty, penalty_rate }
    })

    const totalPenalty = lines.reduce((s: number, l: any) => s + Number(l.penalty_amount || 0), 0)

    return NextResponse.json({ lines, totalPenalty })
  } catch (err) {
    console.error('Service transaction assets fetch error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ transactionId: string }> }) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { transactionId } = await params
    const body = await req.json()
    const updates = Array.isArray(body.updates) ? body.updates : []
    if (updates.length === 0) return NextResponse.json({ error: 'No updates' }, { status: 400 })

    const client = await getClient()
    try {
      await client.query('BEGIN')
      const txRes = await client.query('select service_id from service_transactions where service_transaction_id = $1 limit 1', [transactionId])
      const tx = txRes.rows[0]
      if (!tx) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
      }

      for (const u of updates) {
        const assetId = Number(u.asset_id)
        const qty = Number(u.quantity_returned || 0)
        if (!Number.isFinite(assetId) || assetId <= 0) continue
        if (!Number.isFinite(qty) || qty < 0) continue

        const assetAssignedRes = await client.query(
          'select 1 from service_assets where service_id = $1 and asset_id = $2 limit 1',
          [tx.service_id, assetId]
        )
        if (assetAssignedRes.rows.length === 0) {
          await client.query('ROLLBACK')
          return NextResponse.json({ error: 'This asset is not assigned to this service' }, { status: 400 })
        }

        await client.query('delete from service_transaction_assets where service_transaction_id = $1 and asset_id = $2', [transactionId, assetId])
        await client.query(
          'insert into service_transaction_assets (service_transaction_id, asset_id, quantity_returned, service_id) values ($1,$2,$3,$4)',
          [transactionId, assetId, qty, tx.service_id]
        )
      }
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK').catch(()=>{})
      if (e instanceof Error && /is not assigned to this service|foreign key constraint|violates foreign key/i.test(e.message)) {
        return NextResponse.json({ error: 'This asset is not assigned to this service' }, { status: 400 })
      }
      throw e
    } finally { client.release() }

    await logAudit({ user_id: session.user_id, restaurant: null, action: 'update_service_transaction_assets', table_name: 'service_transaction_assets', record_id: String(transactionId), new_data: updates })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Service transaction assets update error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
