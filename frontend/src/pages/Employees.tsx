import { useState, useEffect } from 'react'
import { Search, Plus, Eye, Edit2, Archive, ChevronLeft, ChevronRight, X, User } from 'lucide-react'
import { employees as allEmployees, departments } from '../data/mockData'
import type { Employee } from '../types'
import { useApp } from '../App'
import useIsMobile from '../hooks/isMobile'
import Modal from '../components/Modal'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(n)

const StatusBadge = ({ status }: { status: Employee['status'] }) => {
  const map = {
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
  const map = {
    'Full-Time': 'bg-blue-100 text-blue-700',
    'Part-Time': 'bg-amber-100 text-amber-700',
    Contractual: 'bg-orange-100 text-orange-700',
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium font-display ${map[type]}`}>
      {type}
    </span>
  )
}

function AddEmployeeModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [tab, setTab] = useState<'personal' | 'employment' | 'payroll'>('personal')

  return (
    <Modal open={true} title="Add Employee" onClose={onClose}>
      <div className="bg-white w-full max-h-[70vh] flex flex-col">
        <div className="flex gap-1 px-1 pt-2">
          {(['personal', 'employment', 'payroll'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-2 py-2 text-sm font-medium rounded-lg font-display capitalize cursor-pointer
                ${tab === t ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {t === 'personal' ? 'Personal Info' : t === 'employment' ? 'Employment' : 'Payroll'}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {tab === 'personal' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'First Name', ph: 'Juan' }, { label: 'Middle Name', ph: 'Ramos' },
                { label: 'Last Name', ph: 'Dela Cruz' }, { label: 'Date of Birth', ph: '', type: 'date' },
                { label: 'Contact Number', ph: '09171234567' }, { label: 'Email', ph: 'juan@company.ph', type: 'email' },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-xs font-medium text-slate-600 mb-1 font-display">{f.label}</label>
                  <input type={f.type || 'text'} placeholder={f.ph} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Sex</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white">
                  <option value="">Select...</option>
                  <option>Male</option>
                  <option>Female</option>
                </select>
              </div>
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Address</label>
                <textarea placeholder="123 Mabini St., Quezon City" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none h-20 overflow-y-auto break-words whitespace-normal" />
              </div>
            </div>
          )}
          {tab === 'employment' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'Employee ID', ph: 'EMP-046' },
                { label: 'Position', ph: 'Software Developer' },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-xs font-medium text-slate-600 mb-1 font-display">{f.label}</label>
                  <input type="text" placeholder={f.ph} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                </div>
              ))}
              {[
                { label: 'Department', opts: departments },
                { label: 'Employment Type', opts: ['Full-Time', 'Part-Time', 'Contractual'] },
                { label: 'Employment Status', opts: ['Active', 'Inactive'] },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-xs font-medium text-slate-600 mb-1 font-display">{f.label}</label>
                  <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white">
                    <option value="">Select...</option>
                    {f.opts.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Date Hired</label>
                <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
              </div>
            </div>
          )}
          {tab === 'payroll' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'Salary Type', opts: ['Monthly', 'Bi-Monthly', 'Daily'] },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-xs font-medium text-slate-600 mb-1 font-display">{f.label}</label>
                  <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white">
                    <option value="">Select...</option>
                    {f.opts.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Basic Salary (₱)</label>
                <input type="number" placeholder="20000" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Allowance (₱)</label>
                <input type="number" placeholder="1500" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
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

function EmployeeProfileModal({ employee, onClose, onArchive }: { employee: Employee; onClose: () => void; onArchive?: (e: Employee) => void }) {
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<'overview' | 'attendance' | 'leave' | 'payroll-history'>('overview')

  const [selectedAttendance, setSelectedAttendance] = useState<any | null>(null)
  const [selectedPayroll, setSelectedPayroll] = useState<any | null>(null)

  const attendanceRecords = [
    { date: 'Aug 11, 2026', in: '8:00 AM', out: '5:00 PM', late: '—', ot: '—', s: 'Present' },
    { date: 'Aug 10, 2026', in: '8:03 AM', out: '5:00 PM', late: '3 min', ot: '—', s: 'Present' },
    { date: 'Aug 9, 2026', in: '8:00 AM', out: '6:30 PM', late: '—', ot: '1.5 hrs', s: 'Present' },
    { date: 'Aug 8, 2026', in: '8:00 AM', out: '5:00 PM', late: '—', ot: '—', s: 'Present' },
    { date: 'Aug 7, 2026', in: '', out: '', late: '—', ot: '—', s: 'Leave' },
  ]

  const payrollRecords = [
    { p: 'Aug 1–15, 2026', g: 23550, d: 1675, n: 21875, s: 'Pending' },
    { p: 'Jul 16–31, 2026', g: 23550, d: 1675, n: 21875, s: 'Finalized' },
    { p: 'Jul 1–15, 2026', g: 22800, d: 1675, n: 21125, s: 'Finalized' },
    { p: 'Jun 16–30, 2026', g: 22800, d: 1675, n: 21125, s: 'Finalized' },
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-400">Late</p>
                <p className="text-sm text-amber-600">{item.late}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Overtime</p>
                <p className="text-sm text-indigo-600">{item.ot}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400">Status</p>
              <p className="text-sm font-semibold">{item.s}</p>
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
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-400">Period</p>
              <p className="text-sm font-medium text-slate-700">{item.p}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-400">Gross Pay</p>
                <p className="text-sm font-mono text-slate-700">{fmt(item.g)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Deductions</p>
                <p className="text-sm font-mono text-red-600">{fmt(item.d)}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400">Net Pay</p>
              <p className="text-lg font-semibold text-emerald-700">{fmt(item.n)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Status</p>
              <p className="text-sm">{item.s}</p>
            </div>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open={true} title={`Employee Information`} onClose={onClose}>
      <div className="w-full h-[70vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-2 py-5 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-bold text-slate-800 font-display">{employee.firstName} {employee.lastName}</h3>
                <StatusBadge status={employee.status} />
              </div>
              <p className="text-sm text-slate-500">{employee.id} · {employee.position}</p>
              <p className="text-xs text-slate-400">{employee.department} Department</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 font-display text-slate-600">
              <Edit2 size={14} className="shrink-0" />
            </button>
            {isMobile && (
              <button
                onClick={() => onArchive?.(employee)}
                className="px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 font-display text-slate-600"
                title="Archive"
              >
                <Archive size={14} />
              </button>
            )}
            
          </div>
        </div>
        {/* Tabs */}
        {isMobile ? (
          <div className="border-slate-100 flex flex-wrap gap-1 px-1 py-1">
            <select
              value={tab}
              onChange={(e) => setTab(e.target.value as typeof tab)}
              className="w-full px-2 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-display cursor-pointer"
            >
              <option value="overview">Overview</option>
              <option value="attendance">Attendance</option>
              <option value="leave">Leave</option>
              <option value="payroll-history">Payroll History</option>
            </select>
          </div>
        ) : (
          <div className="border-b border-slate-100 flex gap-1 px-6 py-2">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'attendance', label: 'Attendance' },
              { id: 'leave', label: 'Leave' },
              { id: 'payroll-history', label: 'Payroll History' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                className={`px-4 py-2 text-sm font-medium rounded-lg font-display cursor-pointer
                  ${tab === t.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-2">
          {tab === 'overview' && (
              <div className="w-3xl grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Employment Information</p>
                <div className="space-y-3">
                  {[
                    { label: 'Employee ID', value: employee.id },
                    { label: 'Department', value: employee.department },
                    { label: 'Position', value: employee.position },
                    { label: 'Employment Type', value: employee.employmentType },
                    { label: 'Date Hired', value: employee.dateHired },
                  ].map(f => (
                    <div key={f.label} className="flex flex-col gap-0.5">
                      <span className="text-xs text-slate-400 font-display">{f.label}</span>
                      <span className="text-sm font-medium text-slate-700">{f.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Personal Information</p>
                  <div className="space-y-3">
                    {[
                      { label: 'Email', value: employee.email },
                      { label: 'Contact', value: employee.contactNumber },
                      { label: 'Sex', value: employee.sex },
                      { label: 'Address', value: employee.address },
                      { label: 'Date of Birth', value: employee.dateOfBirth },
                    ].map(f => (
                        <div key={f.label} className="flex flex-col gap-0.5">
                          <span className="text-xs text-slate-400 font-display">{f.label}</span>
                          <span className="text-sm font-medium text-slate-700 break-words whitespace-normal max-w-full">{f.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Payroll Information</p>
                  <div className="space-y-3">
                    {[
                      { label: 'Basic Salary', value: fmt(employee.basicSalary) },
                      { label: 'Salary Type', value: employee.salaryType },
                      { label: 'Allowance', value: fmt(employee.allowance) },
                    ].map(f => (
                        <div key={f.label} className="flex flex-col gap-0.5">
                          <span className="text-xs text-slate-400 font-display">{f.label}</span>
                          <span className="text-sm font-medium text-slate-700 break-words whitespace-normal max-w-full">{f.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          {isMobile ? (
            <>
              {tab === 'attendance' && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Recent Attendance</p>
                    <div className="flex flex-col divide-y divide-slate-50">
                      {attendanceRecords.map((r, i) => (
                        <button key={i} onClick={() => setSelectedAttendance(r)} className="text-left p-3 hover:bg-slate-50 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-700 truncate">{r.date}</div>
                            <div className="text-xs text-slate-400 truncate">{r.in || '—'} • {r.out || '—'}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-slate-500">{r.s}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  {selectedAttendance && (
                    <AttendanceDetailModal item={selectedAttendance} onClose={() => setSelectedAttendance(null)} />
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {tab === 'attendance' && (
                <div className="w-3xl">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Recent Attendance</p>
                  <table className="text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {['Date', 'Time In', 'Time Out', 'Late', 'Overtime', 'Status'].map(h => (
                          <th key={h} className="text-left py-2 px-2 text-xs font-semibold text-slate-400 font-display">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { date: 'Aug 11, 2026', in: '8:00 AM', out: '5:00 PM', late: '—', ot: '—', s: 'Present' },
                        { date: 'Aug 10, 2026', in: '8:03 AM', out: '5:00 PM', late: '3 min', ot: '—', s: 'Present' },
                        { date: 'Aug 9, 2026', in: '8:00 AM', out: '6:30 PM', late: '—', ot: '1.5 hrs', s: 'Present' },
                        { date: 'Aug 8, 2026', in: '8:00 AM', out: '5:00 PM', late: '—', ot: '—', s: 'Present' },
                        { date: 'Aug 7, 2026', in: '', out: '', late: '—', ot: '—', s: 'Leave' },
                      ].map((r, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer">
                          <td className="py-2.5 px-2 text-slate-600">{r.date}</td>
                          <td className="py-2.5 px-2 font-mono text-xs">{r.in || '—'}</td>
                          <td className="py-2.5 px-2 font-mono text-xs">{r.out || '—'}</td>
                          <td className="py-2.5 px-2 text-amber-600 text-xs">{r.late}</td>
                          <td className="py-2.5 px-2 text-indigo-600 text-xs">{r.ot}</td>
                          <td className="py-2.5 px-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium font-display
                              ${r.s === 'Present' ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700'}`}>
                              {r.s}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
          {tab === 'leave' && (
            <div className="w-3xl">
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { type: 'Vacation Leave', used: 3, total: 10 },
                  { type: 'Sick Leave', used: 1, total: 10 },
                  { type: 'Emergency Leave', used: 0, total: 3 },
                  { type: 'Bereavement Leave', used: 0, total: 3 },
                ].map(l => (
                  <div key={l.type} className="bg-slate-50 rounded-xl p-3.5">
                    <p className="text-xs font-semibold text-slate-600 font-display mb-2">{l.type}</p>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mb-1.5">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(l.used / l.total) * 100}%` }} />
                    </div>
                    <div className="flex text-xs text-slate-500">
                      <span>Used: <b className="text-slate-700">{l.used}</b> days</span>
                    </div>
                    <div className="flex text-xs text-slate-500">
                      <span>Remaining: <b className="text-slate-700">{l.total - l.used}</b> days</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {isMobile ? (
            <>
              {tab === 'payroll-history' && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Payroll History</p>
                  <div className="flex flex-col divide-y divide-slate-50">
                    {payrollRecords.map((r, i) => (
                      <button key={i} onClick={() => setSelectedPayroll(r)} className="text-left p-3 hover:bg-slate-50 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-700 truncate">{r.p}</div>
                          <div className="text-xs text-slate-400 truncate">{fmt(r.g)} • {fmt(r.n)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-500">{r.s}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                  {selectedPayroll && (
                    <PayrollDetailModal item={selectedPayroll} onClose={() => setSelectedPayroll(null)} />
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {tab === 'payroll-history' && (
                <div className="w-3xl">
                  <table className="text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {['Period', 'Gross Pay', 'Deductions', 'Net Pay', 'Status'].map(h => (
                          <th key={h} className="text-left py-2 px-2 text-xs font-semibold text-slate-400 font-display">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { p: 'Aug 1–15, 2026', g: 23550, d: 1675, n: 21875, s: 'Pending' },
                        { p: 'Jul 16–31, 2026', g: 23550, d: 1675, n: 21875, s: 'Finalized' },
                        { p: 'Jul 1–15, 2026', g: 22800, d: 1675, n: 21125, s: 'Finalized' },
                        { p: 'Jun 16–30, 2026', g: 22800, d: 1675, n: 21125, s: 'Finalized' },
                      ].map((r, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="py-2.5 px-2 text-slate-600">{r.p}</td>
                          <td className="py-2.5 px-2 font-mono text-xs text-slate-700">{fmt(r.g)}</td>
                          <td className="py-2.5 px-2 font-mono text-xs text-red-600">{fmt(r.d)}</td>
                          <td className="py-2.5 px-2 font-mono text-xs font-semibold text-emerald-700">{fmt(r.n)}</td>
                          <td className="py-2.5 px-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium font-display
                              ${r.s === 'Finalized' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {r.s}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
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

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const pageData = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-display">Employees</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage employee information and payroll details</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg font-display"
        >
          <Plus size={16} /> Add Employee
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 flex flex-wrap gap-3 shadow-sm">
        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 flex-1 min-w-48 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search employee..."
            className="bg-transparent text-sm outline-none text-slate-700 w-full placeholder:text-slate-400"
          />
        </div>
        {[
          { label: 'Department', value: dept, set: setDept, opts: ['Chefs & Cooks', 'Waiters', 'Cashiers', 'Management'] },
          { label: 'Employment Type', value: type, set: setType, opts: ['Full-Time', 'Part-Time', 'Contractual'] },
          { label: 'Status', value: status, set: setStatus, opts: ['Active', 'Inactive', 'On Leave'] },
        ].map(f => (
          <select
            key={f.label}
            value={f.value}
            onChange={e => { f.set(e.target.value); setPage(1) }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 font-display"
          >
            <option value="">{f.label}: All</option>
            {f.opts.map(o => <option key={o}>{o}</option>)}
          </select>
        ))}
      </div>

      {/* Table / Mobile list */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {!isMobile ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Employee ID', 'Employee', 'Department', 'Position', 'Employment Type', 'Basic Salary', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pageData.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-50 group">
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{emp.id}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                          <span className="text-indigo-700 text-xs font-bold font-display">{emp.firstName[0]}{emp.lastName[0]}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700 font-display">{emp.firstName} {emp.lastName}</p>
                          <p className="text-xs text-slate-400">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">{emp.department}</td>
                    <td className="py-3 px-4 text-sm text-slate-600">{emp.position}</td>
                    <td className="py-3 px-4"><TypeBadge type={emp.employmentType} /></td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700">{fmt(emp.basicSalary)}</td>
                    <td className="py-3 px-4"><StatusBadge status={emp.status} /></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setViewEmployee(emp)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer" title="View">
                          <Eye size={14} />
                        </button>
                        <button onClick={() => setArchiveConfirm(emp)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer" title="Archive">
                          <Archive size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col">
              {pageData.map(emp => (
                <button key={emp.id} onClick={() => setViewEmployee(emp)} className="text-left p-3 border-b border-slate-50 hover:bg-slate-50 flex items-center gap-3 cursor-pointer">
                  <div className="w-10">
                    <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center">
                      <span className="text-indigo-700 text-xs font-bold font-display">{emp.firstName[0]}{emp.lastName[0]}</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="truncate">
                        <div className="text-sm font-medium text-slate-700">{emp.firstName} {emp.lastName}</div>
                        <div className="text-xs text-slate-400">{emp.position} • {emp.department}</div>
                      </div>
                      <div className="text-xs text-slate-500">{fmt(emp.basicSalary)}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length} employees
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer">
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i + 1}
                onClick={() => setPage(i + 1)}
                className={`w-7 h-7 rounded-lg text-xs font-medium font-display cursor-pointer
                  ${page === i + 1 ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                {i + 1}
              </button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Archive Confirm */}
      {archiveConfirm && (
        <Modal open={true} title="Archive Employee?" onClose={() => setArchiveConfirm(null)}>
          <div className="bg-white w-full p-3">
            <h3 className="text-lg font-bold text-slate-800 font-display mb-2">Archive Employee?</h3>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to archive <strong>{archiveConfirm.firstName} {archiveConfirm.lastName}</strong>? They will be marked as inactive.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setArchiveConfirm(null)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display cursor-pointer">
                Cancel
              </button>
              <button onClick={() => {
                showToast({ type: 'success', message: 'Employee archived', description: `${archiveConfirm.firstName} ${archiveConfirm.lastName} has been archived.` })
                setArchiveConfirm(null)
              }} className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg font-display cursor-pointer">
                Archive
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showAdd && (
        <AddEmployeeModal
          onClose={() => setShowAdd(false)}
          onSave={() => {
            setShowAdd(false)
            showToast({ type: 'success', message: 'Employee saved', description: 'New employee has been added successfully.' })
          }}
        />
      )}

      {viewEmployee && (
        <EmployeeProfileModal
          employee={viewEmployee}
          onClose={() => setViewEmployee(null)}
          onArchive={e => {
            setViewEmployee(null)
            setArchiveConfirm(e)
          }}
        />
      )}
    </div>
  )
}
