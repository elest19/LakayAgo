import type { Employee } from "../types"

// Exported so routes that build their own employee payloads (e.g. GET /api/leave_requests)
// normalise status exactly the way GET /api/employees does.
export const formatEmployeeStatus = (status?: string | null): Employee["status"] => {
  const normalized = String(status ?? '').trim().toLowerCase()

  if (normalized === 'inactive') return 'Inactive'
  if (normalized === 'fired') return 'Inactive'
  return 'Active'
}

const coerceDateOnly = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null

  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const text = String(value).trim()
  const match = text.match(/^\d{4}-\d{2}-\d{2}/)
  if (match) return match[0]

  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear()
    const month = String(parsed.getMonth() + 1).padStart(2, '0')
    const day = String(parsed.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  return null
}

const pickDateValue = (row: any, keys: string[]) => {
  for (const key of keys) {
    const normalized = coerceDateOnly(row?.[key])
    if (normalized) return normalized
  }

  return null
}

// Central mapper: PostgreSQL row → frontend Employee shape
// Ensures GET / POST / PUT all return the same structure
export function mapEmployee(row: any): Employee {
  const employeeId = row?.employee_id ?? row?.id ?? null
  const sourceEmployeeId = row?.source_employee_id ?? row?.sourceEmployeeId ?? row?.sourceId ?? row?.employeeId ?? ''

  return {
    id: String(employeeId ?? ''),
    source_employee_id: String(sourceEmployeeId ?? ''),
    name: row?.name ?? '',
    department: row?.department ?? '',
    restaurant: row?.restaurant ?? '',
    pay_per_day: Number(row?.pay_per_day ?? row?.payPerDay ?? 0),
    status: formatEmployeeStatus(row?.status),
    address: row?.address ?? row?.email ?? '',
    contactNumber: row?.contact_number ?? row?.contactNumber ?? '',
    sss: row?.sss != null ? Number(row.sss) : undefined,
    philhealth: row?.philhealth != null ? Number(row.philhealth) : undefined,
    pagibig: row?.pagibig != null ? Number(row.pagibig) : undefined,
    month_pay_13th: row?.month_pay_13th != null ? Number(row.month_pay_13th) : undefined,
    start_date: pickDateValue(row, ['start_date', 'startDate', 'start_month', 'startMonth']),
    special_month_pay: pickDateValue(row, ['special_month_pay', 'specialMonthPay']),
  }
}

export default mapEmployee