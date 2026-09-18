import { format as formatDateFn } from 'date-fns'

function titleCaseWords(s: string) {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export function formatActionLabel(action: string): string {
  const map: Record<string, string> = {
    update_report_period_status: 'Updated Payroll Period Status',
    override_net_pay: 'Overrode Net Pay',
    create_cash_advance_payment: 'Recorded Cash Advance Payment',
    update_attendance: 'Updated Attendance Record',
    create_report_period: 'Created Payroll Period',
    update_employee: 'Updated Employee',
    update_production_inventory: 'Updated Production Inventory Item',
    update_food_and_beverage: 'Updated Menu Item',
    archive_production_inventory: 'Archived Production Inventory Item',
    archive_food_and_beverage: 'Archived Menu Item',
    delete_asset: 'Deleted Asset',
    archive_asset: 'Archived Asset',
    update_food_package: 'Updated Food Package',
    update_service: 'Updated Service',
    create_service_transaction: 'Created Service Transaction',
    update_service_transaction: 'Updated Service Transaction',
    delete_service_transaction: 'Deleted Service Transaction',
    transfer_production_inventory: 'Transferred Production Inventory',
    archive_service: 'Archived Service',
    archive_sub_service: 'Archived Sub-Service',
    attach_sub_service: 'Attached Sub-Service',
  }
  return map[action] || titleCaseWords(action)
}

export function actionBadgeClass(action: string): string {
  const overrides: Record<string, string> = {
    'Import Attendance': 'bg-blue-50 text-blue-600',
  }
  if (overrides[action]) return overrides[action]

  if (action.startsWith('create_')) return 'bg-emerald-50 text-emerald-600'
  if (action.startsWith('update_') || action.startsWith('override_')) return 'bg-amber-50 text-amber-600'
  if (action.startsWith('archive_')) return 'bg-slate-100 text-slate-500'
  if (action.startsWith('delete_')) return 'bg-red-50 text-red-600'
  if (action.startsWith('attach_') || action.startsWith('link_')) return 'bg-indigo-50 text-indigo-600'

  return 'bg-slate-100 text-slate-600'
}

function fmtCurrency(v: any) {
  const n = Number(v)
  if (Number.isNaN(n)) return String(v)
  return `₱${n.toFixed(2)}`
}

function fmtDate(d: any) {
  try {
    const date = new Date(d)
    return formatDateFn(date, 'MMM d, yyyy')
  } catch (e) {
    return String(d)
  }
}

export function resolveRecordLabel(tableName: string | null | undefined, oldData: any, newData: any, recordId?: string | null) {
  const data = newData || oldData
  const t = (tableName || '').toLowerCase()
  if (!data) {
    if (tableName && recordId) return `${tableName} #${recordId}`
    if (tableName) return tableName
    return recordId ? `#${recordId}` : 'Record'
  }

  if (t.includes('employee')) return data.name || data.full_name || data.employee_name || data.id || (recordId ? `${tableName} #${recordId}` : '')
  if (t.includes('report_period')) {
    const rest = data.restaurant || ''
    const start = data.period_start ? fmtDate(data.period_start) : ''
    const end = data.period_end ? fmtDate(data.period_end) : ''
    return `${rest} ${start && end ? `(${start} – ${end})` : ''}`.trim() || (recordId ? `${tableName} #${recordId}` : '')
  }
  if (t.includes('payslip') || t.includes('payslips')) {
    const period = data.period_range ? ` (${data.period_range})` : ''
    return (data.employee_name || data.employee || data.name || (data.payslip_id ? `Payslip ${data.payslip_id}` : (recordId ? `${tableName} #${recordId}` : 'Payslip'))) + period
  }
  if (t.includes('service_transaction')) {
    const rest = data.restaurant || ''
    const price = data.price != null ? fmtCurrency(data.price) : ''
    const date = data.service_date ? fmtDate(data.service_date) : ''
    const status = data.status ? ` (${data.status})` : ''
    const label = `${rest} service transaction${date ? ` — ${date}` : ''}${price ? ` — ${price}` : ''}${status}`.trim()
    return label || (recordId ? `${tableName} #${recordId}` : '')
  }
  if (t.includes('production_inventory_transfers')) {
    const item = data.item_name || data.from_name
    const qty = data.quantity != null ? `${data.quantity}` : ''
    if (item) return `Transfer of ${qty ? `${qty} ` : ''}${item}`.trim()
    return recordId ? `${tableName} #${recordId}` : ''
  }
  if (t.includes('production_inventory') || t.includes('food_and_beverage') || t.includes('food_and_beverage_inventory') || t.includes('assets_inventory') || t.includes('services') || t.includes('sub_services') || t.includes('food_packages')) {
    return data.name || data.item_name || data.service_type || data.id || (recordId ? `${tableName} #${recordId}` : '')
  }
  if (t.includes('cash_advance')) return data.amount_deducted ? `${fmtCurrency(data.amount_deducted)} (${data.period_range || (data.report_period_id ? `period ${data.report_period_id}` : 'no period')})`.trim() : data.id || (recordId ? `${tableName} #${recordId}` : '')
  if (t.includes('attendance')) return `${data.employee_name || data.employee_id || ''}${data.work_date ? ` • ${fmtDate(data.work_date)}` : ''}`.trim() || (recordId ? `${tableName} #${recordId}` : '')
  if (t.includes('service_sub_services') || t.includes('service_sub_service') || t.includes('service_sub') || t.includes('service_subs')) {
    // prefer both names if available
    const subName = data.sub_service_name || data.name || data.sub_service?.name
    const parentName = data.service_name || data.parent_name || data.service?.name
    if (subName && parentName) return `${subName} → ${parentName}`
    return subName || parentName || (recordId ? `${tableName} #${recordId}` : '')
  }

  // fallback
  return data.name || data.id || (tableName ? `${tableName} #${recordId}` : (recordId ? `#${recordId}` : 'Record'))
}

export function generateAuditDescription({ action, tableName, recordId, oldData, newData }: { action: string, tableName?: string | null, recordId?: string | null, oldData?: any, newData?: any }) {
  // handle composite keys like "1:2"
  if (recordId && recordId.includes(':')) {
    // composite/junction record — try to build an informative label
    const [a, b] = recordId.split(':')
    const attachedName = newData?.name || newData?.service_name || newData?.sub_service_name || newData?.sub_service?.name
    const parentName = newData?.parent_name || newData?.service_name || newData?.service?.name
    if (action.startsWith('attach_')) {
      if (attachedName && parentName) return `${formatActionLabel(action)}: ${attachedName} to ${parentName}`
      if (attachedName) return `${formatActionLabel(action)}: ${attachedName}`
      return `${formatActionLabel(action)}: ${tableName} ${recordId}`
    }
    // fallback to a generic label
    const compositeLabel = `${tableName || 'Record'} ${a}:${b}`
    return `${formatActionLabel(action)}: ${compositeLabel}`
  }

  // delete
  if (oldData && !newData) {
    const label = resolveRecordLabel(tableName, oldData, newData, recordId)
    return `${label}: ${formatActionLabel(action)}`
  }

  // inventory transfers — raw from/to ids aren't meaningful, keep it concise
  const tName = (tableName || '').toLowerCase()
  if (tName.includes('production_inventory_transfers') && newData) {
    const label = resolveRecordLabel(tableName, oldData, newData, recordId)
    return `${label}: ${formatActionLabel(action)}`
  }

  // create
  if (!oldData && newData) {
    const label = resolveRecordLabel(tableName, oldData, newData, recordId)
    return `${label}: ${formatActionLabel(action)}`.trim()
  }

  // update with both
  if (oldData && newData) {
    // shallow diff
    const ignore = new Set(['updated_at', 'created_at', 'id', 'log_id'])
    const diffs: { field: string; old: any; nw: any }[] = []
    for (const k of Object.keys({ ...oldData, ...newData })) {
      if (ignore.has(k)) continue
      const ov = oldData[k]
      const nv = newData[k]
      if (JSON.stringify(ov) !== JSON.stringify(nv)) {
        diffs.push({ field: k, old: ov, nw: nv })
      }
    }
    const label = resolveRecordLabel(tableName, oldData, newData, recordId)
    if (diffs.length === 0) return `${label}: No changes detected`
    if (diffs.length <= 3) {
      const parts = diffs.map(d => {
        const oldStr = typeof d.old === 'number' ? d.old : (d.field.toLowerCase().includes('date') ? fmtDate(d.old) : String(d.old))
        const newStr = typeof d.nw === 'number' ? d.nw : (d.field.toLowerCase().includes('date') ? fmtDate(d.nw) : String(d.nw))
        return `${d.field} changed from ${oldStr} to ${newStr}`
      })
      return `${label}: ${formatActionLabel(action)} — ${parts.join('; ')}`
    }
    const topFields = diffs.slice(0, 3).map(d => d.field).join(', ')
    return `${label}: ${formatActionLabel(action)} — updated ${diffs.length} fields (${topFields})`
  }

  // update with only newData (no old to diff)
  if (!oldData && newData) {
    const label = resolveRecordLabel(tableName, oldData, newData, recordId)
    // provide a concise current-state description
    return `${label}: ${formatActionLabel(action)}`
  }

  return formatActionLabel(action)
}

export default {
  formatActionLabel,
  actionBadgeClass,
  generateAuditDescription,
}
