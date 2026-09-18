import { query } from './db'
import { generateAuditDescription } from './auditLogFormat'
import { format as formatDateFn } from 'date-fns'

function toJsonValue(value: any) {
  if (value === undefined || value === null) return null
  return JSON.stringify(value)
}

// Resolve the human-readable period range for any audit entry that references
// a payroll period (report_period_id), so descriptions never show a bare id.
async function withPeriodRange(data: any, fallbackPeriodId?: string | number | null): Promise<any> {
  if (!data || typeof data !== 'object') return data
  const periodId = data.report_period_id ?? fallbackPeriodId
  if (periodId == null || data.period_range) return data
  try {
    const res = await query('select period_start, period_end, restaurant from report_periods where report_period_id = $1 limit 1', [Number(periodId)])
    if (res.rows.length > 0) {
      const { period_start, period_end, restaurant } = res.rows[0]
      const fmt = (d: any) => { try { return formatDateFn(new Date(d), 'MMM d, yyyy') } catch { return String(d) } }
      return { ...data, period_range: restaurant && restaurant !== 'Both' ? `${restaurant}: ${fmt(period_start)} – ${fmt(period_end)}` : `${fmt(period_start)} – ${fmt(period_end)}` }
    }
  } catch (e) {
    console.error('withPeriodRange lookup failed', e)
  }
  return data
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
    // enrich payroll-period references with the human-readable date range
    let oldData = entry.old_data ?? null
    let newData = entry.new_data ?? null
    try {
      const periodId = newData?.report_period_id ?? oldData?.report_period_id ?? null
      const isPayslipPeriodEntry = (entry.table_name || '').toLowerCase().includes('payslip')
      if (periodId != null || isPayslipPeriodEntry) {
        const fallback = periodId ?? (isPayslipPeriodEntry ? entry.record_id : null)
        ;[oldData, newData] = await Promise.all([
          withPeriodRange(oldData, fallback),
          withPeriodRange(newData, fallback),
        ])
      }
    } catch (e) {
      console.error('period range enrichment failed', e)
    }

    // auto-generate description when not explicitly provided
    let description = entry.description ?? null
    try {
      if (!description) {
        description = generateAuditDescription({
          action: entry.action,
          tableName: entry.table_name ?? null,
          recordId: entry.record_id ?? null,
          oldData,
          newData,
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
      toJsonValue(oldData),
      toJsonValue(newData),
      description,
    ])
  } catch (err) {
    console.error('Audit insert error', err)
  }
}

export default logAudit
