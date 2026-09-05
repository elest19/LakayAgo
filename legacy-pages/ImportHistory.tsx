'use client'
import { useState, useEffect } from 'react'
import { FileText, ChevronRight } from 'lucide-react'
import { useApp } from '../App'
import useIsMobile from '../hooks/isMobile'
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
  Unknown: 'bg-slate-100 text-slate-500',
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
  const [selectedImport, setSelectedImport] = useState<ImportRecord | null>(null)
  const [employees, setEmployees] = useState<EmployeeRecord[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRecord | null>(null)
  const [employeeAttendance, setEmployeeAttendance] = useState<AttendanceRecord[]>([])
  const [employeeLoading, setEmployeeLoading] = useState(false)
  const [employeeError, setEmployeeError] = useState<string | null>(null)
  const [employeePeriodStart, setEmployeePeriodStart] = useState<string>('')
  const [employeePeriodEnd, setEmployeePeriodEnd] = useState<string>('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/import-history')
        if (!res.ok) return
        const body = await res.json()
        if (mounted) setImports(body.imports || [])
      } catch (err) {
        console.error('Failed to load import history', err)
      }
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!selectedImport) return
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch(`/api/import-history/${selectedImport.id}`)
        if (!res.ok) return
        const body = await res.json()
        if (mounted) setEmployees(body.employees || [])
      } catch (err) {
        console.error('Failed to load employees', err)
      }
    })()
    return () => { mounted = false }
  }, [selectedImport])

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

  async function handleEmployeeClick(employee: EmployeeRecord) {
    if (!selectedImport) return
    setSelectedEmployee(employee)
    setEmployeePeriodStart(selectedImport.periodStart ? addDaysISO(selectedImport.periodStart, 1) : '')
    setEmployeePeriodEnd(selectedImport.periodEnd ? addDaysISO(selectedImport.periodEnd, 1) : '')
    setEmployeeLoading(true)
    setEmployeeError(null)
    try {
      const res = await fetch(`/api/import-history/${selectedImport.id}?employee_id=${employee.employeeId}`)
      if (!res.ok) throw new Error('Failed to load employee attendance')
      const body = await res.json()
      setEmployeeAttendance(body.records || [])
    } catch (err: any) {
      setEmployeeError(err.message || 'Failed to load employee attendance')
    } finally {
      setEmployeeLoading(false)
    }
  }

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
                {imports.map(imp => (
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
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium font-display ${statusColor[imp.status] || statusColor.Unknown}`}>{imp.status}</span>
                    </td>
                  </tr>
                ))}
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
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor[imp.status] || statusColor.Unknown}`}>{imp.status}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedImport && (
        <Modal open={!!selectedImport} title={formatImportPeriod(selectedImport.fileName)} onClose={() => setSelectedImport(null)}>
          <div className="p-3 w-[900px] max-h-[80vh] overflow-y-auto">
            <div className="space-y-5">
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

              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 font-display">Employees in this Import</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        {['Employee', 'Source ID', 'Records'].map(h => (
                          <th key={h} className="text-left py-2 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {employees.map(emp => (
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
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button onClick={() => setSelectedImport(null)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Close</button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {selectedEmployee && (
        <Modal open={!!selectedEmployee} title={`${selectedEmployee.employeeName} — Attendance (${formatDate(employeePeriodStart)} to ${formatDate(employeePeriodEnd)})`} onClose={() => setSelectedEmployee(null)}>
          <div className="p-3">
            <div className="w-[900px] max-h-[60vh] overflow-y-auto">
              {employeeLoading && (
                <div className="py-8 text-center text-slate-400">Loading attendance...</div>
              )}
              {employeeError && (
                <div className="py-8 text-center text-red-500">{employeeError}</div>
              )}
              {!employeeLoading && !employeeError && (
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
                      {employeeAttendance.map(rec => (
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
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}