export type Page =
  | 'login'
  | 'dashboard'
  | 'employees'
  | 'attendance-records'
  | 'import-attendance'
  | 'import-history'
  | 'payroll-periods'
  | 'payroll-history'
  | 'cash-advance'
  | 'process-payroll'
  | 'payslips'
  | 'leave-management'
  | 'sales-summary'
  | 'sales'
  | 'inventory-catalog'
  | 'production-catalog'
  | 'kitchen-catalog'
  | 'expenses'
  | 'reports'
  | 'settings'
  | 'audit-logs'

export interface Employee {
  id: string
  source_employee_id: string
  name: string
  department: string
  restaurant: string
  pay_per_day: number
  status: 'Active' | 'Inactive' | 'On Leave'
  email: string
  contactNumber: string
  sss?: number
  philhealth?: number
  pagibig?: number
  month_pay_13th?: number
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
  overtimeMinutes: number
  status: 'Present' | 'Absent' | 'Leave' | 'On Leave' | 'Rest Day' | 'Holiday' | 'Incomplete' | 'Overtime'
}

export interface PayrollPeriod {
  id?: number
  period_id?: number
  report_period_id: number
  period_start: string
  period_end: string
  tabulation_date: string
  source_file: string | null
  created_at: string
  restaurant: string
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
  department?: string
  restaurant?: string
  employeeRestaurant?: string
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
  stock: number
  linkedKitchenItemId: string | null
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

export interface ProductionItem {
  id: string
  itemName: string
  department: string
  stock: number
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
}

export interface KitchenItem {
  id: string
  itemName: string
  department: string
  stock: number
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
}

export type StockTransactionType = 'TRANSFER' | 'SELF_PRODUCE' | 'SALE'

export interface StockTransaction {
  id: string
  itemName: string
  type: StockTransactionType
  quantity: number
  from: 'production' | 'kitchen' | null
  to: 'kitchen' | 'menu' | null
  timestamp: string
  performedBy: string
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
  productionStock: ProductionItem[]
  setProductionStock: React.Dispatch<React.SetStateAction<ProductionItem[]>>
  kitchenStock: KitchenItem[]
  setKitchenStock: React.Dispatch<React.SetStateAction<KitchenItem[]>>
  salesRecords: SaleRecord[]
  setSalesRecords: React.Dispatch<React.SetStateAction<SaleRecord[]>>
  expenses: ExpenseRecord[]
  setExpenses: React.Dispatch<React.SetStateAction<ExpenseRecord[]>>
  stockTransactions: StockTransaction[]
  transferToKitchen: (itemName: string, qty: number, department: string) => boolean
  kitchenSelfProduce: (itemName: string, qty: number, department: string) => boolean
  sellMenuItem: (itemName: string, qty: number) => boolean
  activePayrollPeriod: PayrollPeriod | null
  setActivePayrollPeriod: React.Dispatch<React.SetStateAction<PayrollPeriod | null>>
  appMode: 'aroo' | 'lakayAgo'
  setAppMode: React.Dispatch<React.SetStateAction<'aroo' | 'lakayAgo'>>
  logoSrc: string

  // auth
  user?: any | null
  setUser?: React.Dispatch<React.SetStateAction<any | null>>
  authLoading?: boolean
  logout?: () => Promise<void>
  apiFetch?: typeof fetch

  // new
  openEmployee?: (id: string) => void
  clearOpenEmployee?: () => void
  openEmployeeId?: string | null
}
