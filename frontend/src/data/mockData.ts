import type { Employee, AttendanceRecord, PayrollPeriod, LeaveRequest, ImportRecord, AuditLog, InventoryItem, SaleRecord, ExpenseRecord } from '../types'

export const employees: Employee[] = [
  { id: 'EMP-001', firstName: 'Juan', lastName: 'Dela Cruz', middleName: 'Ramos', sex: 'Male', department: 'Kitchen', position: 'Chef', employmentType: 'Full-Time', basicSalary: 25000, status: 'Active', dateHired: '2021-03-15', email: 'juan.delacruz@company.ph', contactNumber: '09171234567', address: '123 Mabini St., Quezon City', dateOfBirth: '1992-06-14', salaryType: 'Monthly', allowance: 2000, paymentMethod: 'Bank Transfer', supervisor: 'Ricardo Reyes', sss: 500, philHealth: 150, pagibig: 100 },
  { id: 'EMP-002', firstName: 'Maria', lastName: 'Santos', middleName: 'Lim', sex: 'Female', department: 'Production', position: 'Waiters', employmentType: 'Full-Time', basicSalary: 22000, status: 'Active', dateHired: '2020-07-01', email: 'maria.santos@company.ph', contactNumber: '09281234567', address: '45 Rizal Ave., Makati', dateOfBirth: '1995-01-22', salaryType: 'Monthly', allowance: 1500, paymentMethod: 'Bank Transfer', supervisor: 'Lorna Bautista', sss: 480, philHealth: 140, pagibig: 100 },
  { id: 'EMP-003', firstName: 'Roberto', lastName: 'Reyes', middleName: 'Cruz', sex: 'Male', department: 'Kitchen', position: 'Management', employmentType: 'Full-Time', basicSalary: 28000, status: 'Active', dateHired: '2019-11-10', email: 'roberto.reyes@company.ph', contactNumber: '09391234567', address: '78 Aguinaldo Ave., Pasig', dateOfBirth: '1990-09-05', salaryType: 'Monthly', allowance: 2500, paymentMethod: 'Bank Transfer', supervisor: 'Cesar Villanueva', sss: 520, philHealth: 160, pagibig: 110 },
  { id: 'EMP-004', firstName: 'Ana', lastName: 'Garcia', middleName: 'Torres', sex: 'Female', department: 'Production', position: 'Waiters', employmentType: 'Full-Time', basicSalary: 30000, status: 'Active', dateHired: '2018-05-20', email: 'ana.garcia@company.ph', contactNumber: '09451234567', address: '22 Bonifacio St., Taguig', dateOfBirth: '1988-03-17', salaryType: 'Monthly', allowance: 3000, paymentMethod: 'Bank Transfer', supervisor: 'Eduardo Mendoza', sss: 540, philHealth: 170, pagibig: 120 },
  { id: 'EMP-005', firstName: 'Carlo', lastName: 'Mendoza', middleName: 'Aquino', sex: 'Male', department: 'Kitchen', position: 'Cashiers', employmentType: 'Full-Time', basicSalary: 20000, status: 'Active', dateHired: '2022-01-10', email: 'carlo.mendoza@company.ph', contactNumber: '09561234567', address: '9 Magsaysay Blvd., Manila', dateOfBirth: '1997-11-30', salaryType: 'Monthly', allowance: 1000, paymentMethod: 'Cash', supervisor: 'Ana Garcia', sss: 480, philHealth: 140, pagibig: 100 },
  { id: 'EMP-006', firstName: 'Lorna', lastName: 'Bautista', middleName: 'Navarro', sex: 'Female', department: 'Kitchen', position: 'Cashiers', employmentType: 'Full-Time', basicSalary: 45000, status: 'Active', dateHired: '2016-08-01', email: 'lorna.bautista@company.ph', contactNumber: '09671234567', address: '55 Osmeña Blvd., Cebu City', dateOfBirth: '1985-07-08', salaryType: 'Monthly', allowance: 5000, paymentMethod: 'Bank Transfer', supervisor: 'Eduardo Mendoza', sss: 600, philHealth: 180, pagibig: 120 },
  { id: 'EMP-007', firstName: 'Mark', lastName: 'Villanueva', middleName: 'Flores', sex: 'Male', department: 'Kitchen', position: 'Management', employmentType: 'Full-Time', basicSalary: 27000, status: 'On Leave', dateHired: '2020-02-14', email: 'mark.villanueva@company.ph', contactNumber: '09781234567', address: '101 Quezon Ave., Quezon City', dateOfBirth: '1993-04-25', salaryType: 'Monthly', allowance: 2000, paymentMethod: 'Bank Transfer', supervisor: 'Ricardo Reyes', sss: 520, philHealth: 160, pagibig: 110 },
  { id: 'EMP-008', firstName: 'Grace', lastName: 'Torres', middleName: 'Castillo', sex: 'Female', department: 'Production', position: 'Cashiers', employmentType: 'Full-Time', basicSalary: 24000, status: 'Active', dateHired: '2021-09-06', email: 'grace.torres@company.ph', contactNumber: '09891234567', address: '33 Katipunan Ave., Quezon City', dateOfBirth: '1994-12-01', salaryType: 'Monthly', allowance: 1500, paymentMethod: 'Bank Transfer', supervisor: 'Roberto Reyes', sss: 480, philHealth: 140, pagibig: 100 },
  { id: 'EMP-009', firstName: 'Paolo', lastName: 'Aquino', middleName: 'Rivera', sex: 'Male', department: 'Kitchen', position: 'Waiters', employmentType: 'Full-Time', basicSalary: 22000, status: 'Active', dateHired: '2022-06-13', email: 'paolo.aquino@company.ph', contactNumber: '09121234567', address: '67 Taft Ave., Manila', dateOfBirth: '1996-08-19', salaryType: 'Monthly', allowance: 1500, paymentMethod: 'Bank Transfer', supervisor: 'Ana Garcia', sss: 480, philHealth: 140, pagibig: 100 },
  { id: 'EMP-010', firstName: 'Diana', lastName: 'Ramos', middleName: 'De Leon', sex: 'Female', department: 'Production', position: 'Management', employmentType: 'Full-Time', basicSalary: 40000, status: 'Active', dateHired: '2017-03-28', email: 'diana.ramos@company.ph', contactNumber: '09231234567', address: '88 Shaw Blvd., Mandaluyong', dateOfBirth: '1987-10-14', salaryType: 'Monthly', allowance: 4000, paymentMethod: 'Bank Transfer', supervisor: 'Eduardo Mendoza', sss: 700, philHealth: 200, pagibig: 120 },
  { id: 'EMP-011', firstName: 'Jonel', lastName: 'Castillo', middleName: 'Hizon', sex: 'Male', department: 'Kitchen', position: 'Waiters', employmentType: 'Full-Time', basicSalary: 23000, status: 'Active', dateHired: '2023-01-16', email: 'jonel.castillo@company.ph', contactNumber: '09341234567', address: '12 Espana Blvd., Manila', dateOfBirth: '1998-02-03', salaryType: 'Monthly', allowance: 2000, paymentMethod: 'Bank Transfer', supervisor: 'Juan Dela Cruz', sss: 480, philHealth: 140, pagibig: 100 },
  { id: 'EMP-012', firstName: 'Aileen', lastName: 'Rivera', middleName: 'Ocampo', sex: 'Female', department: 'Kitchen', position: 'Management', employmentType: 'Full-Time', basicSalary: 18000, status: 'Active', dateHired: '2021-11-22', email: 'aileen.rivera@company.ph', contactNumber: '09451234568', address: '25 Commonwealth Ave., Quezon City', dateOfBirth: '1995-05-12', salaryType: 'Monthly', allowance: 1000, paymentMethod: 'Cash', supervisor: 'Lorna Bautista', sss: 460, philHealth: 130, pagibig: 90 },
  { id: 'EMP-013', firstName: 'Rodel', lastName: 'Flores', middleName: 'Manalo', sex: 'Male', department: 'Production', position: 'Office Manager', employmentType: 'Full-Time', basicSalary: 32000, status: 'Active', dateHired: '2018-10-04', email: 'rodel.flores@company.ph', contactNumber: '09561234568', address: '77 EDSA, Mandaluyong', dateOfBirth: '1986-07-29', salaryType: 'Monthly', allowance: 3000, paymentMethod: 'Bank Transfer', supervisor: 'Eduardo Mendoza', sss: 560, philHealth: 170, pagibig: 120 },
  { id: 'EMP-014', firstName: 'Christine', lastName: 'Navarro', middleName: 'Pablo', sex: 'Female', department: 'Production', position: 'Management', employmentType: 'Contractual', basicSalary: 20000, status: 'Active', dateHired: '2023-07-01', email: 'christine.navarro@company.ph', contactNumber: '09671234568', address: '56 Kalayaan Ave., Makati', dateOfBirth: '1999-09-16', salaryType: 'Monthly', allowance: 1500, paymentMethod: 'Bank Transfer', supervisor: 'Juan Dela Cruz', sss: 460, philHealth: 130, pagibig: 90 },
  { id: 'EMP-015', firstName: 'Eduardo', lastName: 'Mendoza', middleName: 'Agustin', sex: 'Male', department: 'Kitchen', position: 'Waiters', employmentType: 'Full-Time', basicSalary: 80000, status: 'Active', dateHired: '2014-01-06', email: 'eduardo.mendoza@company.ph', contactNumber: '09781234568', address: '10 Ayala Ave., Makati', dateOfBirth: '1978-04-22', salaryType: 'Monthly', allowance: 10000, paymentMethod: 'Bank Transfer', supervisor: '', sss: 900, philHealth: 250, pagibig: 150 },
]

export const departments = ['Production', 'Kitchen']

export const attendanceRecords: AttendanceRecord[] = [
  { id: 'ATT-001', employeeId: 'EMP-001', employeeName: 'Juan Dela Cruz', department: 'Kitchen', date: 'Aug 1, 2026', day: 'WED', timeIn: '8:03 AM', timeOut: '5:00 PM', firstOnDuty: '08:03', firstOffDuty: '17:00', secondOnDuty: null, secondOffDuty: null, overtimeCheckIn: null, overtimeCheckOut: null, lateMinutes: 3, undertimeMinutes: 0, overtimeHours: 0, status: 'Present' },
  { id: 'ATT-002', employeeId: 'EMP-002', employeeName: 'Maria Santos', department: 'Production', date: 'Aug 1, 2026', day: 'WED', timeIn: '8:00 AM', timeOut: '6:00 PM', firstOnDuty: '08:00', firstOffDuty: '18:00', secondOnDuty: null, secondOffDuty: null, overtimeCheckIn: null, overtimeCheckOut: null, lateMinutes: 0, undertimeMinutes: 0, overtimeHours: 1, status: 'Present' },
  { id: 'ATT-003', employeeId: 'EMP-003', employeeName: 'Roberto Reyes', department: 'Kitchen', date: 'Aug 1, 2026', day: 'WED', timeIn: '8:15 AM', timeOut: '5:00 PM', firstOnDuty: '08:15', firstOffDuty: '17:00', secondOnDuty: null, secondOffDuty: null, overtimeCheckIn: null, overtimeCheckOut: null, lateMinutes: 15, undertimeMinutes: 0, overtimeHours: 0, status: 'Present' },
  { id: 'ATT-004', employeeId: 'EMP-004', employeeName: 'Ana Garcia', department: 'Production', date: 'Aug 1, 2026', day: 'WED', timeIn: '8:00 AM', timeOut: '5:00 PM', firstOnDuty: '08:00', firstOffDuty: '17:00', secondOnDuty: null, secondOffDuty: null, overtimeCheckIn: null, overtimeCheckOut: null, lateMinutes: 0, undertimeMinutes: 0, overtimeHours: 0, status: 'Present' },
  { id: 'ATT-005', employeeId: 'EMP-005', employeeName: 'Carlo Mendoza', department: 'Kitchen', date: 'Aug 1, 2026', day: 'WED', timeIn: '', timeOut: '', firstOnDuty: null, firstOffDuty: null, secondOnDuty: null, secondOffDuty: null, overtimeCheckIn: null, overtimeCheckOut: null, lateMinutes: 0, undertimeMinutes: 0, overtimeHours: 0, status: 'Absent' },
  { id: 'ATT-006', employeeId: 'EMP-006', employeeName: 'Lorna Bautista', department: 'Kitchen', date: 'Aug 1, 2026', day: 'WED', timeIn: '8:00 AM', timeOut: '5:00 PM', firstOnDuty: '08:00', firstOffDuty: '17:00', secondOnDuty: null, secondOffDuty: null, overtimeCheckIn: null, overtimeCheckOut: null, lateMinutes: 0, undertimeMinutes: 0, overtimeHours: 0, status: 'Present' },
  { id: 'ATT-007', employeeId: 'EMP-007', employeeName: 'Mark Villanueva', department: 'Kitchen', date: 'Aug 1, 2026', day: 'WED', timeIn: '', timeOut: '', firstOnDuty: null, firstOffDuty: null, secondOnDuty: null, secondOffDuty: null, overtimeCheckIn: null, overtimeCheckOut: null, lateMinutes: 0, undertimeMinutes: 0, overtimeHours: 0, status: 'Leave' },
  { id: 'ATT-008', employeeId: 'EMP-008', employeeName: 'Grace Torres', department: 'Production', date: 'Aug 1, 2026', day: 'WED', timeIn: '8:05 AM', timeOut: '4:45 PM', firstOnDuty: '08:05', firstOffDuty: '16:45', secondOnDuty: null, secondOffDuty: null, overtimeCheckIn: null, overtimeCheckOut: null, lateMinutes: 5, undertimeMinutes: 15, overtimeHours: 0, status: 'Present' },
  { id: 'ATT-009', employeeId: 'EMP-009', employeeName: 'Paolo Aquino', department: 'Production', date: 'Aug 1, 2026', day: 'WED', timeIn: '8:00 AM', timeOut: '6:30 PM', firstOnDuty: '08:00', firstOffDuty: '18:30', secondOnDuty: null, secondOffDuty: null, overtimeCheckIn: null, overtimeCheckOut: null, lateMinutes: 0, undertimeMinutes: 0, overtimeHours: 1.5, status: 'Present' },
  { id: 'ATT-010', employeeId: 'EMP-010', employeeName: 'Diana Ramos', department: 'Production', date: 'Aug 1, 2026', day: 'WED', timeIn: '8:00 AM', timeOut: '5:00 PM', firstOnDuty: '08:00', firstOffDuty: '17:00', secondOnDuty: null, secondOffDuty: null, overtimeCheckIn: null, overtimeCheckOut: null, lateMinutes: 0, undertimeMinutes: 0, overtimeHours: 0, status: 'Present' },
  { id: 'ATT-011', employeeId: 'EMP-011', employeeName: 'Jonel Castillo', department: 'Production', date: 'Aug 2, 2026', day: 'THU', timeIn: '8:00 AM', timeOut: '5:00 PM', firstOnDuty: '08:00', firstOffDuty: '17:00', secondOnDuty: null, secondOffDuty: null, overtimeCheckIn: null, overtimeCheckOut: null, lateMinutes: 0, undertimeMinutes: 0, overtimeHours: 0, status: 'Present' },
  { id: 'ATT-012', employeeId: 'EMP-012', employeeName: 'Aileen Rivera', department: 'Production', date: 'Aug 2, 2026', day: 'THU', timeIn: '8:10 AM', timeOut: '5:00 PM', firstOnDuty: '08:10', firstOffDuty: '17:00', secondOnDuty: null, secondOffDuty: null, overtimeCheckIn: null, overtimeCheckOut: null, lateMinutes: 10, undertimeMinutes: 0, overtimeHours: 0, status: 'Present' },
  { id: 'ATT-013', employeeId: 'EMP-013', employeeName: 'Rodel Flores', department: 'Production', date: 'Aug 2, 2026', day: 'THU', timeIn: '', timeOut: '', firstOnDuty: null, firstOffDuty: null, secondOnDuty: null, secondOffDuty: null, overtimeCheckIn: null, overtimeCheckOut: null, lateMinutes: 0, undertimeMinutes: 0, overtimeHours: 0, status: 'Incomplete' },
  { id: 'ATT-014', employeeId: 'EMP-014', employeeName: 'Christine Navarro', department: 'Production', date: 'Aug 2, 2026', day: 'THU', timeIn: '8:00 AM', timeOut: '5:00 PM', firstOnDuty: '08:00', firstOffDuty: '17:00', secondOnDuty: null, secondOffDuty: null, overtimeCheckIn: null, overtimeCheckOut: null, lateMinutes: 0, undertimeMinutes: 0, overtimeHours: 0, status: 'Present' },
  { id: 'ATT-015', employeeId: 'EMP-015', employeeName: 'Eduardo Mendoza', department: 'Kitchen', date: 'Aug 2, 2026', day: 'THU', timeIn: '8:00 AM', timeOut: '7:00 PM', firstOnDuty: '08:00', firstOffDuty: '19:00', secondOnDuty: null, secondOffDuty: null, overtimeCheckIn: null, overtimeCheckOut: null, lateMinutes: 0, undertimeMinutes: 0, overtimeHours: 2, status: 'Present' },
]

export const upsertAttendanceRecords = (records: AttendanceRecord[]) => {
  const nextMap = new Map(attendanceRecords.map(record => [`${record.employeeId}-${record.date}`, record]))

  for (const record of records) {
    nextMap.set(`${record.employeeId}-${record.date}`, record)
  }

  attendanceRecords.splice(0, attendanceRecords.length, ...[...nextMap.values()])
}

export const payrollPeriods: PayrollPeriod[] = [
  { id: 'PP-001', label: 'August 1–15, 2026', startDate: '2026-08-01', endDate: '2026-08-15', payDate: '2026-08-20', payrollType: 'Semi-Monthly', employees: 45, attendanceStatus: 'Imported', grossPayroll: 512350, deductions: 74820, netPayroll: 437530, status: 'Under Review' },
  { id: 'PP-002', label: 'July 16–31, 2026', startDate: '2026-07-16', endDate: '2026-07-31', payDate: '2026-08-05', payrollType: 'Semi-Monthly', employees: 45, attendanceStatus: 'Imported', grossPayroll: 508900, deductions: 73640, netPayroll: 435260, status: 'Finalized' },
  { id: 'PP-003', label: 'July 1–15, 2026', startDate: '2026-07-01', endDate: '2026-07-15', payDate: '2026-07-20', payrollType: 'Semi-Monthly', employees: 44, attendanceStatus: 'Imported', grossPayroll: 502100, deductions: 72800, netPayroll: 429300, status: 'Finalized' },
  { id: 'PP-004', label: 'June 16–30, 2026', startDate: '2026-06-16', endDate: '2026-06-30', payDate: '2026-07-05', payrollType: 'Semi-Monthly', employees: 44, attendanceStatus: 'Imported', grossPayroll: 498750, deductions: 71900, netPayroll: 426850, status: 'Finalized' },
  { id: 'PP-005', label: 'June 1–15, 2026', startDate: '2026-06-01', endDate: '2026-06-15', payDate: '2026-06-20', payrollType: 'Semi-Monthly', employees: 43, attendanceStatus: 'Imported', grossPayroll: 492600, deductions: 70500, netPayroll: 422100, status: 'Finalized' },
  { id: 'PP-006', label: 'August 16–31, 2026', startDate: '2026-08-16', endDate: '2026-08-31', payDate: '2026-09-05', payrollType: 'Semi-Monthly', employees: 45, attendanceStatus: 'Pending', grossPayroll: 0, deductions: 0, netPayroll: 0, status: 'Pending' },
]

export const leaveRequests: LeaveRequest[] = [
  { id: 'LV-001', employeeId: 'EMP-007', employeeName: 'Mark Villanueva', department: 'Production', leaveType: 'Sick Leave', startDate: 'Aug 1, 2026', endDate: 'Aug 5, 2026', days: 5, reason: 'Medical condition requiring rest', status: 'Approved' },
  { id: 'LV-002', employeeId: 'EMP-005', employeeName: 'Carlo Mendoza', department: 'Production', leaveType: 'Vacation Leave', startDate: 'Aug 10, 2026', endDate: 'Aug 12, 2026', days: 3, reason: 'Family vacation', status: 'Pending' },
  { id: 'LV-003', employeeId: 'EMP-011', employeeName: 'Jonel Castillo', department: 'Production', leaveType: 'Emergency Leave', startDate: 'Aug 8, 2026', endDate: 'Aug 8, 2026', days: 1, reason: 'Family emergency', status: 'Approved' },
  { id: 'LV-004', employeeId: 'EMP-014', employeeName: 'Christine Navarro', department: 'Kitchen', leaveType: 'Vacation Leave', startDate: 'Aug 15, 2026', endDate: 'Aug 16, 2026', days: 2, reason: 'Personal trip', status: 'Pending' },
  { id: 'LV-005', employeeId: 'EMP-012', employeeName: 'Aileen Rivera', department: 'Production', leaveType: 'Sick Leave', startDate: 'Jul 28, 2026', endDate: 'Jul 29, 2026', days: 2, reason: 'Flu', status: 'Approved' },
  { id: 'LV-006', employeeId: 'EMP-009', employeeName: 'Paolo Aquino', department: 'Kitchen', leaveType: 'Vacation Leave', startDate: 'Jul 21, 2026', endDate: 'Jul 22, 2026', days: 2, reason: 'Rest and recreation', status: 'Approved' },
  { id: 'LV-007', employeeId: 'EMP-003', employeeName: 'Roberto Reyes', department: 'Production', leaveType: 'Bereavement Leave', startDate: 'Jul 10, 2026', endDate: 'Jul 12, 2026', days: 3, reason: 'Death of relative', status: 'Approved' },
  { id: 'LV-008', employeeId: 'EMP-008', employeeName: 'Grace Torres', department: 'Kitchen', leaveType: 'Vacation Leave', startDate: 'Aug 18, 2026', endDate: 'Aug 20, 2026', days: 3, reason: 'Planned vacation', status: 'Pending' },
  { id: 'LV-009', employeeId: 'EMP-002', employeeName: 'Maria Santos', department: 'Kitchen', leaveType: 'Sick Leave', startDate: 'Aug 6, 2026', endDate: 'Aug 6, 2026', days: 1, reason: 'Not feeling well', status: 'Rejected' },
  { id: 'LV-010', employeeId: 'EMP-006', employeeName: 'Lorna Bautista', department: 'Kitchen', leaveType: 'Vacation Leave', startDate: 'Sep 1, 2026', endDate: 'Sep 5, 2026', days: 5, reason: 'Planned rest', status: 'Pending' },
]

export const importHistory: ImportRecord[] = [
  {
    id: 'IMP-001',
    dateImported: 'Aug 11, 2026',
    fileName: 'attendance_aug_1_15_2026.xlsx',
    records: 245,
    employees: 45,
    importedBy: 'Admin',
    status: 'Successful',
    entries: [
      { employeeId: 'EMP-001', employeeName: 'Juan Dela Cruz', date: 'Aug 1, 2026', timeIn: '8:03 AM', timeOut: '5:00 PM', status: 'Present' },
      { employeeId: 'EMP-002', employeeName: 'Maria Santos', date: 'Aug 1, 2026', timeIn: '8:00 AM', timeOut: '6:00 PM', status: 'Present' },
      { employeeId: 'EMP-003', employeeName: 'Roberto Reyes', date: 'Aug 1, 2026', timeIn: '8:15 AM', timeOut: '5:00 PM', status: 'Present' },
    ],
  },
  {
    id: 'IMP-002',
    dateImported: 'Jul 28, 2026',
    fileName: 'attendance_jul_16_31_2026.xlsx',
    records: 242,
    employees: 45,
    importedBy: 'Admin',
    status: 'Successful',
    entries: [
      { employeeId: 'EMP-004', employeeName: 'Ana Garcia', date: 'Jul 16, 2026', timeIn: '8:00 AM', timeOut: '5:00 PM', status: 'Present' },
      { employeeId: 'EMP-005', employeeName: 'Carlo Mendoza', date: 'Jul 16, 2026', timeIn: '', timeOut: '', status: 'Absent' },
    ],
  },
  {
    id: 'IMP-003',
    dateImported: 'Jul 14, 2026',
    fileName: 'attendance_jul_1_15_2026.xlsx',
    records: 238,
    employees: 44,
    importedBy: 'Maria Santos',
    status: 'Successful',
  },
  {
    id: 'IMP-004',
    dateImported: 'Jun 30, 2026',
    fileName: 'attendance_jun_16_30_2026.xlsx',
    records: 240,
    employees: 44,
    importedBy: 'Admin',
    status: 'Successful',
  },
  {
    id: 'IMP-005',
    dateImported: 'Jun 13, 2026',
    fileName: 'attendance_jun_1_15_2026.xlsx',
    records: 201,
    employees: 43,
    importedBy: 'Maria Santos',
    status: 'Successful',
  },
  {
    id: 'IMP-006',
    dateImported: 'May 29, 2026',
    fileName: 'attendance_may_16_31_2026.xlsx',
    records: 0,
    employees: 0,
    importedBy: 'Admin',
    status: 'Successful',
  },
]

export const auditLogs: AuditLog[] = [
  { id: 'AL-001', dateTime: 'Aug 11, 2026 09:31 AM', user: 'Admin', action: 'Import Attendance', module: 'Attendance', description: 'Imported attendance_aug_1_15_2026.xlsx — 245 records, 45 employees' },
  { id: 'AL-002', dateTime: 'Aug 11, 2026 09:28 AM', user: 'Admin', action: 'Validate Attendance', module: 'Attendance', description: 'Validated attendance file — 242 valid, 3 errors' },
  { id: 'AL-003', dateTime: 'Aug 10, 2026 04:15 PM', user: 'Admin', action: 'Update Employee', module: 'Payroll', description: 'Changed Juan Dela Cruz salary from ₱20,000.00 to ₱25,000.00' },
  { id: 'AL-004', dateTime: 'Aug 10, 2026 02:00 PM', user: 'Lorna Bautista', action: 'Approve Leave', module: 'Leave', description: 'Approved Sick Leave for Mark Villanueva (Aug 1–5, 2026)' },
  { id: 'AL-005', dateTime: 'Aug 10, 2026 11:30 AM', user: 'Maria Santos', action: 'Create Employee', module: 'Employees', description: 'Created new employee record for Jonel Castillo (EMP-011)' },
  { id: 'AL-006', dateTime: 'Aug 5, 2026 10:00 AM', user: 'Admin', action: 'Approve Payroll', module: 'Payroll', description: 'Approved payroll for July 16–31, 2026 — Net ₱435,260.00' },
  { id: 'AL-007', dateTime: 'Aug 5, 2026 09:45 AM', user: 'Admin', action: 'Calculate Payroll', module: 'Payroll', description: 'Completed payroll calculation for July 16–31, 2026 — 45 employees' },
  { id: 'AL-008', dateTime: 'Aug 4, 2026 03:00 PM', user: 'Admin', action: 'Edit Attendance', module: 'Attendance', description: 'Corrected Time Out for Roberto Reyes on Jul 31, 2026' },
  { id: 'AL-009', dateTime: 'Jul 28, 2026 08:55 AM', user: 'Admin', action: 'Import Attendance', module: 'Attendance', description: 'Imported attendance_jul_16_31_2026.xlsx — 242 records, 45 employees' },
  { id: 'AL-010', dateTime: 'Jul 20, 2026 05:00 PM', user: 'Admin', action: 'Finalize Payroll', module: 'Payroll', description: 'Finalized payroll for July 1–15, 2026 — Payslips generated for 44 employees' },
  { id: 'AL-011', dateTime: 'Jul 14, 2026 10:15 AM', user: 'Maria Santos', action: 'Import Attendance', module: 'Attendance', description: 'Imported attendance_jul_1_15_2026.xlsx — 238 records, 44 employees' },
  { id: 'AL-012', dateTime: 'Jul 10, 2026 02:30 PM', user: 'Lorna Bautista', action: 'Approve Leave', module: 'Leave', description: 'Approved Bereavement Leave for Roberto Reyes (Jul 10–12, 2026)' },
]

export const inventoryCatalog: InventoryItem[] = [
  { id: 'INV-001', item: 'Adobo Rice Bowl', cost: 135, category: 'Menu Item', createdAt: '2026-08-01T09:00:00Z', createdBy: 'Admin', updatedAt: '2026-08-01T09:00:00Z', updatedBy: 'Admin' },
  { id: 'INV-002', item: 'Bicol Express', cost: 190, category: 'Menu Item', createdAt: '2026-08-01T09:05:00Z', createdBy: 'Admin', updatedAt: '2026-08-07T10:00:00Z', updatedBy: 'Admin' },
  { id: 'INV-003', item: 'Chicken BBQ Platter', cost: 260, category: 'Menu Item', createdAt: '2026-08-02T11:00:00Z', createdBy: 'Admin', updatedAt: '2026-08-02T11:00:00Z', updatedBy: 'Admin' },
  { id: 'INV-004', item: 'Soft Drinks', cost: 45, category: 'Others', createdAt: '2026-08-02T12:00:00Z', createdBy: 'Admin', updatedAt: '2026-08-02T12:00:00Z', updatedBy: 'Admin' },
  { id: 'INV-005', item: 'Bottled Water', cost: 25, category: 'Others', createdAt: '2026-08-03T08:30:00Z', createdBy: 'Admin', updatedAt: '2026-08-03T08:30:00Z', updatedBy: 'Admin' },
  { id: 'INV-006', item: 'Fresh Lumpia', cost: 95, category: 'Menu Item', createdAt: '2026-08-03T09:10:00Z', createdBy: 'Admin', updatedAt: '2026-08-08T09:40:00Z', updatedBy: 'Admin' },
]

export const salesRecords: SaleRecord[] = [
  { id: 'SAL-001', item: 'Adobo Rice Bowl', cost: 135, numberOfSales: 18, discount: 450, category: 'Menu Item', createdAt: '2026-08-11T09:15:00Z', createdBy: 'Admin', updatedAt: '2026-08-11T09:15:00Z', updatedBy: 'Admin' },
  { id: 'SAL-002', item: 'Bicol Express', cost: 190, numberOfSales: 12, discount: 300, category: 'Menu Item', createdAt: '2026-08-11T11:30:00Z', createdBy: 'Admin', updatedAt: '2026-08-11T11:30:00Z', updatedBy: 'Admin' },
  { id: 'SAL-003', item: 'Soft Drinks', cost: 45, numberOfSales: 24, discount: 0, category: 'Others', createdAt: '2026-08-12T13:20:00Z', createdBy: 'Admin', updatedAt: '2026-08-12T13:20:00Z', updatedBy: 'Admin' },
  { id: 'SAL-004', item: 'Chicken BBQ Platter', cost: 260, numberOfSales: 9, discount: 180, category: 'Menu Item', createdAt: '2026-08-12T16:45:00Z', createdBy: 'Admin', updatedAt: '2026-08-12T16:45:00Z', updatedBy: 'Admin' },
]

export const expenseRecords: ExpenseRecord[] = [
  { id: 'EXP-001', expense: 'Utility Bills', amount: 2450, createdAt: '2026-08-10T08:00:00Z', createdBy: 'Admin', updatedAt: '2026-08-10T08:00:00Z', updatedBy: 'Admin' },
  { id: 'EXP-002', expense: 'Ingredient Supply', amount: 8125, createdAt: '2026-08-10T09:00:00Z', createdBy: 'Admin', updatedAt: '2026-08-10T09:00:00Z', updatedBy: 'Admin' },
  { id: 'EXP-003', expense: 'Packaging Materials', amount: 1560, createdAt: '2026-08-11T10:30:00Z', createdBy: 'Admin', updatedAt: '2026-08-11T10:30:00Z', updatedBy: 'Admin' },
  { id: 'EXP-004', expense: 'Maintenance', amount: 3200, createdAt: '2026-08-11T14:20:00Z', createdBy: 'Admin', updatedAt: '2026-08-11T14:20:00Z', updatedBy: 'Admin' },
]

export const monthlyPayrollData = [
  { month: 'Mar', gross: 488000, net: 416000 },
  { month: 'Apr', gross: 492000, net: 419000 },
  { month: 'May', gross: 495500, net: 421000 },
  { month: 'Jun', gross: 502100, net: 428000 },
  { month: 'Jul', gross: 508900, net: 435260 },
  { month: 'Aug', gross: 512350, net: 437530 },
]

export const deptPayrollData = [
  { dept: 'Chefs & Cooks', amount: 130000 },
  { dept: 'Waiters', amount: 104000 },
  { dept: 'Cashiers', amount: 89000 },
  { dept: 'Management', amount: 115000 },
  { dept: 'Waiters', amount: 96000 },
  { dept: 'Management', amount: 95350 },
]

export const overtimeData = [
  { month: 'Mar', hours: 142 },
  { month: 'Apr', hours: 118 },
  { month: 'May', hours: 135 },
  { month: 'Jun', hours: 156 },
  { month: 'Jul', hours: 128 },
  { month: 'Aug', hours: 164 },
]
