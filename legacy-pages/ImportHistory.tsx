'use client'
import { useState, useEffect, useCallback } from 'react'
import { FileText, ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../App'
import useIsMobile from '../hooks/isMobile'
import { useRealtimeEntity } from '../hooks/useRealtimeEntity'
import Modal from '../components/Modal'

interface ImportRecord {
  id: string | number
  dateImported: string
  fileName: string
  records: number
  employees: number
  importedBy: string
  status: string
  periodStart?: string
  periodEnd?: string
}

interface EmployeeRecord {
  employeeId: number
  employeeName: string
  department: string
  recordsCount: number
  restaurant: string
  sourceID: number
}

interface AttendanceRecord {
  attendance_id: number
  work_date: string
  first_on_duty: string | null
  first_off_duty: string | null
  late_minutes: number | null
  leave_early_minutes: number | null
  overtime_minutes: number | null
  total_minutes?: number | null
  on_leave?: boolean | null
  is_absent: boolean
}

const statusColor: Record<string, string> = {
  'Attendance Imported': 'bg-emerald-100 text-emerald-700',
  'Validation Required': 'bg-amber-100 text-amber-700',
  'Ready for Payroll': 'bg-indigo-100 text-indigo-700',
  Calculated: 'bg-violet-100 text-violet-700',
  'Under Review': 'bg-orange-100 text-orange-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Finalized: 'bg-emerald-100 text-emerald-700',
  Pending: 'bg-slate-100 text-slate-500',
  Unknown: 'bg-green-100 text-green-600',
}

interface SkeletonBarProps {
  width?: string | number
  height?: string | number
  rounded?: string
  className?: string
}

function SkeletonBar({ width = "100%", height = "1rem", rounded = "rounded-md", className = "" }: SkeletonBarProps) {
  return (
    <div
      className={`bg-slate-200 animate-pulse ${rounded} ${className}`}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
      }}
    />
  )
}

interface SkeletonTableRowsProps {
  columns: number
  rows?: number
  columnConfig?: { width?: string; pill?: boolean }[]
}

function SkeletonTableRows({ columns, rows = 6, columnConfig }: SkeletonTableRowsProps) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIdx) => (
        <tr key={rowIdx} className="border-b border-slate-50">
          {Array.from({ length: columns }, (_, colIdx) => {
            const config = columnConfig?.[colIdx]
            return (
              <td key={colIdx} className="py-2 px-3">
                <SkeletonBar
                  width={config?.width ?? "80%"}
                  height={config?.pill ? "1.1rem" : "0.85rem"}
                  rounded={config?.pill ? "rounded-full" : "rounded-md"}
                />
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}

const attendanceStatusColor: Record<string, string> = {
  Present: 'bg-emerald-100 text-emerald-700',
  Absent: 'bg-red-100 text-red-700',
  Leave: 'bg-violet-100 text-violet-700',
  'On Leave': 'bg-violet-100 text-violet-700',
  'Rest Day': 'bg-slate-100 text-slate-500',
  Holiday: 'bg-blue-100 text-blue-700',
  Incomplete: 'bg-amber-100 text-amber-700',
  Overtime: 'bg-blue-100 text-blue-700',
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—'
  return dateStr.split('T')[0]
}

function formatTime(timeStr?: string | null) {
  if (!timeStr) return '—'
  const parts = String(timeStr).split(':')
  if (parts.length < 2) return String(timeStr)
  let hh = Number(parts[0])
  const mm = Number(parts[1]) || 0
  const ampm = hh >= 12 ? 'PM' : 'AM'
  if (hh === 0) hh = 12
  if (hh > 12) hh = hh - 12
  return `${hh}:${String(mm).padStart(2, '0')} ${ampm}`
}

function getAttendanceStatus(record: AttendanceRecord) {
  const date = new Date(`${record.work_date}T00:00:00Z`)
  const isWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6
  const hasRecordedPunch = Boolean(record.first_on_duty || record.first_off_duty)

  if (record.on_leave) return 'On Leave'
  if (record.is_absent) return 'Absent'
  if (isWeekend && hasRecordedPunch) return 'Present'
  if (isWeekend) return 'Rest Day'
  if ((record.total_minutes ?? 0) === 0) return 'Incomplete'
  return 'Present'
}

function addDaysISO(dateStr?: string, days = 0) {
  if (!dateStr) return ''
  const base = String(dateStr).split('T')[0]
  const parts = base.split('-').map(Number)
  if (parts.length < 3) return base
  const [y, m, d] = parts
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function minutesToHHMM(mins?: number | null) {
  const total = Math.max(0, Number(mins) || 0)
  const h = Math.floor(total / 60)
  const m = total % 60
  const hh = String(h).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  return `${hh}:${mm}`
}

export default function ImportHistory() {
  const { showToast } = useApp()
  const isMobile = useIsMobile()
  const [imports, setImports] = useState<ImportRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedImport, setSelectedImport] = useState<ImportRecord | null>(null)
  const [employees, setEmployees] = useState<EmployeeRecord[]>([])
  const [employeesLoading, setEmployeesLoading] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRecord | null>(null)
  const [employeeAttendance, setEmployeeAttendance] = useState<AttendanceRecord[]>([])
  const [employeeLoading, setEmployeeLoading] = useState(false)
  const [employeeError, setEmployeeError] = useState<string | null>(null)
  const [employeePeriodStart, setEmployeePeriodStart] = useState<string>('')
  const [employeePeriodEnd, setEmployeePeriodEnd] = useState<string>('')
  const [employeePage, setEmployeePage] = useState(1)
  const EMPLOYEES_PER_PAGE = 10
  const [attendancePage, setAttendancePage] = useState(1)
  const ATTENDANCE_PER_PAGE = 10

  const loadImports = useCallback(async () => {
    try {
      const res = await fetch('/api/import-history')
      if (!res.ok) return
      const body = await res.json()
      setImports(body.imports || [])
    } catch (err) {
      console.error('Failed to load import history', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!mounted) return
      await loadImports()
    })()
    return () => { mounted = false }
  }, [loadImports])

  const loadEmployeesForImport = useCallback(async (importRecord: ImportRecord) => {
    try {
      setEmployeesLoading(true)
      const res = await fetch(`/api/import-history/${importRecord.id}`)
      if (!res.ok) return
      const body = await res.json()
      setEmployees(body.employees || [])
    } catch (err) {
      console.error('Failed to load employees', err)
    } finally {
      setEmployeesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedImport) return
    void loadEmployeesForImport(selectedImport)
  }, [selectedImport, loadEmployeesForImport])

  const refreshSelectedEmployeeAttendance = useCallback(async (employee: EmployeeRecord | null, importRecord: ImportRecord | null) => {
    if (!employee || !importRecord) return
    setEmployeeLoading(true)
    setEmployeeError(null)
    try {
      const res = await fetch(`/api/import-history/${importRecord.id}?employee_id=${employee.employeeId}`)
      if (!res.ok) throw new Error('Failed to load employee attendance')
      const body = await res.json()
      setEmployeeAttendance(body.records || [])
    } catch (err: any) {
      setEmployeeError(err.message || 'Failed to load employee attendance')
    } finally {
      setEmployeeLoading(false)
    }
  }, [])

  useRealtimeEntity('attendance', {
    restaurant: 'Both',
    onChange: () => {
      void loadImports()
      if (selectedImport) {
        void loadEmployeesForImport(selectedImport)
      }
      if (selectedEmployee && selectedImport) {
        void refreshSelectedEmployeeAttendance(selectedEmployee, selectedImport)
      }
    },
  })

  function formatImportPeriod(fileName?: string) {
    if (!fileName) return 'N/A'
    try {
      const name = fileName.replace(/\.[^/.]+$/, '').toLowerCase()
      const parts = name.replace(/^attendance_?/, '').split('_')
      if (parts.length >= 4) {
        const monthPart = parts[0]
        const start = parts[1]
        const end = parts[2]
        const year = parts[3]
        const monthMap: Record<string, string> = {
          jan: 'January', feb: 'February', mar: 'March', apr: 'April', may: 'May', jun: 'June',
          jul: 'July', aug: 'August', sep: 'September', oct: 'October', nov: 'November', dec: 'December'
        }
        const monthName = monthMap[monthPart] || monthPart.charAt(0).toUpperCase() + monthPart.slice(1)
        return `${monthName} ${start} - ${monthName} ${end}, ${year}`
      }
      return fileName
    } catch (e) {
      return fileName
    }
  }

  const handleEmployeeClick = useCallback(async (employee: EmployeeRecord) => {
    if (!selectedImport) return
    setSelectedEmployee(employee)
    setEmployeePeriodStart(selectedImport.periodStart ? addDaysISO(selectedImport.periodStart, 1) : '')
    setEmployeePeriodEnd(selectedImport.periodEnd ? addDaysISO(selectedImport.periodEnd, 1) : '')
    await refreshSelectedEmployeeAttendance(employee, selectedImport)
  }, [selectedImport, refreshSelectedEmployeeAttendance])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 font-display">Attendance Import History</h2>
        <p className="text-sm text-slate-500 mt-0.5">View all attendance file imports</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {!isMobile ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Date Imported', 'File Name', 'Records', 'Employees', 'Imported By', 'Status'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <SkeletonTableRows columns={6} rows={6} columnConfig={[
                    { width: "45%" }, { width: "75%" }, { width: "35%" },
                    { width: "35%" }, { width: "55%" }, { width: "40%", pill: true }
                  ]} />
                ) : (
                  imports.map(imp => (
                    <tr
                      key={imp.id}
                      className="hover:bg-slate-50 group cursor-pointer"
                      onClick={() => setSelectedImport(imp)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelectedImport(imp)
                        }
                      }}
                    >
                      <td className="py-3 px-4 text-sm text-slate-600">{imp.dateImported}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <FileText size={14} className="text-emerald-500 shrink-0" />
                          <span className="text-sm font-medium text-slate-700 font-display">{formatImportPeriod(imp.fileName)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600">{imp.records.toLocaleString()}</td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600">{imp.employees}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">{imp.importedBy}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center justify-center text-xs px-2.5 py-0.5 rounded-full font-medium font-display ${statusColor[imp.status] || statusColor.Unknown}`}>{imp.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col">
              {imports.map(imp => (
                <button key={imp.id} onClick={() => setSelectedImport(imp)} className="text-left p-3 border-b border-slate-50 hover:bg-slate-50 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-700">{formatImportPeriod(imp.fileName)}</div>
                    <div className="text-xs text-slate-400">{imp.dateImported} • {imp.importedBy}</div>
                  </div>
                  <span className={`text-[10px] text-center px-2 py-0.5 rounded-full font-medium ${statusColor[imp.status] || statusColor.Unknown}`}>{imp.status}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedImport && (
        <Modal open={!!selectedImport} title={formatImportPeriod(selectedImport.fileName)} onClose={() => setSelectedImport(null)}>
          <div className="p-3 w-[900px] max-h-[60vh] overflow-y-auto">
            <div className="space-y-5">
              {employeesLoading ? (
                <div className="grid grid-cols-2 gap-3">
                  <div><SkeletonBar width="70px" height="12px" /><SkeletonBar width="140px" height="20px" /></div>
                  <div><SkeletonBar width="70px" height="12px" /><SkeletonBar width="140px" height="20px" /></div>
                  <div><SkeletonBar width="70px" height="12px" /><SkeletonBar width="140px" height="20px" /></div>
                  <div><SkeletonBar width="70px" height="12px" /><SkeletonBar width="140px" height="20px" /></div>
                  <div><SkeletonBar width="70px" height="12px" /><SkeletonBar width="140px" height="20px" /></div>
                  <div><SkeletonBar width="70px" height="12px" /><SkeletonBar width="140px" height="20px" /></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-400">Date Imported</p>
                    <p className="text-sm font-medium">{selectedImport.dateImported?.split(',')[0]}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Status</p>
                    <p className="text-sm font-medium">{selectedImport.status}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Records</p>
                    <p className="text-sm font-medium">{selectedImport.records}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Employees</p>
                    <p className="text-sm font-medium">{selectedImport.employees}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Restaurant</p>
                    <p className="text-sm font-medium">{selectedImport.importedBy}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Period</p>
                    <p className="text-sm font-medium">{formatDate(addDaysISO(selectedImport.periodStart, 1))} to {formatDate(addDaysISO(selectedImport.periodEnd, 1))}</p>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 font-display">Employees in this Import</p>
                </div>
                <div className="overflow-x-auto">
                  {isMobile ? (
                    <div className="flex flex-col">
                      {employeesLoading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                          <div key={`emp-skeleton-${i}`} className="p-3 border-b border-slate-50 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <SkeletonBar width="28px" height="28px" rounded="rounded-full" />
                              <SkeletonBar width="120px" height="14px" />
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <SkeletonBar width="60px" height="12px" />
                              <SkeletonBar width="44px" height="18px" rounded="rounded-full" />
                            </div>
                          </div>
                        ))
                      ) : (
                        employees.slice((employeePage - 1) * EMPLOYEES_PER_PAGE, employeePage * EMPLOYEES_PER_PAGE).map(emp => (
                          <button
                            key={emp.employeeId}
                            type="button"
                            onClick={() => handleEmployeeClick(emp)}
                            className="text-left p-3 border-b border-slate-50 hover:bg-slate-50 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                                <span className="text-indigo-700 text-[10px] font-bold font-display">{emp.employeeName.slice(0, 2)}</span>
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-slate-700 font-display truncate">{emp.employeeName}</div>
                                <div className="text-xs text-slate-400 font-mono">Source ID: {emp.sourceID}</div>
                              </div>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium font-display shrink-0">{emp.recordsCount} records</span>
                          </button>
                        ))
                      )}
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          {['Employee', 'Source ID', 'Records'].map(h => (
                            <th key={h} className="text-left py-2 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {employeesLoading ? (
                          <SkeletonTableRows columns={3} rows={6} columnConfig={[
                            { width: "75%" }, { width: "40%" }, { width: "35%" }
                          ]} />
                        ) : (
                          employees.slice((employeePage - 1) * EMPLOYEES_PER_PAGE, employeePage * EMPLOYEES_PER_PAGE).map(emp => (
                            <tr key={emp.employeeId} className="hover:bg-slate-50 cursor-pointer" onClick={() => handleEmployeeClick(emp)}>
                              <td className="py-2 px-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                                    <span className="text-indigo-700 text-[10px] font-bold font-display">{emp.employeeName.slice(0, 2)}</span>
                                  </div>
                                  <span className="text-sm font-medium text-slate-700 font-display">{emp.employeeName}</span>
                                </div>
                              </td>
                              <td className="py-2 px-4 text-sm text-slate-600">{emp.sourceID}</td>
                              <td className="py-2 px-4 font-mono text-xs text-slate-600">{emp.recordsCount}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
                {!employeesLoading && employees.length > EMPLOYEES_PER_PAGE && (
                  <div className="flex items-center justify-between px-2 py-3 border-t border-slate-100 bg-white">
                    <p className="text-xs text-slate-500">
                      Showing {employees.length === 0 ? 0 : (employeePage - 1) * EMPLOYEES_PER_PAGE + 1}–{Math.min(employeePage * EMPLOYEES_PER_PAGE, employees.length)} of {employees.length} employees
                    </p>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEmployeePage(p => Math.max(1, p - 1))} disabled={employeePage === 1} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40">
                        <ChevronLeft size={16} />
                      </button>
                      {Array.from({ length: Math.ceil(employees.length / EMPLOYEES_PER_PAGE) }, (_, i) => {
                        const p = i + 1
                        const totalPages = Math.ceil(employees.length / EMPLOYEES_PER_PAGE)
                        const show = p === 1 || p === totalPages || Math.abs(p - employeePage) <= 2
                        if (!show) {
                          if (i === 1 || i === totalPages - 2) return <span key={p} className="px-1 text-slate-400">…</span>
                          return null
                        }
                        return (
                          <button
                            key={p}
                            onClick={() => setEmployeePage(p)}
                            className={`w-7 h-7 rounded-lg text-xs font-medium font-display ${employeePage === p ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}
                          >
                            {p}
                          </button>
                        )
                      })}
                      <button onClick={() => setEmployeePage(p => Math.min(Math.ceil(employees.length / EMPLOYEES_PER_PAGE), p + 1))} disabled={employeePage === Math.ceil(employees.length / EMPLOYEES_PER_PAGE)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {selectedEmployee && (
        <Modal open={!!selectedEmployee} title={`${selectedEmployee.employeeName} — Attendance (${formatDate(employeePeriodStart)} to ${formatDate(employeePeriodEnd)})`} onClose={() => setSelectedEmployee(null)}>
          <div className="p-3">
            <div className={`${isMobile ? 'w-full' : 'w-[900px]'} max-h-[60vh] overflow-y-auto`}>
              {employeeLoading && (!isMobile ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        {['Date', 'Day', 'Time In', 'Time Out', 'Late', 'Undertime', 'Overtime', 'Status'].map(h => (
                          <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      <SkeletonTableRows columns={8} rows={6} columnConfig={[
                        { width: "50%" }, { width: "40%" }, { width: "55%" },
                        { width: "55%" }, { width: "40%" }, { width: "40%" },
                        { width: "40%" }, { width: "45%", pill: true }
                      ]} />
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={`attendance-skeleton-${i}`} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <SkeletonBar width="80px" height="14px" />
                          <SkeletonBar width="34px" height="12px" />
                        </div>
                        <SkeletonBar width="64px" height="18px" rounded="rounded-full" />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-100 pt-3">
                        {Array.from({ length: 6 }).map((__, j) => (
                          <div key={`attendance-skeleton-field-${j}`}>
                            <SkeletonBar width="48px" height="10px" />
                            <div className="mt-1">
                              <SkeletonBar width="56px" height="12px" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              {employeeError && (
                <div className="py-8 text-center text-red-500">{employeeError}</div>
              )}
              {!employeeLoading && !employeeError && (!isMobile ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        {['Date', 'Day', 'Time In', 'Time Out', 'Late', 'Undertime', 'Overtime', 'Status'].map(h => (
                          <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {employeeAttendance.slice((attendancePage - 1) * ATTENDANCE_PER_PAGE, attendancePage * ATTENDANCE_PER_PAGE).map(rec => (
                        <tr key={rec.attendance_id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-sm text-slate-600">{formatDate(rec.work_date)}</td>
                          <td className="py-2 px-3 text-sm text-slate-600">
                            {new Date(rec.work_date).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                          </td>
                          <td className="py-2 px-3 text-sm font-mono text-slate-600">{formatTime(rec.first_on_duty)}</td>
                          <td className="py-2 px-3 text-sm font-mono text-slate-600">{formatTime(rec.first_off_duty)}</td>
                          <td className="py-2 px-3 text-sm font-mono text-amber-600">{minutesToHHMM(rec.late_minutes)}</td>
                          <td className="py-2 px-3 text-sm font-mono text-orange-600">{minutesToHHMM(rec.leave_early_minutes)}</td>
                          <td className="py-2 px-3 text-sm font-mono text-blue-600">{minutesToHHMM(rec.overtime_minutes)}</td>
                          <td className="py-2 px-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium font-display ${attendanceStatusColor[getAttendanceStatus(rec)] || 'bg-slate-100 text-slate-500'}`}>
                              {getAttendanceStatus(rec)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-3">
                  {employeeAttendance.slice((attendancePage - 1) * ATTENDANCE_PER_PAGE, attendancePage * ATTENDANCE_PER_PAGE).map(rec => (
                    <div key={rec.attendance_id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-700 font-display">{formatDate(rec.work_date)}</p>
                          <p className="text-xs text-slate-500">
                            {new Date(rec.work_date).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium font-display shrink-0 ${attendanceStatusColor[getAttendanceStatus(rec)] || 'bg-slate-100 text-slate-500'}`}>
                          {getAttendanceStatus(rec)}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-100 pt-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-slate-400 font-display">Time In</p>
                          <p className="text-xs font-mono text-slate-700">{formatTime(rec.first_on_duty)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-slate-400 font-display">Time Out</p>
                          <p className="text-xs font-mono text-slate-700">{formatTime(rec.first_off_duty)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-slate-400 font-display">Late</p>
                          <p className="text-xs font-mono text-amber-600">{minutesToHHMM(rec.late_minutes)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-slate-400 font-display">Undertime</p>
                          <p className="text-xs font-mono text-orange-600">{minutesToHHMM(rec.leave_early_minutes)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-slate-400 font-display">Overtime</p>
                          <p className="text-xs font-mono text-blue-600">{minutesToHHMM(rec.overtime_minutes)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              {!employeeLoading && !employeeError && employeeAttendance.length > ATTENDANCE_PER_PAGE && (
                <div className="grid grid-cols-2 gap-2 px-2 py-3 border-t border-slate-100 bg-white">
                  <div>
                    <p className="text-xs text-slate-500">
                      Showing {employeeAttendance.length === 0 ? 0 : (attendancePage - 1) * ATTENDANCE_PER_PAGE + 1}–{Math.min(attendancePage * ATTENDANCE_PER_PAGE, employeeAttendance.length)} of {employeeAttendance.length} records
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setAttendancePage(p => Math.max(1, p - 1))} disabled={attendancePage === 1} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40">
                      <ChevronLeft size={16} />
                    </button>
                    {Array.from({ length: Math.ceil(employeeAttendance.length / ATTENDANCE_PER_PAGE) }, (_, i) => {
                      const p = i + 1
                      const totalPages = Math.ceil(employeeAttendance.length / ATTENDANCE_PER_PAGE)
                      const show = p === 1 || p === totalPages || Math.abs(p - attendancePage) <= 2
                      if (!show) {
                        if (i === 1 || i === totalPages - 2) return <span key={p} className="px-1 text-slate-400">…</span>
                        return null
                      }
                      return (
                        <button
                          key={p}
                          onClick={() => setAttendancePage(p)}
                          className={`w-7 h-7 rounded-lg text-xs font-medium font-display ${attendancePage === p ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}
                        >
                          {p}
                        </button>
                      )
                    })}
                    <button onClick={() => setAttendancePage(p => Math.min(Math.ceil(employeeAttendance.length / ATTENDANCE_PER_PAGE), p + 1))} disabled={attendancePage === Math.ceil(employeeAttendance.length / ATTENDANCE_PER_PAGE)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}