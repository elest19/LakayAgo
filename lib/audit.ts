import { query } from './db'
import { generateAuditDescription } from './auditLogFormat'

function toJsonValue(value: any) {
  if (value === undefined || value === null) return null
  return JSON.stringify(value)
}

export async function logAudit(entry: {
  user_id?: string | null
  restaurant?: string | null
  action: string
  table_name?: string | null
  record_id?: string | null
  old_data?: any
  new_data?: any
  description?: string | null
}) {
  try {
    // auto-generate description when not explicitly provided
    let description = entry.description ?? null
    try {
      if (!description) {
        description = generateAuditDescription({
          action: entry.action,
          tableName: entry.table_name ?? null,
          recordId: entry.record_id ?? null,
          oldData: entry.old_data ?? null,
          newData: entry.new_data ?? null,
        })
      }
    } catch (e) {
      console.error('generateAuditDescription error', e)
    }

    const text = `
      insert into audit_logs(user_id, restaurant, action, table_name, record_id, old_data, new_data, description)
      values($1,$2,$3,$4,$5,$6,$7,$8)
    `
    await query(text, [
      entry.user_id ?? null,
      entry.restaurant ?? null,
      entry.action,
      entry.table_name ?? null,
      entry.record_id ?? null,
      toJsonValue(entry.old_data),
      toJsonValue(entry.new_data),
      description,
    ])
  } catch (err) {
    console.error('Audit insert error', err)
  }
}

export default logAudit
