import type { Employee } from "../types"

// Central mapper: PostgreSQL row → frontend Employee shape
// Ensures GET / POST / PUT all return the same structure
export function mapEmployee(row: any): Employee {
  return {
    id: String(row.employee_id),
    source_employee_id: String(row.source_employee_id),
    name: row.name ?? '',
    department: row.department ?? '',
    restaurant: row.restaurant ?? '',
    pay_per_day: Number(row.pay_per_day ?? 0),
    status: row.status ?? 'Active',
    email: row.email ?? '',
    contactNumber: row.contact_number ?? '',
    sss: row.sss != null ? Number(row.sss) : undefined,
    philhealth: row.philhealth != null ? Number(row.philhealth) : undefined,
    pagibig: row.pagibig != null ? Number(row.pagibig) : undefined,
    month_pay_13th: row.month_pay_13th != null ? Number(row.month_pay_13th) : undefined,
  }
}

export default mapEmployee