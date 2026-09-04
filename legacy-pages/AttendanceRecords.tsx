 'use client'
import { useCallback, useState, useEffect } from 'react'
import { Search, Upload, Eye, Edit2, ChevronLeft, ChevronRight, X, AlertCircle } from 'lucide-react'
import type { AttendanceRecord } from '../types'
import { useApp } from '../App'
import useIsMobile from '../hooks/isMobile'
import Modal from '../components/Modal'
import { TimePicker } from '../components/TimePicker'

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
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // edit form state
  const [timeIn, setTimeIn] = useState<string | undefined>(undefined)
  const [timeOut, setTimeOut] = useState<string | undefined>(undefined)
  const [editStatus, setEditStatus] = useState<Status | undefined>(undefined)
  const [notes, setNotes] = useState('')
  // computed values
  const [lateMinutes, setLateMinutes] = useState<number>(0)
  const [undertimeMinutes, setUndertimeMinutes] = useState<number>(0)
  const [overtimeMinutes, setOvertimeMinutes] = useState<number>(0)
  // attendance settings for calculations
  const [attSettings, setAttSettings] = useState<{ start_time?: string; end_time?: string; grace_period?: number }>({})

  useEffect(() => {
    if (selectedRecord && isEditing) {
      setTimeIn(selectedRecord.firstOnDuty ?? timeTo24h(selectedRecord.timeIn))
      setTimeOut(selectedRecord.firstOffDuty ?? timeTo24h(selectedRecord.timeOut))
      setEditStatus(selectedRecord.status)
      setNotes('')
    }
  }, [selectedRecord, isEditing])
  const PER_PAGE = 10

  // Fetch attendance settings for calculations
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/settings/attendance')
        if (res.ok) {
          const data = await res.json()
          if (mounted) setAttSettings(data)
        }
      } catch {
        // ignore
      }
    })()
    return () => { mounted = false }
  }, [])

  const timeToMinutes = (t: string | undefined): number | null => {
    if (!t) return null
    const [h, m] = t.split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) return null
    return h * 60 + m
  }

  const recalcAttendance = (tIn: string | undefined, tOut: string | undefined) => {
    const startStr = attSettings.start_time || ''
    const endStr = attSettings.end_time || ''
    const grace = Number(attSettings.grace_period) || 0
    const graceMinutes = Math.floor(grace / 60)

    const inMin = timeToMinutes(tIn)
    const outMin = timeToMinutes(tOut)
    const startMin = timeToMinutes(startStr)
    const endMin = timeToMinutes(endStr)

    // late_minutes
    let late = 0
    if (inMin != null && startMin != null) {
      const rawDiff = inMin - startMin
      if (rawDiff > 0 && rawDiff > graceMinutes) late = rawDiff
    }
    setLateMinutes(late)

    // undertime / overtime
    let undertime = 0
    let overtime = 0
    if (outMin != null && endMin != null) {
      let to = outMin
      if (startMin != null && to < startMin) to += 24 * 60 // overnight
      const diff = to - endMin
      if (diff > 0) setOvertimeMinutes(diff)
      else if (diff < 0) setUndertimeMinutes(-diff)
      else {
      setOvertimeMinutes(0);
      setUndertimeMinutes(0);
    }
    } else {
      setOvertimeMinutes(0);
      setUndertimeMinutes(0);
    }
  }

  const handleTimeInChange = (val: string) => {
    const norm = timeTo24h(val) || val
    setTimeIn(norm)
    recalcAttendance(norm, timeOut)
  }

  const handleTimeOutChange = (val: string) => {
    const norm = timeTo24h(val) || val
    setTimeOut(norm)
    recalcAttendance(timeIn, norm)
  }

  const timeTo24h = (t: string) => {
    if (!t) return ''
    // parse "H:MM AM/PM" or "HH:MM AM/PM" or already "HH:MM"
    if (t.includes('AM') || t.includes('PM')) {
      const [time, period] = t.split(' ')
      const [h, m] = time.split(':').map(Number)
      let hh = h % 12
      if (period.toUpperCase() === 'PM') hh += 12
      return `${String(hh).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }
    return t
  }

  function minutesToHHMM(mins?: number | null) {
    const total = Math.max(0, Number(mins) || 0)
    const h = Math.floor(total / 60)
    const m = total % 60
    const hh = String(h).padStart(2, '0')
    const mm = String(m).padStart(2, '0')
    return `${hh}:${mm}`
  }

  const loadAttendance = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const aRes = await fetch('/api/attendance')
      if (!aRes.ok) throw new Error('Failed to fetch attendance')
      const aJson = await aRes.json()
      const att: any[] = aJson.attendance || []

      // fetch employees to map names and source ids
      const eRes = await fetch('/api/employees')
      const eJson = eRes.ok ? await eRes.json() : { employees: [] }
      const emap = new Map<number, any>()
      for (const e of (eJson.employees || [])) emap.set(Number(e.id ?? e.employee_id), e)

      const parseDateOnly = (value: string | null | undefined) => {
        if (!value) return null
        const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
        if (!match) return null
        const [_, year, month, day] = match
        return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
      }

      const mapped = att.map(row => {
        const emp = emap.get(Number(row.employee_id)) || null
        const workDate = row.work_date
        const dt = parseDateOnly(workDate)

        const formatTime = (t: any) => {
          if (!t) return null
          // expect HH:MM or H:MM
          const parts = String(t).split(':')
          if (parts.length < 2) return String(t)
          let hh = Number(parts[0])
          const mm = Number(parts[1]) || 0
          const ampm = hh >= 12 ? 'PM' : 'AM'
          if (hh === 0) hh = 12
          if (hh > 12) hh = hh - 12
          return `${hh}:${String(mm).padStart(2,'0')} ${ampm}`
        }

        const dateStr = dt ? dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : (row.work_date || '')
        const dayStr = dt ? dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).toUpperCase() : ''

        const firstOn = row.first_on_duty ?? null
        const firstOff = row.first_off_duty ?? null

        const status = row.is_absent ? 'Absent' : (row.total_minutes === 0 ? 'Incomplete' : 'Present')

        return {
          id: String(row.attendance_id ?? row.id ?? ''),
          employeeId: emp ? String(emp.source_employee_id ?? emp.employee_id ?? '') : String(row.employee_id ?? ''),
          employeeName: emp ? String(emp.name ?? '') : String(row.employee_id ?? ''),
          department: emp ? String(emp.department ?? '') : '',
          date: dateStr,
          day: dayStr,
          timeIn: firstOn ? formatTime(firstOn) : (row.time_in ?? ''),
          timeOut: firstOff ? formatTime(firstOff) : (row.time_out ?? ''),
          firstOnDuty: firstOn,
          firstOffDuty: firstOff,
          secondOnDuty: row.second_on_duty ?? null,
          secondOffDuty: row.second_off_duty ?? null,
          overtimeCheckIn: row.overtime_check_in ?? null,
          overtimeCheckOut: row.overtime_check_out ?? null,
          lateMinutes: Number(row.late_minutes ?? 0) || 0,
          undertimeMinutes: Number(row.leave_early_minutes ?? 0) || 0,
          overtimeHours: Number(row.overtime_hours ?? 0) || 0,
          overtimeMinutes: Number(row.overtime_minutes ?? 0) || 0,
          status: status as any,
        } as AttendanceRecord
      })

      setRecords(mapped)
    } catch (err: any) {
      console.error('Attendance load error', err)
      setError(err.message || 'Failed to load attendance')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (mounted) await loadAttendance()
    })()
    return () => { mounted = false }
  }, [loadAttendance])

  const filtered = records.filter(r => {
    const q = search.toLowerCase()
    const matchQ = !q || r.employeeName.toLowerCase().includes(q) || r.employeeId.toLowerCase().includes(q)
    const matchDept = !dept || r.department === dept
    const matchStatus = !statusFilter || r.status === statusFilter
    return matchQ && matchDept && matchStatus
  })

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const pageData = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const emptyRowsCount = Math.max(0, PER_PAGE - pageData.length);

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
          {loading && (
            <div className="py-16 text-center">
              <p className="text-slate-400 text-sm font-display">Loading attendance...</p>
            </div>
          )}
          {error && !loading && (
            <div className="py-16 text-center">
              <p className="text-red-500 text-sm font-display">{error}</p>
              <button onClick={() => navigate('import-attendance')} className="mt-3 text-sm text-indigo-600 hover:underline font-display">Import Attendance</button>
            </div>
          )}
          {!loading && !error && (
            <>
              {!isMobile ? (
              <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Employee', 'Employee ID', 'Date', 'Day', 'Status', 'Time In', 'Time Out'].map(h => (
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
                    {/* Actions moved into row-click detail modal */}
                    <td className="py-3 px-4" />
                  </tr>
                ))}
                {Array.from({ length: emptyRowsCount }).map((_, i) => (
                  <tr key={`empty-${i}`} className="invisible">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 shrink-0" />
                        <span className="text-sm font-medium font-display">placeholder</span>
                      </div>
                    </td>
                    <td className="py-3 px-4"><span className="font-mono text-xs px-2 py-0.5 rounded">000</span></td>
                    <td className="py-3 px-4 text-sm whitespace-nowrap">00/00</td>
                    <td className="py-3 px-4 text-sm whitespace-nowrap">Day</td>
                    <td className="py-3 px-4"><span className="text-xs px-2 py-0.5 rounded-full font-medium font-display">Status</span></td>
                    <td className="py-3 px-4 font-mono text-xs whitespace-nowrap">00:00</td>
                    <td className="py-3 px-4 font-mono text-xs whitespace-nowrap">00:00</td>
                    <td className="py-3 px-4 font-mono text-xs whitespace-nowrap">00:00</td>
                    <td className="py-3 px-4 font-mono text-xs whitespace-nowrap">00:00</td>
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
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              {Array.from({ length: emptyRowsCount }).map((_, i) => (
                <div key={`empty-mobile-${i}`} className="invisible p-3 border-b border-slate-50 flex items-center gap-3">
                  <div className="w-10">
                    <div className="w-9 h-9 rounded-full bg-indigo-100" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">placeholder</div>
                    <div className="text-xs">00/00/0000</div>
                  </div>
                </div>
              ))}
            </div>
              )}
            </>
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
            {Array.from({ length: totalPages }, (_, i) => {
              const p = i + 1
              const show = p === 1 || p === totalPages || Math.abs(p - page) <= 2
              if (!show) {
                return (i === 1 || i === totalPages - 2) ? <span key={p} className="px-1 text-slate-400">…</span> : null
              }
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-7 h-7 rounded-lg text-xs font-medium font-display ${page === p ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{p}</button>
              )
            })}
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
                      {minutesToHHMM(selectedRecord.lateMinutes)}
                    </p>
                  </div>

                  <div className="text-center">
                    <p className="text-xs text-slate-400 font-display">Undertime</p>
                    <p className="text-sm font-bold font-mono text-orange-600">
                      {minutesToHHMM(selectedRecord.undertimeMinutes)}
                    </p>
                  </div>

                  <div className="text-center">
                    <p className="text-xs text-slate-400 font-display">Overtime</p>
                    <p className="text-sm font-bold font-mono text-blue-600">
                      {minutesToHHMM(selectedRecord.overtimeMinutes)}
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
                      <input value={selectedRecord.employeeId} readOnly className="w-full border border-slate-200 bg-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 outline-none cursor-default caret-transparent" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Date</label>
                      <input value={selectedRecord.date} readOnly className="w-full border border-slate-200 bg-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 outline-none cursor-default caret-transparent" />
                    </div>
                    <div>
                      <TimePicker
                        key={timeIn}
                        value={timeIn ?? ''}
                        onChange={handleTimeInChange}
                        label="Time In"
                      />
                    </div>
                    <div>
                      <TimePicker
                        key={timeOut}
                        value={timeOut ?? ''}
                        onChange={handleTimeOutChange}
                        label="Time Out"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Status</label>
                      <select value={editStatus} onChange={e => setEditStatus(e.target.value as Status)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 font-display">
                        {(['Present', 'Absent', 'Leave', 'Rest Day', 'Holiday', 'Incomplete'] as Status[]).map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <p className="text-xs text-slate-400 font-display">Late</p>
                      <p className="text-sm font-bold font-mono text-amber-600">
                          {minutesToHHMM(lateMinutes)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-400 font-display">Undertime</p>
                      <p className="text-sm font-bold font-mono text-orange-600">
                          {minutesToHHMM(undertimeMinutes)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-400 font-display">Overtime</p>
                      <p className="text-sm font-bold font-mono text-blue-600">
                          {minutesToHHMM(overtimeMinutes)}
                      </p>
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
                      <button onClick={async () => {
                        if (!selectedRecord) return
                        try {
                          const res = await fetch(`/api/attendance/${selectedRecord.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              firstOnDuty: timeIn,
                              firstOffDuty: timeOut,
                              status: editStatus,
                              late_minutes: lateMinutes,
                              leave_early_minutes: undertimeMinutes,
                              overtime_minutes: overtimeMinutes,
                            }),
                          })
                          if (!res.ok) {
                            const err = await res.json()
                            throw new Error(err.error || 'Failed to update attendance')
                          }
                          showToast({ type: 'success', message: 'Attendance updated', description: 'Attendance record has been corrected successfully.' })
                          await loadAttendance()
                        } catch (err: any) {
                          showToast({ type: 'error', message: 'Update failed', description: err.message || 'Could not update attendance' })
                        } finally {
                          setIsEditing(false)
                          setSelectedRecord(null)
                        }
                      }} className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display">Save Changes</button>
                    </div>
                </div>
              )}
        </Modal>
      )}
    </div>
  )
}
