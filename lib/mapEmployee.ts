import type { Employee } from "../types"

// Exported so routes that build their own employee payloads (e.g. GET /api/leave_requests)
// normalise status exactly the way GET /api/employees does.
export const formatEmployeeStatus = (status?: string | null): Employee["status"] => {
  const normalized = String(status ?? '').trim().toLowerCase()

  if (normalized === 'inactive') return 'Inactive'
  if (normalized === 'fired') return 'Inactive'
  return 'Active'
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
    start_date: row?.start_date ?? row?.startDate ?? row?.start_month ?? row?.startMonth ? String(row?.start_date ?? row?.startDate ?? row?.start_month ?? row?.startMonth).slice(0, 10) : null,
    special_month_pay: row?.special_month_pay ?? row?.specialMonthPay ? String(row?.special_month_pay ?? row?.specialMonthPay).slice(0, 10) : null,
  }
}

export default mapEmployee