'use client'
import { useState, useEffect } from 'react'
import { Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { employees as allEmployees, departments } from '../data/mockData'
import type { Employee } from '../types'
import { useApp } from '../App'
import useIsMobile from '../hooks/isMobile'
import Modal from '../components/Modal'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(n)

const StatusBadge = ({ status }: { status: Employee['status'] }) => {
  const map: Record<string, string> = {
    Active: 'bg-emerald-100 text-emerald-700',
    Inactive: 'bg-slate-100 text-slate-500',
    'On Leave': 'bg-violet-100 text-violet-700',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium font-display ${map[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'Active' ? 'bg-emerald-500' : status === 'On Leave' ? 'bg-violet-500' : 'bg-slate-400'}`} />
      {status}
    </span>
  )
}

const TypeBadge = ({ type }: { type: Employee['employmentType'] }) => {
  const map: Record<string, string> = {
    'Full-Time': 'bg-blue-100 text-blue-700',
    'Part-Time': 'bg-amber-100 text-amber-700',
    Contractual: 'bg-orange-100 text-orange-700',
  }
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium font-display ${map[type]}`}>{type}</span>
}

function AddEmployeeModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [tab, setTab] = useState<'personal' | 'employment' | 'payroll'>('personal')
  return (
    <Modal open={true} title="Add Employee" onClose={onClose}>
      <div className="bg-white w-full max-h-[70vh] flex flex-col">
        <div className="flex gap-1 px-1 pt-2">
          {(['personal', 'employment', 'payroll'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-2 py-2 text-sm font-medium rounded-lg font-display capitalize cursor-pointer ${tab === t ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>
              {t === 'personal' ? 'Personal Info' : t === 'employment' ? 'Employment' : 'Payroll'}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {tab === 'personal' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">First Name</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Last Name</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
              </div>
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Address</label>
                <textarea placeholder="123 Mabini St., Quezon City" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none h-20" />
              </div>
            </div>
          )}

          {tab === 'employment' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Employee ID</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Position</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Department</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white">
                  <option value="">Select...</option>
                  {departments.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>
          )}

          {tab === 'payroll' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Salary Type</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white">
                  <option>Monthly</option>
                  <option>Bi-Monthly</option>
                  <option>Daily</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Basic Salary (₱)</label>
                <input type="number" placeholder="20000" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
              </div>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 font-display">Cancel</button>
          <button onClick={onSave} className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 cursor-pointer text-white rounded-lg font-display">Save Employee</button>
        </div>
      </div>
    </Modal>
  )
}

function EditEmployeeForm({ employee, onCancel, onSave }: { employee: Employee; onCancel: () => void; onSave: (e: Employee) => void }) {
  const { showToast } = useApp()
  const [firstName, setFirstName] = useState(employee.firstName || '')
  const [lastName, setLastName] = useState(employee.lastName || '')
  const [department, setDepartment] = useState(employee.department || '')
  const [contactNumber, setContactNumber] = useState(employee.contactNumber || '')
  const [basicSalary, setBasicSalary] = useState<number>(employee.basicSalary || 0)
  const [sss, setSss] = useState<number | ''>(employee.sss ?? '')
  const [philHealth, setPhilHealth] = useState<number | ''>(employee.philHealth ?? '')
  const [pagibig, setPagibig] = useState<number | ''>(employee.pagibig ?? '')

  function handleSave() {
    if (!firstName.trim() || !lastName.trim()) {
      showToast({ type: 'error', message: 'Missing required fields', description: 'First and last name required.' })
      return
    }
    const updated: Employee = {
      ...employee,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      department,
      contactNumber,
      basicSalary: Number(basicSalary) || 0,
      sss: sss === '' ? undefined : Number(sss),
      philHealth: philHealth === '' ? undefined : Number(philHealth),
      pagibig: pagibig === '' ? undefined : Number(pagibig),
    }
    onSave(updated)
  }

  return (
    <div className="w-full bg-white p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Employee ID</label>
          <input value={employee.id} readOnly className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-600 outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Department</label>
          <select value={department} onChange={e => setDepartment(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none bg-white">
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1 font-display">First Name</label>
          <input value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Last Name</label>
          <input value={lastName} onChange={e => setLastName(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Contact Number</label>
          <input value={contactNumber} onChange={e => setContactNumber(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Basic Salary (₱)</label>
          <input type="number" value={basicSalary} onChange={e => setBasicSalary(Number(e.target.value))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1 font-display">SSS</label>
          <input type="number" value={sss as any} onChange={e => setSss(e.target.value === '' ? '' : Number(e.target.value))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1 font-display">PhilHealth</label>
          <input type="number" value={philHealth as any} onChange={e => setPhilHealth(e.target.value === '' ? '' : Number(e.target.value))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Pag-IBIG</label>
          <input type="number" value={pagibig as any} onChange={e => setPagibig(e.target.value === '' ? '' : Number(e.target.value))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
        </div>
      </div>
      <div className="flex gap-3 justify-end mt-4">
        <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
        <button onClick={handleSave} className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">Save</button>
      </div>
    </div>
  )
}

function EmployeeProfileModal({ employee, onClose, onArchive, onUpdate }: { employee: Employee; onClose: () => void; onArchive?: (e: Employee) => void; onUpdate?: (e: Employee) => void }) {
  const isMobile = useIsMobile()
  const [isEditing, setIsEditing] = useState(false)
  const [tab, setTab] = useState<'overview' | 'attendance' | 'leave' | 'payroll-history'>('overview')
  const [selectedAttendance, setSelectedAttendance] = useState<any | null>(null)
  const [selectedPayroll, setSelectedPayroll] = useState<any | null>(null)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)

  const attendanceRecords = [
    { date: 'Aug 11, 2026', in: '8:00 AM', out: '5:00 PM', late: '—', ot: '—', s: 'Present' },
    { date: 'Aug 10, 2026', in: '8:03 AM', out: '5:00 PM', late: '3 min', ot: '—', s: 'Present' },
    { date: 'Aug 9, 2026', in: '8:00 AM', out: '6:30 PM', late: '—', ot: '1.5 hrs', s: 'Present' },
  ]

  const payrollRecords = [
    { p: 'Aug 1–15, 2026', g: 23550, d: 1675, n: 21875, s: 'Pending' },
    { p: 'Jul 16–31, 2026', g: 23550, d: 1675, n: 21875, s: 'Finalized' },
  ]

  function AttendanceDetailModal({ item, onClose }: { item: any; onClose: () => void }) {
    if (!item) return null
    return (
      <Modal open={true} title={`Attendance`} onClose={onClose}>
        <div className="w-md bg-white p-4">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-400">Date</p>
              <p className="text-sm font-medium text-slate-700">{item.date}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-400">Time In</p>
                <p className="text-sm text-slate-700 font-mono">{item.in || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Time Out</p>
                <p className="text-sm text-slate-700 font-mono">{item.out || '—'}</p>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    )
  }

  function PayrollDetailModal({ item, onClose }: { item: any; onClose: () => void }) {
    if (!item) return null
    return (
      <Modal open={true} title={`Payroll`} onClose={onClose}>
        <div className="w-md bg-white p-4">
          <div>
            <p className="text-xs text-slate-400">Period</p>
            <p className="text-sm font-medium text-slate-700">{item.p}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <p className="text-xs text-slate-400">Gross Pay</p>
              <p className="text-sm font-mono text-slate-700">{fmt(item.g)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Net Pay</p>
              <p className="text-sm font-semibold text-emerald-700">{fmt(item.n)}</p>
            </div>
          </div>
        </div>
      </Modal>
    )
  }

  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
      return ''
    }
    if (isEditing) {
      window.addEventListener('beforeunload', handler)
      return () => window.removeEventListener('beforeunload', handler)
    }
  }, [isEditing])

  function requestClose() {
    if (isEditing) {
      setShowDiscardConfirm(true)
      return
    }
    onClose()
  }

  return (
    <Modal open={true} title={isEditing ? `Edit ${employee.firstName} ${employee.lastName}` : `Employee Information`} onClose={requestClose}>
      <div className="w-full h-[75vh] flex flex-col">
        <div className="flex items-start justify-between px-2 py-5 border-b border-slate-100">
          <div>
            <h3 className="text-xl font-bold text-slate-800 font-display">{employee.firstName} {employee.lastName}</h3>
            <p className="text-sm text-slate-500">{employee.id} · {employee.position}</p>
            <p className="text-xs text-slate-400">{employee.department} Department</p>
          </div>
        </div>

        {/* Tabs */}
        {isMobile ? (
          <div className="border-slate-100 flex flex-wrap gap-1 px-1 py-1">
            <select value={tab} onChange={(e) => { if (isEditing && e.target.value !== 'overview') return; setTab(e.target.value as any) }} className="w-full px-2 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-display cursor-pointer">
              <option value="overview">Overview</option>
              <option value="attendance" disabled={isEditing}>Attendance</option>
              <option value="leave" disabled={isEditing}>Leave</option>
              <option value="payroll-history" disabled={isEditing}>Payroll History</option>
            </select>
          </div>
        ) : (
          <div className="border-b border-slate-100 flex gap-1 px-6 py-2">
            {[{ id: 'overview', label: 'Overview' }, { id: 'attendance', label: 'Attendance' }, { id: 'leave', label: 'Leave' }, { id: 'payroll-history', label: 'Payroll History' }].map(t => (
              <button
                key={t.id}
                onClick={() => { if (isEditing && t.id !== 'overview') return; setTab(t.id as any) }}
                aria-disabled={isEditing && t.id !== 'overview'}
                className={`px-4 py-2 text-sm font-medium rounded-lg font-display ${tab === t.id ? 'bg-indigo-50 text-indigo-700' : isEditing && t.id !== 'overview' ? 'text-slate-300 cursor-not-allowed opacity-60' : 'text-slate-500 hover:text-slate-700'}`}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {!isEditing ? (
            <>
              {tab === 'overview' && (
                <div className="w-3xl grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Employee Information</p>
                    <div className="space-y-3">
                      {[{ label: 'Employee ID', value: employee.id }, { label: 'Department', value: employee.department }, { label: 'Name', value: `${employee.firstName} ${employee.lastName}` }, { label: 'Contact Number', value: employee.contactNumber }, { label: 'Basic Salary', value: fmt(employee.basicSalary) }, { label: 'SSS', value: employee.sss ?? '—' }, { label: 'PhilHealth', value: employee.philHealth ?? '—' }, { label: 'Pag-IBIG', value: employee.pagibig ?? '—' }].map(f => (
                        <div key={f.label} className="flex flex-col gap-0.5"><span className="text-xs text-slate-400 font-display">{f.label}</span><span className="text-sm font-medium text-slate-700">{f.value}</span></div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Additional Details</p>
                    <div className="space-y-3">
                      {[{ label: 'Position', value: employee.position }, { label: 'Employment Type', value: employee.employmentType }, { label: 'Date Hired', value: employee.dateHired }].map(f => (
                        <div key={f.label} className="flex flex-col gap-0.5"><span className="text-xs text-slate-400 font-display">{f.label}</span><span className="text-sm font-medium text-slate-700">{f.value}</span></div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <EditEmployeeForm employee={employee} onCancel={() => setIsEditing(false)} onSave={(u) => { onUpdate?.(u); setIsEditing(false) }} />
          )}

          {tab === 'attendance' && (
            <div>
              {isMobile ? (
                <div className="w-md flex flex-col divide-y divide-slate-50">
                  {attendanceRecords.map((r, i) => (
                    <button key={i} onClick={() => setSelectedAttendance(r)} className="text-left p-3 hover:bg-slate-50 flex items-center justify-between gap-3">
                      <div className="min-w-0"><div className="text-sm font-medium text-slate-700 truncate">{r.date}</div><div className="text-xs text-slate-400 truncate">{r.in || '—'} • {r.out || '—'}</div></div>
                      <div className="text-xs text-slate-500">{r.s}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="w-3xl">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Recent Attendance</p>
                  <table className="text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">{['Date', 'Time In', 'Time Out', 'Late', 'Overtime', 'Status'].map(h => <th key={h} className="text-left py-2 px-2 text-xs font-semibold text-slate-400 font-display">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {attendanceRecords.map((r, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer"><td className="py-2.5 px-2 text-slate-600">{r.date}</td><td className="py-2.5 px-2 font-mono text-xs">{r.in || '—'}</td><td className="py-2.5 px-2 font-mono text-xs">{r.out || '—'}</td><td className="py-2.5 px-2 text-amber-600 text-xs">{r.late}</td><td className="py-2.5 px-2 text-indigo-600 text-xs">{r.ot}</td><td className="py-2.5 px-2"><span className={`text-xs px-2 py-0.5 rounded-full font-medium font-display ${r.s === 'Present' ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700'}`}>{r.s}</span></td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {selectedAttendance && <AttendanceDetailModal item={selectedAttendance} onClose={() => setSelectedAttendance(null)} />}
            </div>
          )}

          {tab === 'leave' && (
            <div className="w-3xl">
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[{ type: 'Vacation Leave', used: 3, total: 10 }, { type: 'Sick Leave', used: 1, total: 10 }].map(l => (
                  <div key={l.type} className="bg-slate-50 rounded-xl p-3.5"><p className="text-xs font-semibold text-slate-600 font-display mb-2">{l.type}</p><div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mb-1.5"><div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(l.used / l.total) * 100}%` }} /></div><div className="text-xs text-slate-500">Remaining: <b className="text-slate-700">{l.total - l.used}</b> days</div></div>
                ))}
              </div>
            </div>
          )}

          {tab === 'payroll-history' && (
            <div className="w-md">
              {isMobile ? (
                <div className="flex flex-col divide-y divide-slate-50">{payrollRecords.map((r, i) => (<button key={i} onClick={() => setSelectedPayroll(r)} className="text-left p-3 hover:bg-slate-50 flex items-center justify-between gap-3"><div className="min-w-0"><div className="text-sm font-medium text-slate-700 truncate">{r.p}</div><div className="text-xs text-slate-400 truncate">{fmt(r.g)} • {fmt(r.n)}</div></div><div className="text-xs text-slate-500">{r.s}</div></button>))}</div>
              ) : (
                <div className="w-3xl"><table className="text-sm"><thead><tr className="border-b border-slate-100">{['Period', 'Gross Pay', 'Deductions', 'Net Pay', 'Status'].map(h => <th key={h} className="text-left py-2 px-2 text-xs font-semibold text-slate-400 font-display">{h}</th>)}</tr></thead><tbody>{payrollRecords.map((r, i) => (<tr key={i} className="border-b border-slate-50 hover:bg-slate-50"><td className="py-2.5 px-2 text-slate-600">{r.p}</td><td className="py-2.5 px-2 font-mono text-xs text-slate-700">{fmt(r.g)}</td><td className="py-2.5 px-2 font-mono text-xs text-red-600">{fmt(r.d)}</td><td className="py-2.5 px-2 font-mono text-xs font-semibold text-emerald-700">{fmt(r.n)}</td><td className="py-2.5 px-2"><span className={`text-xs px-2 py-0.5 rounded-full font-medium font-display ${r.s === 'Finalized' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{r.s}</span></td></tr>))}</tbody></table></div>
              )}
              {selectedPayroll && <PayrollDetailModal item={selectedPayroll} onClose={() => setSelectedPayroll(null)} />}
            </div>
          )}
        </div>

        {!isEditing && (
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

export default function Employees() {
  const { showToast, openEmployeeId, clearOpenEmployee } = useApp()
  const isMobile = useIsMobile()
  const [search, setSearch] = useState('')
  const [dept, setDept] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [showAdd, setShowAdd] = useState(false)
  const [viewEmployee, setViewEmployee] = useState<Employee | null>(null)
  const [archiveConfirm, setArchiveConfirm] = useState<Employee | null>(null)
  const PER_PAGE = 10

  useEffect(() => {
    if (!openEmployeeId) return
    const emp = allEmployees.find(e => e.id === openEmployeeId)
    if (emp) setViewEmployee(emp)
    clearOpenEmployee?.()
  }, [openEmployeeId, clearOpenEmployee])

  const filtered = allEmployees.filter(e => {
    const q = search.toLowerCase()
    const matchSearch = !q || `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) || e.id.toLowerCase().includes(q)
    const matchDept = !dept || e.department === dept
    const matchType = !type || e.employmentType === type
    const matchStatus = !status || e.status === status
    return matchSearch && matchDept && matchType && matchStatus
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const pageData = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-display">Employees</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage employee information and payroll details</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg font-display"><Plus size={16} /> Add Employee</button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 flex flex-wrap gap-3 shadow-sm">
        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 flex-1 min-w-48 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search employee..." className="bg-transparent text-sm outline-none text-slate-700 w-full placeholder:text-slate-400" />
        </div>
        {[
          { label: 'Department', value: dept, set: setDept, opts: ['Chefs & Cooks', 'Waiters', 'Cashiers', 'Management'] },
          { label: 'Employment Type', value: type, set: setType, opts: ['Full-Time', 'Part-Time', 'Contractual'] },
          { label: 'Status', value: status, set: setStatus, opts: ['Active', 'Inactive', 'On Leave'] },
        ].map(f => (
          <select key={f.label} value={f.value} onChange={e => { f.set(e.target.value); setPage(1) }} className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 font-display">
            <option value="">{f.label}: All</option>
            {f.opts.map(o => <option key={o}>{o}</option>)}
          </select>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {!isMobile ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Employee ID', 'Employee', 'Department', 'Position', 'Employment Type', 'Basic Salary', 'Status'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pageData.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-50 group cursor-pointer" onClick={() => setViewEmployee(emp)}>
                    <td className="py-3 px-4"><span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{emp.id}</span></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0"><span className="text-indigo-700 text-xs font-bold font-display">{emp.firstName[0]}{emp.lastName[0]}</span></div>
                        <div><p className="text-sm font-semibold text-slate-700 font-display">{emp.firstName} {emp.lastName}</p><p className="text-xs text-slate-400">{emp.email}</p></div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">{emp.department}</td>
                    <td className="py-3 px-4 text-sm text-slate-600">{emp.position}</td>
                    <td className="py-3 px-4"><TypeBadge type={emp.employmentType} /></td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700">{fmt(emp.basicSalary)}</td>
                    <td className="py-3 px-4"><StatusBadge status={emp.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col">
              {pageData.map(emp => (
                <button key={emp.id} onClick={() => setViewEmployee(emp)} className="text-left p-3 border-b border-slate-50 hover:bg-slate-50 flex items-center gap-3 cursor-pointer">
                  <div className="w-10"><div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center"><span className="text-indigo-700 text-xs font-bold font-display">{emp.firstName[0]}{emp.lastName[0]}</span></div></div>
                  <div className="flex-1 min-w-0"><div className="flex items-center justify-between"><div className="truncate"><div className="text-sm font-medium text-slate-700">{emp.firstName} {emp.lastName}</div><div className="text-xs text-slate-400">{emp.position} • {emp.department}</div></div><div className="text-xs text-slate-500">{fmt(emp.basicSalary)}</div></div></div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
          <p className="text-xs text-slate-500">Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length} employees</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"><ChevronLeft size={16} /></button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button key={i + 1} onClick={() => setPage(i + 1)} className={`w-7 h-7 rounded-lg text-xs font-medium font-display cursor-pointer ${page === i + 1 ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{i + 1}</button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      {archiveConfirm && (
        <Modal open={true} title="Archive Employee?" onClose={() => setArchiveConfirm(null)}>
          <div className="bg-white w-full p-3">
            <p className="text-sm text-slate-600 mb-6">Are you sure you want to archive <strong>{archiveConfirm.firstName} {archiveConfirm.lastName}</strong>? They will be marked as inactive.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setArchiveConfirm(null)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={() => { showToast({ type: 'success', message: 'Employee archived', description: `${archiveConfirm.firstName} ${archiveConfirm.lastName} has been archived.` }); setArchiveConfirm(null) }} className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg">Archive</button>
            </div>
          </div>
        </Modal>
      )}

      {showAdd && (
        <AddEmployeeModal onClose={() => setShowAdd(false)} onSave={() => { setShowAdd(false); showToast({ type: 'success', message: 'Employee saved', description: 'New employee has been added successfully.' }) }} />
      )}

      {viewEmployee && (
        <EmployeeProfileModal
          employee={viewEmployee}
          onClose={() => setViewEmployee(null)}
          onArchive={e => { setViewEmployee(null); setArchiveConfirm(e) }}
          onUpdate={(updated) => { const idx = allEmployees.findIndex(e => e.id === updated.id); if (idx !== -1) Object.assign(allEmployees[idx], updated); setViewEmployee(updated); showToast({ type: 'success', message: 'Employee updated', description: `${updated.firstName} ${updated.lastName} has been updated.` }) }}
        />
      )}
    </div>
  )
}
