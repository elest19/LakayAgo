export type Page =
  | 'login'
  | 'dashboard'
  | 'employees'
  | 'attendance-records'
  | 'import-attendance'
  | 'import-history'
  | 'payroll-periods'
  | 'payroll-history'
  | 'process-payroll'
  | 'payslips'
  | 'leave-management'
  | 'reports'
  | 'settings'
  | 'audit-logs'

export interface Employee {
  id: string
  firstName: string
  lastName: string
  middleName: string
  sex: 'Male' | 'Female'
  department: string
  position: string
  employmentType: 'Full-Time' | 'Part-Time' | 'Contractual'
  basicSalary: number
  status: 'Active' | 'Inactive' | 'On Leave'
  dateHired: string
  email: string
  contactNumber: string
  address: string
  dateOfBirth: string
  salaryType: 'Monthly' | 'Daily'
  allowance: number
  paymentMethod: 'Bank Transfer' | 'Cash' | 'Check'
  supervisor: string
}

export interface AttendanceRecord {
  id: string
  employeeId: string
  employeeName: string
  department: string
  date: string
  timeIn: string
  timeOut: string
  lateMinutes: number
  undertimeMinutes: number
  overtimeHours: number
  status: 'Present' | 'Absent' | 'Leave' | 'Rest Day' | 'Holiday' | 'Incomplete'
}

export interface PayrollPeriod {
  id: string
  label: string
  startDate: string
  endDate: string
  payDate: string
  payrollType: 'Semi-Monthly' | 'Monthly' | 'Bi-Weekly' | 'Weekly'
  employees: number
  attendanceStatus: string
  grossPayroll: number
  deductions: number
  netPayroll: number
  status:
    | 'Pending'
    | 'Attendance Imported'
    | 'Validation Required'
    | 'Ready for Payroll'
    | 'Calculated'
    | 'Under Review'
    | 'Approved'
    | 'Finalized'
}

export interface LeaveRequest {
  id: string
  employeeId: string
  employeeName: string
  department: string
  leaveType: string
  startDate: string
  endDate: string
  days: number
  reason: string
  status: 'Pending' | 'Approved' | 'Rejected'
}

export interface ImportRecord {
  id: string
  dateImported: string
  fileName: string
  records: number
  employees: number
  importedBy: string
  status: 'Successful' | 'Partially Imported' | 'Failed' | 'Reverted'
}

export interface ImportEntry {
  employeeId: string
  employeeName: string
  date: string
  timeIn?: string
  timeOut?: string
  status: AttendanceRecord['status']
}

// make entries optional so older mock records without entries are still valid
export interface ImportRecord {
  id: string
  dateImported: string
  fileName: string
  records: number
  employees: number
  importedBy: string
  status: 'Successful' | 'Partially Imported' | 'Failed' | 'Reverted'
  entries?: ImportEntry[]
}

export interface AuditLog {
  id: string
  dateTime: string
  user: string
  action: string
  module: string
  description: string
}

export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  description?: string
}

export interface AppContextType {
  currentPage: Page
  navigate: (page: Page) => void
  showToast: (toast: Omit<Toast, 'id'>) => void

  // new
  openEmployee?: (id: string) => void
  clearOpenEmployee?: () => void
  openEmployeeId?: string | null
}
