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
  | 'sales-summary'
  | 'sales'
  | 'inventory-catalog'
  | 'expenses'
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
  day?: string
  timeIn: string
  timeOut: string
  firstOnDuty?: string | null
  firstOffDuty?: string | null
  secondOnDuty?: string | null
  secondOffDuty?: string | null
  overtimeCheckIn?: string | null
  overtimeCheckOut?: string | null
  lateMinutes: number
  undertimeMinutes: number
  overtimeHours: number
  status: 'Present' | 'Absent' | 'Leave' | 'Rest Day' | 'Holiday' | 'Incomplete' | 'Overtime'
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

export type InventoryCategory = 'Menu Item' | 'Others'

export interface InventoryItem {
  id: string
  item: string
  cost: number
  category: InventoryCategory
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
}

export interface SaleRecord {
  id: string
  item: string
  cost: number
  numberOfSales: number
  discount: number
  category: InventoryCategory
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
}

export interface ExpenseRecord {
  id: string
  expense: string
  amount: number
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
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
  inventoryItems: InventoryItem[]
  setInventoryItems: React.Dispatch<React.SetStateAction<InventoryItem[]>>
  salesRecords: SaleRecord[]
  setSalesRecords: React.Dispatch<React.SetStateAction<SaleRecord[]>>
  expenses: ExpenseRecord[]
  setExpenses: React.Dispatch<React.SetStateAction<ExpenseRecord[]>>
  activePayrollPeriod: PayrollPeriod | null
  setActivePayrollPeriod: React.Dispatch<React.SetStateAction<PayrollPeriod | null>>
  appMode: 'aroo' | 'lakayAgo'
  setAppMode: React.Dispatch<React.SetStateAction<'aroo' | 'lakayAgo'>>

  // new
  openEmployee?: (id: string) => void
  clearOpenEmployee?: () => void
  openEmployeeId?: string | null
}
