import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'
import getSessionFromRequest from '../../../lib/session'
import logAudit from '../../../lib/audit'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action')

    let sql = 'select id, user_id, username, action, module, description, old_data, new_data, created_at from audit_logs order by created_at desc limit 100'
    const params: any[] = []
    if (action) {
      sql = 'select id, user_id, username, action, module, description, old_data, new_data, created_at from audit_logs where action = $1 order by created_at desc limit 100'
      params.push(action)
    }

    const res = await query(sql, params)
    const rows = res.rows.map((r: any) => ({
      id: r.id,
      user: r.username || `user:${r.user_id}`,
      action: r.action,
      module: r.module,
      description: r.description,
      old_data: r.old_data,
      new_data: r.new_data,
      created_at: r.created_at,
    }))

    return NextResponse.json({ logs: rows })
  } catch (err) {
    console.error('audit-logs GET error', err)
    return NextResponse.json({ error: 'Failed to load audit logs' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = getSessionFromRequest(req)
    const body = await req.json()
    // expected: { action, table_name, record_id, old_data, new_data, description }
    const entry = {
      user_id: session?.user_id ?? null,
      restaurant: session?.restaurant ?? null,
      action: body.action,
      table_name: body.table_name ?? null,
      record_id: body.record_id ?? null,
      old_data: body.old_data ?? null,
      new_data: body.new_data ?? null,
      description: body.description ?? null,
    }

    await logAudit(entry)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('audit-logs POST error', err)
    return NextResponse.json({ error: 'Failed to record audit' }, { status: 500 })
  }
}
