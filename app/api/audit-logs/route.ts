import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'
import getSessionFromRequest from '../../../lib/session'
import logAudit from '../../../lib/audit'
import { generateAuditDescription } from '../../../lib/auditLogFormat'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action')
    const user = url.searchParams.get('user')
    // module filtering removed — module derived column is no longer used
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')
    const page = Math.max(1, Number(url.searchParams.get('page') || 1))
    const pageSize = Math.max(1, Number(url.searchParams.get('pageSize') || 10))

    const params: any[] = []
    const conditions: string[] = []

    if (action) {
      conditions.push('al.action = $' + (params.length + 1))
      params.push(action)
    }
    if (user) {
      conditions.push('al.user_id::text = $' + (params.length + 1) + '::text')
      params.push(user)
    }
    if (startDate) {
      conditions.push('al.created_at >= $' + (params.length + 1))
      params.push(startDate)
    }
    if (endDate) {
      conditions.push('al.created_at <= $' + (params.length + 1))
      params.push(endDate)
    }

    let sql = `
      select al.log_id as id, coalesce(u.username, 'System') as user, al.action, al.description,
             to_char(al.created_at::timestamptz, 'YYYY-MM-DD') as dateTime,
             al.table_name, al.record_id, al.old_data, al.new_data
      from audit_logs al
      left join users u on al.user_id::text = u.id::text
    `
    if (conditions.length > 0) {
      sql += ' where ' + conditions.join(' and ')
    }
    // no module filtering

    sql += ' order by al.created_at desc limit $' + (params.length + 1) + ' offset $' + (params.length + 2)
    params.push(pageSize)
    params.push((page - 1) * pageSize)

    const res = await query(sql, params)
    const rows = res.rows.map((r: any) => {
      let desc = r.description
      try {
        if (!desc) {
          desc = generateAuditDescription({ action: r.action, tableName: r.table_name, recordId: r.record_id, oldData: r.old_data, newData: r.new_data })
        }
      } catch (e) {
        console.error('generateAuditDescription error', e)
      }
      return {
        id: r.id,
        user: r.user,
        action: r.action,
        description: desc,
        dateTime: r.datetime,
      }
    })

    let total = 0
    try {
      const countParams: any[] = []
      const countConditions: string[] = []
      if (action) { countConditions.push('al.action = $' + (countParams.length + 1)); countParams.push(action) }
      if (user) { countConditions.push('al.user_id::text = $' + (countParams.length + 1) + '::text'); countParams.push(user) }
      if (startDate) { countConditions.push('al.created_at >= $' + (countParams.length + 1)); countParams.push(startDate) }
      if (endDate) { countConditions.push('al.created_at <= $' + (countParams.length + 1)); countParams.push(endDate) }

      let countSql = `
        select count(*) as total
        from audit_logs al
        left join users u on al.user_id::text = u.id::text
      `
      if (countConditions.length > 0) {
        countSql += ' where ' + countConditions.join(' and ')
      }
      // no module filtering in count
      const countRes = await query(countSql, countParams)
      total = Number(countRes.rows[0]?.total || 0)
    } catch (err) {
      console.error('audit-logs count error', err)
    }

    return NextResponse.json({ logs: rows, total })
  } catch (err) {
    console.error('audit-logs GET error', err)
    return NextResponse.json({ error: 'Failed to load audit logs' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromRequest(req)
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
