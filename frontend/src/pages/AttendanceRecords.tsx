import { useState, useEffect } from 'react'
import { Search, Upload, Eye, Edit2, ChevronLeft, ChevronRight, X, AlertCircle } from 'lucide-react'
import { attendanceRecords as allRecords } from '../data/mockData'
import type { AttendanceRecord } from '../types'
import { useApp } from '../App'
import useIsMobile from '../hooks/isMobile'
import Modal from '../components/Modal'

type Status = AttendanceRecord['status']

const statusColor: Record<Status, string> = {
  Present: 'bg-emerald-100 text-emerald-700',
  Absent: 'bg-red-100 text-red-700',
  Leave: 'bg-violet-100 text-violet-700',
  'Rest Day': 'bg-slate-100 text-slate-500',
  Holiday: 'bg-blue-100 text-blue-700',
  Incomplete: 'bg-amber-100 text-amber-700',
  Overtime: 'bg-blue-100 text-blue-700',
}

// EditAttendanceModal removed — edit UI is rendered inside the detail modal now

export default function AttendanceRecords() {
  const { navigate, showToast } = useApp()
  const isMobile = useIsMobile()
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null)
  const [search, setSearch] = useState('')
  const [dept, setDept] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [period, setPeriod] = useState('August 1–15, 2026')
  const [page, setPage] = useState(1)
  const [isEditing, setIsEditing] = useState(false)
  // edit form state
  const [timeIn, setTimeIn] = useState<string | undefined>(undefined)
  const [timeOut, setTimeOut] = useState<string | undefined>(undefined)
  const [editStatus, setEditStatus] = useState<Status | undefined>(undefined)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (selectedRecord && isEditing) {
      setTimeIn(selectedRecord.timeIn)
      setTimeOut(selectedRecord.timeOut)
      setEditStatus(selectedRecord.status)
      setNotes('')
    }
  }, [selectedRecord, isEditing])
  const PER_PAGE = 8

  const filtered = allRecords.filter(r => {
    const q = search.toLowerCase()
    const matchQ = !q || r.employeeName.toLowerCase().includes(q) || r.employeeId.toLowerCase().includes(q)
    const matchDept = !dept || r.department === dept
    const matchStatus = !statusFilter || r.status === statusFilter
    return matchQ && matchDept && matchStatus
  })

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const pageData = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <div className="p-4">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-display">Attendance Records</h2>
          <p className="text-sm text-slate-500 mt-0.5">View and manage imported attendance data</p>
        </div>
         {isMobile ? (
          <>
          <button
          onClick={() => navigate('import-attendance')}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg font-display"
        >
          <Upload size={16} />
        </button>
          </>
         ) : ( 
          <>
          <button
          onClick={() => navigate('import-attendance')}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg font-display"
        >
          <Upload size={16} /> Import Attendance
        </button>
          </>
         )}
      </div>
      {isMobile ? (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 flex flex-wrap gap-3 shadow-sm">
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 flex-1 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search employee..." className="bg-transparent text-sm outline-none text-slate-700 w-full placeholder:text-slate-400" />
          </div>
          <div className="w-full">
            <select value={period} onChange={e => setPeriod(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white outline-none focus:border-indigo-400 font-display">
              <option>August 1–15, 2026</option>
              <option>July 16–31, 2026</option>
              <option>July 1–15, 2026</option>
            </select>
          </div>
          <div className="w-full">
            <select value={dept} onChange={e => { setDept(e.target.value); setPage(1) }} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white outline-none focus:border-indigo-400 font-display">
              <option value="">Department: All</option>
              {['Cooks & Chef', 'Waiters', 'Cashiers', 'Management'].map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="w-full">
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white outline-none focus:border-indigo-400 font-display">
              <option value="">Status: All</option>
              {['Present', 'Absent', 'Leave', 'Rest Day', 'Holiday', 'Incomplete'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 flex flex-wrap gap-3 shadow-sm">
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 flex-1 min-w-48 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search employee..." className="bg-transparent text-sm outline-none text-slate-700 w-full placeholder:text-slate-400" />
          </div>
          <select value={period} onChange={e => setPeriod(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white outline-none focus:border-indigo-400 font-display">
            <option>August 1–15, 2026</option>
            <option>July 16–31, 2026</option>
            <option>July 1–15, 2026</option>
          </select>
          <select value={dept} onChange={e => { setDept(e.target.value); setPage(1) }} className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white outline-none focus:border-indigo-400 font-display">
            <option value="">Department: All</option>
            {['Cooks & Chef', 'Waiters', 'Cashiers', 'Management'].map(d => <option key={d}>{d}</option>)}
          </select>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white outline-none focus:border-indigo-400 font-display">
            <option value="">Status: All</option>
            {['Present', 'Absent', 'Leave', 'Rest Day', 'Holiday', 'Incomplete'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      )}

      {/* Table / Mobile list */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto w-full">
          {!isMobile ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Employee', 'Employee ID', 'Date', 'Day', 'Status', 'Time In', 'Time Out', 'Time In', 'Time Out'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pageData.map(rec => (
                  <tr key={rec.id} onClick={() => setSelectedRecord(rec)} className={`hover:bg-slate-50 ${rec.status === 'Incomplete' ? 'bg-amber-50/50' : ''} cursor-pointer`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                          <span className="text-indigo-700 text-[10px] font-bold font-display">
                            {rec.employeeName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-slate-700 font-display whitespace-nowrap">{rec.employeeName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4"><span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{rec.employeeId}</span></td>
                    <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap">{rec.date}</td>
                    <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap">{rec.day || '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium font-display ${statusColor[rec.status]}`}>{rec.status}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">{rec.firstOnDuty ?? rec.timeIn ?? '—'}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">{rec.firstOffDuty ?? rec.timeOut ?? '—'}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">{rec.overtimeCheckIn ?? '—'}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">{rec.overtimeCheckOut ?? '—'}</td>
                    {/* Actions moved into row-click detail modal */}
                    <td className="py-3 px-4" />
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col">
              {pageData.map(rec => (
                <button
                  key={rec.id}
                  onClick={() => setSelectedRecord(rec)}
                  className="text-left p-3 border-b border-slate-50 hover:bg-slate-50 flex items-center gap-3"
                >
                  <div className="w-10">
                    <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center">
                      <span className="text-indigo-700 text-xs font-bold font-display">{rec.employeeName.split(' ').map(n => n[0]).join('').slice(0,2)}</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4">
                      {/* Employee Info */}
                      <div className="min-w-0 truncate">
                        <div className="text-sm font-medium text-slate-700 truncate">
                          {rec.employeeName}
                        </div>
                        <div className="text-xs text-slate-400">
                          {rec.date}
                        </div>
                      </div>

                      {/* Time In / Time Out */}
                      <div className="shrink-0 text-right">
                        <div className="text-xs text-slate-500">
                          <span className="text-slate-400">First In:</span> {rec.firstOnDuty ?? rec.timeIn ?? '—'}
                        </div>
                        <div className="text-xs text-slate-500">
                          <span className="text-slate-400">First Out:</span> {rec.firstOffDuty ?? rec.timeOut ?? '—'}
                        </div>
                        <div className="text-xs text-slate-500">
                          <span className="text-slate-400">OT:</span> {rec.overtimeCheckIn ?? '—'} / {rec.overtimeCheckOut ?? '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        {filtered.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-slate-400 text-sm font-display">No attendance records found.</p>
            <button onClick={() => navigate('import-attendance')} className="mt-3 text-sm text-indigo-600 hover:underline font-display">Import Attendance</button>
          </div>
        )}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 md:static sticky bottom-0 z-10 bg-white">
          <p className="text-xs text-slate-500">Showing {Math.min((page - 1) * PER_PAGE + 1, filtered.length)}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length} records</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40"><ChevronLeft size={16} /></button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
              <button key={i + 1} onClick={() => setPage(i + 1)}
                className={`w-7 h-7 rounded-lg text-xs font-medium font-display ${page === i + 1 ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{i + 1}</button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>



      {selectedRecord && (
        <Modal
          open={!!selectedRecord}
          title={`Attendance`}
          onClose={() => { setSelectedRecord(null); setIsEditing(false) }}
        >
              <div className="flex items-start justify-between border-b pb-2 border-slate-100">
                <div className="w-md">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 font-display">
                    Employee
                  </p>
                  <h3 className="text-lg font-bold text-slate-800 font-display">
                    {selectedRecord.employeeName}
                  </h3>
                </div>
                <div className="w-md text-right">
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium font-display ${statusColor[selectedRecord.status]}`}
                  >
                    {selectedRecord.status}
                  </span>
                </div>
              </div>

              {!isEditing ? (
                <>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1 font-display">
                      Employee ID
                    </label>
                    <p className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-700">
                      {selectedRecord.employeeId}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1 font-display">
                      Date
                    </label>
                    <p className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-700">
                      {selectedRecord.date}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1 font-display">
                      Time In
                    </label>
                    <p className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-700">
                      {selectedRecord.timeIn || '—'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1 font-display">
                      Time Out
                    </label>
                    <p className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-700">
                      {selectedRecord.timeOut || '—'}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-xs text-slate-400 font-display">Late</p>
                    <p className="text-sm font-bold font-mono text-amber-600">
                      {selectedRecord.lateMinutes > 0 ? `${selectedRecord.lateMinutes} min` : '—'}
                    </p>
                  </div>

                  <div className="text-center">
                    <p className="text-xs text-slate-400 font-display">Undertime</p>
                    <p className="text-sm font-bold font-mono text-orange-600">
                      {selectedRecord.undertimeMinutes > 0 ? `${selectedRecord.undertimeMinutes} min` : '—'}
                    </p>
                  </div>

                  <div className="text-center">
                    <p className="text-xs text-slate-400 font-display">Overtime</p>
                    <p className="text-sm font-bold font-mono text-blue-600">
                      {selectedRecord.overtimeHours > 0 ? `${selectedRecord.overtimeHours} hr` : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 text-sm font-medium bg-green-700 hover:bg-green-600 text-slate-100 rounded-lg font-display"
                  >
                    Edit
                  </button>
                </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Employee</label>
                      <input value={selectedRecord.employeeId} readOnly className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Date</label>
                      <input value={selectedRecord.date} readOnly className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Time In</label>
                      <input value={timeIn ?? ''} onChange={e => setTimeIn(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Time Out</label>
                      <input value={timeOut ?? ''} onChange={e => setTimeOut(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Status</label>
                      <select value={editStatus} onChange={e => setEditStatus(e.target.value as Status)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 font-display">
                        {(['Present', 'Absent', 'Leave', 'Rest Day', 'Holiday', 'Incomplete'] as Status[]).map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Notes</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional notes about this correction..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none" />
                  </div>

                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <AlertCircle size={14} className="text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-700">Attendance changes may affect payroll calculations.</p>
                  </div>

                  <div className="py-2 border-t border-slate-100 flex gap-3 justify-end">
                    <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
                    <button onClick={() => {
                      setIsEditing(false)
                      setSelectedRecord(null)
                      showToast({ type: 'success', message: 'Attendance updated', description: 'Attendance record has been corrected successfully.' })
                    }} className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display">Save Changes</button>
                  </div>
                </div>
              )}
        </Modal>
      )}
    </div>
  )
}
