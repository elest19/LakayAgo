import { query } from './db'

export async function logAudit(entry: {
  user_id?: number | null
  restaurant?: string | null
  action: string
  table_name?: string | null
  record_id?: string | null
  old_data?: any
  new_data?: any
  description?: string | null
}) {
  try {
    const text = `
      insert into audit_logs(user_id, restaurant, action, table_name, record_id, old_data, new_data, description)
      values($1,$2,$3,$4,$5,$6,$7,$8)
    `
    await query(text, [entry.user_id ?? null, entry.restaurant ?? null, entry.action, entry.table_name ?? null, entry.record_id ?? null, entry.old_data ?? null, entry.new_data ?? null, entry.description ?? null])
  } catch (err) {
    console.error('Audit insert error', err)
  }
}

export default logAudit
