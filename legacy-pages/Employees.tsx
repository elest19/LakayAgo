"use client"
import { useCallback, useRef, useState, useEffect } from "react"
import { Search, Plus, ChevronLeft, ChevronRight } from "lucide-react"
import useIsMobile from "../hooks/isMobile"
import Modal from "../components/Modal"
import { useApp } from "../App"
import type { Employee } from "../types"

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(n)

function EmployeeDetailModal({ employee, onClose, onUpdate, onArchive, existingEmployees }: { employee: Employee; onClose: () => void; onUpdate?: (u: Employee) => void; onArchive?: (e: Employee) => void; existingEmployees: Employee[] }) {
  const { showToast } = useApp()
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<"overview" | "attendance" | "leave" | "payroll-history">("overview")
  const [isEditing, setIsEditing] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [formData, setFormData] = useState({
    name: employee.name,
    source_employee_id: employee.source_employee_id,
    email: employee.email,
    contactNumber: employee.contactNumber,
    restaurant: employee.restaurant,
    department: employee.department,
    pay_per_day: employee.pay_per_day,
    sss: employee.sss,
    philhealth: employee.philhealth,
    pagibig: employee.pagibig,
    month_pay_13th: employee.month_pay_13th,
    status: employee.status,
  })
  const [loading, setLoading] = useState(false)
  const [selectedAttendance, setSelectedAttendance] = useState<any | null>(null)
  const [selectedPayroll, setSelectedPayroll] = useState<any | null>(null)
  const [attendanceRows, setAttendanceRows] = useState<any[]>([])
  const [leaveRows, setLeaveRows] = useState<any[]>([])
  const [payrollRows, setPayrollRows] = useState<any[]>([])
  const [tabLoading, setTabLoading] = useState({ attendance: false, leave: false, payroll: false })

  const formatDateForDisplay = (value?: string | null) => {
    if (!value) return '—'
    const match = String(value).match(/^\d{4}-\d{2}-\d{2}/)
    if (!match) return String(value)
    const [year, month, day] = match[0].split('-').map(Number)
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  }

  const formatTabTime = (value?: string | null) => {
    if (!value) return '—'
    const parts = String(value).split(':')
    if (parts.length < 2) return value
    let hh = Number(parts[0])
    const mm = Number(parts[1]) || 0
    const ampm = hh >= 12 ? 'PM' : 'AM'
    if (hh === 0) hh = 12
    if (hh > 12) hh -= 12
    return `${hh}:${String(mm).padStart(2, '0')} ${ampm}`
  }

  const getAttendanceStatus = (row: any) => {
    const date = new Date(`${row.work_date}T00:00:00Z`)
    const isWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6
    const hasRecordedPunch = Boolean(row.first_on_duty || row.first_off_duty)

    if (row.on_leave) return 'On Leave'
    if (row.is_absent) return 'Absent'
    if (isWeekend && hasRecordedPunch) return 'Present'
    if (isWeekend) return 'Rest Day'
    if ((Number(row.total_minutes ?? 0)) === 0) return 'Incomplete'
    return 'Present'
  }

  useEffect(() => {
    if (isEditing) return

    if (tab === 'attendance') {
      let active = true
      setTabLoading(prev => ({ ...prev, attendance: true }))
      fetch(`/api/attendance?employee_id=${encodeURIComponent(String(employee.id))}`)
        .then(async (res) => {
          if (!res.ok) throw new Error('Failed to load attendance')
          const body = await res.json()
          if (!active) return
          setAttendanceRows(body.attendance || [])
        })
        .catch(() => {
          if (active) setAttendanceRows([])
        })
        .finally(() => {
          if (active) setTabLoading(prev => ({ ...prev, attendance: false }))
        })

      return () => { active = false }
    }

    if (tab === 'leave') {
      let active = true
      setTabLoading(prev => ({ ...prev, leave: true }))
      fetch('/api/leave_requests')
        .then(async (res) => {
          if (!res.ok) throw new Error('Failed to load leave requests')
          const body = await res.json()
          if (!active) return
          const filtered = (body.leaveRequests || []).filter((item: any) => String(item.employeeId) === String(employee.id))
          setLeaveRows(filtered)
        })
        .catch(() => {
          if (active) setLeaveRows([])
        })
        .finally(() => {
          if (active) setTabLoading(prev => ({ ...prev, leave: false }))
        })

      return () => { active = false }
    }

    if (tab === 'payroll-history') {
      let active = true
      setTabLoading(prev => ({ ...prev, payroll: true }))
      fetch('/api/payslips')
        .then(async (res) => {
          if (!res.ok) throw new Error('Failed to load payslips')
          const body = await res.json()
          if (!active) return
          const filtered = (body.payslips || []).filter((item: any) => String(item.employee_id) === String(employee.id))
          setPayrollRows(filtered)
        })
        .catch(() => {
          if (active) setPayrollRows([])
        })
        .finally(() => {
          if (active) setTabLoading(prev => ({ ...prev, payroll: false }))
        })

      return () => { active = false }
    }

    return undefined
  }, [tab, employee.id, isEditing])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.status === "Active" && hasDuplicateActiveEmployee(existingEmployees, formData.source_employee_id, formData.restaurant, employee.id)) {
      showToast({
        type: "error",
        message: "Duplicate active employee",
        description: `An active employee with ID ${formData.source_employee_id} already exists for ${formData.restaurant}.`,
      })
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      if (!res.ok) throw new Error("Failed to update")
      const { employee: updated } = await res.json()
      if (!updated?.id) {
        throw new Error("Updated employee is missing its ID")
      }
      showToast({ type: "success", message: "Employee updated" })
      onUpdate?.(updated)
      setIsEditing(false)
      onClose()
    } catch (err) {
      showToast({ type: "error", message: "Update failed", description: (err as Error).message })
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    if (isEditing) {
      setShowDiscardConfirm(true)
    } else {
      onClose()
    }
  }

  const requestClose = () => {
    if (isEditing) {
      setShowDiscardConfirm(true)
    } else {
      onClose()
    }
  }

  return (
    <Modal open={true} title={isEditing ? `Edit ${formData.name}` : `Employee Information`} onClose={requestClose}>
      <div className="w-full h-[60vh] flex flex-col">
        <div className="flex items-start justify-between px-2 py-5 border-b border-slate-100">
          <div>
            <h3 className="text-xl font-bold text-slate-800 font-display">{formData.name}</h3>
            <p className="text-sm text-slate-500">Employee ID: {formData.source_employee_id} - {employee.department}</p>
          </div>
        </div>

        {/* Tabs */}
        {isMobile ? (
          <div className="border-slate-100 flex flex-wrap gap-1 px-1 py-1">
            <select value={tab} onChange={(e) => { if (isEditing && e.target.value !== "overview") return; setTab(e.target.value as any) }} className="w-full px-2 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-display cursor-pointer">
              <option value="overview">Overview</option>
              <option value="attendance" disabled={isEditing}>Attendance</option>
              <option value="leave" disabled={isEditing}>Leave</option>
              <option value="payroll-history" disabled={isEditing}>Payroll History</option>
            </select>
          </div>
        ) : (
          <div className="border-b border-slate-100 flex gap-1 px-6 py-2">
            {[{ id: "overview", label: "Overview" }, { id: "attendance", label: "Attendance" }, { id: "leave", label: "Leave" }, { id: "payroll-history", label: "Payroll History" }].map(t => (
              <button
                key={t.id}
                onClick={() => { if (isEditing && t.id !== "overview") return; setTab(t.id as any) }}
                aria-disabled={isEditing && t.id !== "overview"}
                className={`px-4 py-2 text-sm font-medium rounded-lg font-display ${tab === t.id ? "bg-indigo-50 text-indigo-700" : isEditing && t.id !== "overview" ? "text-slate-300 cursor-not-allowed opacity-60" : "text-slate-500 hover:text-slate-700"}`}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {!isEditing ? (
            <>
              {tab === "overview" && (
                <div className="w-3xl grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Employee Information</p>
                    <div className="space-y-3">
                      {[
                        { label: "Employee ID", value: employee.source_employee_id },
                        { label: "Department", value: employee.department },
                        { label: "Restaurant", value: employee.restaurant },
                        { label: "Name", value: employee.name },
                        { label: "Email", value: employee.email || "—" },
                        { label: "Contact Number", value: employee.contactNumber || "—" },
                      ].map(f => (
                        <div key={f.label} className="flex flex-col gap-0.5"><span className="text-xs text-slate-400 font-display">{f.label}</span><span className="text-sm font-medium text-slate-700">{f.value}</span></div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Additional Details</p>
                    <div className="space-y-3">
                      {[
                        { label: "Pay Per Day", value: formatCurrency(employee.pay_per_day) },
                        { label: "SSS", value: employee.sss ? formatCurrency(employee.sss) : "—" },
                        { label: "PhilHealth", value: employee.philhealth ? formatCurrency(employee.philhealth) : "—" },
                        { label: "Pag-IBIG", value: employee.pagibig ? formatCurrency(employee.pagibig) : "—" },
                        { label: "13th Month Pay", value: employee.month_pay_13th ? formatCurrency(employee.month_pay_13th) : "—" },
                        { label: "Status", value: employee.status },
                      ].map(f => (
                        <div key={f.label} className="flex flex-col gap-0.5"><span className="text-xs text-slate-400 font-display">{f.label}</span><span className="text-sm font-medium text-slate-700">{f.value}</span></div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <form onSubmit={handleSave} className="w-3xl space-y-4 p-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-display">Name *</label>
                  <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" required />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-display">Employee ID *</label>
                  <input value={formData.source_employee_id} onChange={(e) => setFormData({ ...formData, source_employee_id: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-display">Email</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-display">Contact Number</label>
                  <input value={formData.contactNumber} onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-display">Department *</label>
                  <select value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" required>
                    <option value="">Select Department</option>
                    <option value="Production">Production</option>
                    <option value="Kitchen">Kitchen</option>
                    <option value="Company">Company</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-display">Restaurant *</label>
                  <select value={formData.restaurant} onChange={(e) => setFormData({ ...formData, restaurant: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" required>
                    <option value="">Select Restaurant</option>
                    <option value="Lakay Ago">Lakay Ago</option>
                    <option value="Aroo">Aroo</option>
                    <option value="Both">Both</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-display">Pay Per Day *</label>
                  <input type="number" step="0.01" value={formData.pay_per_day} onChange={(e) => setFormData({ ...formData, pay_per_day: Number(e.target.value) || 0 })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" required />
                  <span className="text-xs text-slate-500">PHP</span>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-display">SSS (PHP)</label>
                  <input type="number" step="0.01" value={formData.sss} onChange={(e) => setFormData({ ...formData, sss: Number(e.target.value) || 0 })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                  <span className="text-xs text-slate-500">PHP</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-display">PhilHealth (PHP)</label>
                  <input type="number" step="0.01" value={formData.philhealth} onChange={(e) => setFormData({ ...formData, philhealth: Number(e.target.value) || 0 })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                  <span className="text-xs text-slate-500">PHP</span>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-display">Pag-IBIG (PHP)</label>
                  <input type="number" step="0.01" value={formData.pagibig} onChange={(e) => setFormData({ ...formData, pagibig: Number(e.target.value) || 0 })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                  <span className="text-xs text-slate-500">PHP</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-display">13th Month Pay (PHP)</label>
                  <input type="number" step="0.01" value={formData.month_pay_13th || ''} onChange={(e) => setFormData({ ...formData, month_pay_13th: e.target.value === '' ? 0 : Number(e.target.value) })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                  <span className="text-xs text-slate-500">PHP</span>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-display">Status</label>
                  <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as Employee["status"] })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="On Leave">On Leave</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
                <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display">{loading ? "Saving..." : "Save Changes"}</button>
              </div>
            </form>
          )}

          {tab === "attendance" && (
            <div className="w-3xl">
              {tabLoading.attendance ? (
                <p className="text-sm text-slate-500 text-center py-8">Loading attendance...</p>
              ) : attendanceRows.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No attendance records found for this employee.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        {['Date', 'Day', 'Time In', 'Time Out', 'Status'].map(h => (
                          <th key={h} className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {attendanceRows.map((row: any) => {
                        const status = getAttendanceStatus(row)
                        return (
                          <tr key={row.attendance_id ?? row.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 text-sm text-slate-600">{formatDateForDisplay(row.work_date)}</td>
                            <td className="py-2 px-3 text-sm text-slate-600">{new Date(`${row.work_date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).toUpperCase()}</td>
                            <td className="py-2 px-3 text-sm font-mono text-slate-600">{formatTabTime(row.first_on_duty)}</td>
                            <td className="py-2 px-3 text-sm font-mono text-slate-600">{formatTabTime(row.first_off_duty)}</td>
                            <td className="py-2 px-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium font-display ${status === 'Present' ? 'bg-emerald-100 text-emerald-700' : status === 'Absent' ? 'bg-red-100 text-red-700' : status === 'On Leave' ? 'bg-violet-100 text-violet-700' : status === 'Rest Day' ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-700'}`}>
                                {status}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "leave" && (
            <div className="w-3xl">
              {tabLoading.leave ? (
                <p className="text-sm text-slate-500 text-center py-8">Loading leave records...</p>
              ) : leaveRows.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No leave records found for this employee.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        {['Type', 'Start', 'End', 'Days', 'Status'].map(h => (
                          <th key={h} className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {leaveRows.map((row: any) => (
                        <tr key={row.id ?? row.leave_request_id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-sm text-slate-600">{row.leaveType || row.leave_type_name || '—'}</td>
                          <td className="py-2 px-3 text-sm text-slate-600">{formatDateForDisplay(row.startDate || row.start_date)}</td>
                          <td className="py-2 px-3 text-sm text-slate-600">{formatDateForDisplay(row.endDate || row.end_date)}</td>
                          <td className="py-2 px-3 text-sm font-mono text-slate-600">{row.days ?? 0}</td>
                          <td className="py-2 px-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium font-display ${row.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : row.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                              {row.status || 'Pending'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "payroll-history" && (
            <div className="w-3xl">
              {tabLoading.payroll ? (
                <p className="text-sm text-slate-500 text-center py-8">Loading payroll history...</p>
              ) : payrollRows.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No payroll history found for this employee.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        {['Gross Pay', 'Deductions', 'Net Pay'].map(h => (
                          <th key={h} className="py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {payrollRows.map((row: any) => (
                        <tr key={row.payslip_id ?? row.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-sm font-mono text-slate-600">{formatCurrency(Number(row.gross_pay ?? 0))}</td>
                          <td className="py-2 px-3 text-sm font-mono text-red-600">{formatCurrency(Number(row.total_deduction ?? 0))}</td>
                          <td className="py-2 px-3 text-sm font-mono text-slate-700">{formatCurrency(Number(row.net_pay ?? 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {tab === "overview" && !isEditing && (
          <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Close</button>
            <button onClick={() => setIsEditing(true)} className="px-4 py-2 text-sm font-medium border border-slate-200 text-white bg-green-700 rounded-lg hover:bg-green-600 font-display">Edit</button>
            <button onClick={() => onArchive?.(employee)} className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg font-display">Archive</button>
          </div>
        )}
        {showDiscardConfirm && (
          <Modal open={true} title="You have unsaved changes" onClose={() => setShowDiscardConfirm(false)}>
            <div className="bg-white w-full p-4">
              <p className="text-sm text-slate-600 mb-6">You have unsaved changes. Do you want to discard them?</p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowDiscardConfirm(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Keep editing</button>
                <button onClick={() => { setShowDiscardConfirm(false); setIsEditing(false); onClose() }} className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg">Discard changes</button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </Modal>
  )
}

const normalizeEmployeeStatus = (status?: string | null) => String(status ?? "").trim().toLowerCase()

const hasDuplicateActiveEmployee = (employees: Employee[] = [], sourceEmployeeId: string, restaurant: string, currentEmployeeId?: string) => {
  const trimmedEmployeeId = String(sourceEmployeeId ?? "").trim()
  const trimmedRestaurant = String(restaurant ?? "").trim()

  if (!trimmedEmployeeId || !trimmedRestaurant) return false

  return employees.some((employee) => {
    if (currentEmployeeId && String(employee.id) === String(currentEmployeeId)) return false
    if (String(employee.source_employee_id).trim() !== trimmedEmployeeId) return false
    if (String(employee.restaurant).trim() !== trimmedRestaurant) return false
    return normalizeEmployeeStatus(employee.status) === "active"
  })
}

const StatusBadge = ({ status }: { status: Employee["status"] }) => {
  const map: Record<string, string> = {
    Active: "bg-emerald-100 text-emerald-700",
    Inactive: "bg-slate-100 text-slate-500",
    "On Leave": "bg-violet-100 text-violet-700",
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium font-display ${map[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === "Active" ? "bg-emerald-500" : status === "On Leave" ? "bg-violet-500" : "bg-slate-400"}`} />
      {status}
    </span>
  )
}

function AddEmployeeModal({ onClose, onSave, existingEmployees }: { onClose: () => void; onSave: (employee: Employee) => void; existingEmployees: Employee[] }) {
  const { showToast } = useApp()
  const [formData, setFormData] = useState({
    source_employee_id: "",
    name: "",
    department: "",
    restaurant: "Lakay Ago",
    pay_per_day: 0,
    status: "Active" as Employee["status"],
    email: "",
    contactNumber: "",
    sss: 0,
    philHealth: 0,
    pagibig: 0,
    month_pay_13th: 0,
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.source_employee_id || !formData.name || !formData.department || !formData.restaurant || !formData.status || formData.pay_per_day <= 0 || formData.sss <= 0 || formData.philHealth <= 0 || formData.pagibig <= 0) {
      showToast({ type: "error", message: "Missing required fields", description: "All fields except Email and Contact Number are required." })
      return
    }

    if (formData.status === "Active" && hasDuplicateActiveEmployee(existingEmployees, formData.source_employee_id, formData.restaurant)) {
      showToast({
        type: "error",
        message: "Duplicate active employee",
        description: `An active employee with ID ${formData.source_employee_id} already exists for ${formData.restaurant}.`,
      })
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_employee_id: formData.source_employee_id,
        name: formData.name,
        department: formData.department || null,
        pay_per_day: formData.pay_per_day || null,
        restaurant: formData.restaurant,
        status: formData.status,
        email: formData.email || null,
        contactNumber: formData.contactNumber || null,
        sss: formData.sss || null,
        philhealth: formData.philHealth || null,
        pagibig: formData.pagibig || null,
        month_pay_13th: formData.month_pay_13th || null,
      }),
    })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to create employee")
      }
      const body = await res.json()
      const created = body.employee
      // map DB fields to Employee type
      const employee: Employee = {
        id: String(created.employee_id),
        source_employee_id: String(created.source_employee_id),
        name: formData.name,
        restaurant: formData.restaurant,
        department: formData.department,
        pay_per_day: created.pay_per_day ? Number(created.pay_per_day) : formData.pay_per_day,
        status: (created.status || formData.status) as Employee["status"],
        email: formData.email,
        contactNumber: formData.contactNumber,
        sss: formData.sss,
        philhealth: formData.philHealth,
        pagibig: formData.pagibig,
        month_pay_13th: formData.month_pay_13th,
      }
      showToast({ type: "success", message: "Employee created", description: `${employee.name} was added.` })
      onSave(employee)
      onClose()
    } catch (err: any) {
      showToast({ type: "error", message: "Create failed", description: err.message || "Could not create employee" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={true} title="Add Employee" onClose={onClose}>
      <form onSubmit={handleSubmit} className="bg-white w-full max-h-[60vh] flex flex-col">
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Personal Info */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 font-display mb-3 pb-2 border-b border-slate-100">Personal Info</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1 font-display">Name *</label>
                <input
                  value={formData.name}
                  onChange={(e) => {
                    const name = e.target.value
                    const parts = name.trim().split(/\s+/)
                    setFormData(prev => ({
                      ...prev,
                      name,
                      firstName: parts[0] || '',
                      middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : '',
                      lastName: parts.length > 1 ? parts[parts.length - 1] : '',
                    }))
                  }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-display">Email</label>
                  <input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-display">Contact Number</label>
                  <input value={formData.contactNumber} onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                </div>
              </div>
            </div>
          </div>

          {/* Employment */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 font-display mb-3 pb-2 border-b border-slate-100">Employment</h4>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-display">Employee ID *</label>
                  <input value={formData.source_employee_id} onChange={(e) => setFormData({ ...formData, source_employee_id: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" required />
                </div>
                <div>
                 <label className="block text-xs text-slate-500 mb-1 font-display">Department *</label>
                 <select
                   value={formData.department}
                   onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                   className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                   required
                 >
                   <option value="">Select Department</option>
                   <option value="Production">Production</option>
                   <option value="Kitchen">Kitchen</option>
                   <option value="Company">Company</option>
                 </select>
               </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1 font-display">Restaurant *</label>
                <select
                  value={formData.restaurant}
                  onChange={(e) => setFormData({ ...formData, restaurant: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  required
                >
                  <option value="">Select Restaurant</option>
                  <option value="Lakay Ago">Lakay Ago</option>
                  <option value="Aroo">Aroo</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1 font-display">Status *</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as Employee["status"] })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  required
                >
                  <option value="">Select Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="On Leave">On Leave</option>
                </select>
              </div>
            </div>
          </div>

          {/* Payroll */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 font-display mb-3 pb-2 border-b border-slate-100">Payroll</h4>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-display">Pay Per Day</label>
                  <input type="number" step="0.01" inputMode="decimal" value={formData.pay_per_day === 0 ? "" : formData.pay_per_day} placeholder="0.00" onChange={(e) => setFormData({ ...formData, pay_per_day: e.target.value === "" ? 0 : Number(e.target.value) })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" required />
                  <span className="text-xs text-slate-500">PHP</span>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-display">SSS (PHP) *</label>
                  <input type="number" step="0.01" inputMode="decimal" value={formData.sss === 0 ? "" : formData.sss} placeholder="0.00" onChange={(e) => setFormData({ ...formData, sss: e.target.value === "" ? 0 : Number(e.target.value) })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-display">PhilHealth (PHP) *</label>
                  <input type="number" step="0.01" inputMode="decimal" value={formData.philHealth === 0 ? "" : formData.philHealth} placeholder="0.00" onChange={(e) => setFormData({ ...formData, philHealth: e.target.value === "" ? 0 : Number(e.target.value) })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" required />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-display">Pag-IBIG (PHP) *</label>
                  <input type="number" step="0.01" inputMode="decimal" value={formData.pagibig === 0 ? "" : formData.pagibig} placeholder="0.00" onChange={(e) => setFormData({ ...formData, pagibig: e.target.value === "" ? 0 : Number(e.target.value) })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" required />
                  <span className="text-xs text-slate-500">PHP</span>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-display">13th Month Pay (PHP) *</label>
                  <input type="number" step="0.01" inputMode="decimal" value={formData.month_pay_13th === 0 ? "" : formData.month_pay_13th} placeholder="0.00" onChange={(e) => setFormData({ ...formData, month_pay_13th: e.target.value === "" ? 0 : Number(e.target.value) })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" required />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="px-3 py-3 border-t border-slate-100 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={loading} className="px-3 py-2 text-sm border rounded">Cancel</button>
          <button type="submit" disabled={loading} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded">{loading ? "Creating..." : "Create"}</button>
        </div>
      </form>
    </Modal>
  )
}

export default function Employees() {
  const { showToast } = useApp()
  const isMobile = useIsMobile()
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [archiveConfirm, setArchiveConfirm] = useState<Employee | null>(null)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [showAdd, setShowAdd] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])

  const PER_PAGE = 10

  const loadEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/employees")
      if (!res.ok) return
      const body = await res.json()
      setEmployees(body.employees || [])
    } catch (err) {
      console.error("Failed to load employees", err)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (mounted) await loadEmployees()
    })()
    return () => {
      mounted = false
    }
  }, [loadEmployees])

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase()
    return !q || e.name.toLowerCase().includes(q) || e.source_employee_id.toLowerCase().includes(q)
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const pageData = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const emptyRowsCount = Math.max(0, PER_PAGE - pageData.length)

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-display">Employees</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage employee records</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg font-display"><Plus size={16} /> Add Employee</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 flex flex-wrap gap-3 shadow-sm">
        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 flex-1 min-w-48 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search employee..." className="bg-transparent text-sm outline-none text-slate-700 w-full placeholder:text-slate-400" />
        </div>
        <div className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white outline-none font-display">Department: All</div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {!isMobile ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Employee', 'ID', 'Restaurant', 'Status', 'Salary', '13th Month'].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pageData.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50 group cursor-pointer" onClick={() => setSelectedEmployee(emp)}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                          <span className="text-indigo-700 text-[10px] font-bold font-display">{emp.name.toString().slice(0, 2)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700 font-display whitespace-nowrap">{emp.name}</p>
                          <p className="text-xs text-slate-400">{emp.email || ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600">{emp.source_employee_id}</td>
                    <td className="py-3 px-4 text-sm text-slate-600">{emp.restaurant}</td>
                    <td className="py-3 px-4"><StatusBadge status={emp.status} /></td>
                    <td className="py-3 px-4 font-mono text-sm text-slate-700">{formatCurrency(Number(emp.pay_per_day || 0))}</td>
                    <td className="py-3 px-4 font-mono text-sm text-slate-700">{emp.month_pay_13th ? formatCurrency(emp.month_pay_13th) : '—'}</td>
                  </tr>
                ))}
                {Array.from({ length: emptyRowsCount }).map((_, i) => (
                  <tr key={`empty-${i}`} className="invisible">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-5 h-7 rounded-full bg-indigo-100 shrink-0" />
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600">0</td>
                    <td className="py-3 px-4 text-sm text-slate-600">Department</td>
                    <td className="py-3 px-4"><span className="text-xs px-2 py-0.5 rounded-full font-medium font-display bg-slate-100 text-slate-500"></span></td>
                    <td className="py-3 px-4 font-mono text-sm text-slate-700">0.00</td>
                    <td className="py-3 px-4 font-mono text-sm text-slate-700">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col">
              {pageData.map((emp) => (
                <button key={emp.id} onClick={() => setSelectedEmployee(emp)} className="text-left p-3 border-b border-slate-50 hover:bg-slate-50 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-700">{emp.name}</div>
                    <div className="text-xs text-slate-400">{emp.department}</div>
                  </div>
                  <div className="text-sm font-mono text-slate-700">{formatCurrency(Number(emp.pay_per_day || 0))}</div>
                </button>
              ))}
              {Array.from({ length: emptyRowsCount }).map((_, i) => (
                <div key={`empty-mobile-${i}`} className="invisible p-3 border-b border-slate-50 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">placeholder</div>
                    <div className="text-xs text-slate-400">Department</div>
                  </div>
                  <div className="text-sm font-mono text-slate-700">$0.00</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-white rounded-b-xl">
        <p className="text-xs text-slate-500">
          Showing {filtered.length === 0 ? 0 : (page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length} employees
        </p>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40">
            <ChevronLeft size={16} />
          </button>
          {Array.from({ length: totalPages }, (_, i) => {
            const p = i + 1
            const show = p === 1 || p === totalPages || Math.abs(p - page) <= 2
            if (!show) {
              if (i === 1 || i === totalPages - 2) return <span key={p} className="px-1 text-slate-400">…</span>
              return null
            }
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-7 h-7 rounded-lg text-xs font-medium font-display ${page === p ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}
              >
                {p}
              </button>
            )
          })}
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {selectedEmployee && (
        <EmployeeDetailModal
          employee={selectedEmployee}
          existingEmployees={employees}
          onClose={() => setSelectedEmployee(null)}
          onArchive={e => { setSelectedEmployee(null); setArchiveConfirm(e) }}
          onUpdate={(updated) => {
            const idx = employees.findIndex(e => e.id === updated.id)
            if (idx !== -1) {
              employees[idx] = { ...employees[idx], ...updated }
              setEmployees([...employees])
            }
            setSelectedEmployee(updated)
            showToast({ type: 'success', message: 'Employee updated', description: `${updated.name} has been updated.` })
            loadEmployees()
          }}
        />
      )}

      {showAdd && <AddEmployeeModal existingEmployees={employees} onClose={() => setShowAdd(false)} onSave={(emp) => { loadEmployees(); showToast({ type: "success", message: "Employee created" }); setShowAdd(false) }} />}

      {archiveConfirm && (
        <Modal open={!!archiveConfirm} title="Archive Employee" onClose={() => setArchiveConfirm(null)}>
          <div className="bg-white w-full p-4">
            <p className="text-sm text-slate-600 mb-6">Are you sure you want to archive <span className="font-semibold text-slate-800">{archiveConfirm.name}</span>? This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setArchiveConfirm(null)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={() => { setEmployees((prev) => prev.filter((e) => e.id !== archiveConfirm.id)); setArchiveConfirm(null); loadEmployees(); showToast({ type: "info", message: "Employee archived", description: `${archiveConfirm.name} was archived.` }) }} className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg">Archive</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}