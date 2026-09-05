'use client'
import { useEffect, useRef, useState } from 'react'
import { Plus, Edit2, Trash2, Eye, EyeOff } from 'lucide-react'
import { useApp } from '../App'
import useIsMobile from '../hooks/isMobile'
import Modal from '../components/Modal'
import { TimePicker } from '../components/TimePicker'

type Tab = 'payroll' | 'attendance' | 'holidays' | 'users'

const tabLabels: { id: Tab; label: string }[] = [
  { id: 'payroll', label: 'Payroll' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'holidays', label: 'Holidays' },
  { id: 'users', label: 'Users & Roles' },
]

const earningsTypes = ['Basic Salary', 'Overtime', 'Holiday Pay', 'Night Differential', 'Allowance', 'Bonus', 'Commission']
const deductionTypes = ['SSS', 'PhilHealth', 'Pag-IBIG', 'Withholding Tax', 'Late', 'Undertime', 'Absence', 'Other']

// holidayList is loaded from backend


const roleColor: Record<string, string> = {
  'Super Admin': 'bg-indigo-300 text-indigo-700',
  'Admin': 'bg-blue-300 text-blue-700',
  'Staff': 'bg-violet-300 text-violet-700',
}

const holidayTypeColor: Record<string, string> = {
  'Regular Holiday': 'bg-red-100 text-red-700',
  'Special Non-Working Holiday': 'bg-amber-100 text-amber-700',
  'Company Holiday': 'bg-blue-100 text-blue-700',
}

export default function SettingsPage() {
  const { showToast } = useApp()
  const isMobile = useIsMobile()
  const [showNewUserPassword, setShowNewUserPassword] = useState(false)
  const [holidayList, setHolidayList] = useState<any[]>([])
  const [userList, setUserList] = useState<any[]>([])
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/users')
        if (!res.ok) return
        const body = await res.json()
        if (!mounted) return
        // API returns array of users: { user_id, name, email, role }
        const mapped = (body || []).map((u: any) => ({
          name: u.name || u.full_name || '',
          email: u.email,
          username: u.username,
          restaurant: u.restaurant || 'Both',
          // map DB role values like 'SuperAdmin' to UI label 'Super Admin'
          role: u.role === 'SuperAdmin' ? 'Super Admin' : u.role === 'Admin' ? 'Admin' : u.role,
          status: 'Active',
        }))
        if (mapped.length) setUserList(mapped)
      } catch (err) {
        console.error('Failed to load users', err)
      }
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/settings/holidays')
        if (!res.ok) return
        const body = await res.json()
        if (!mounted) return
        const mapped = (body || []).map((h: any) => ({
          id: h.id,
          date: new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          holiday: h.holiday_name || h.holiday || '',
          type: (h.type === 'SPECIAL' || h.type === 'SPECIAL_NON_WORKING') ? 'Special Non-Working Holiday' : h.type === 'COMPANY' ? 'Company Holiday' : 'Regular Holiday',
          status: h.active ? 'Active' : 'Inactive',
          raw: h,
        }))
        setHolidayList(mapped)
      } catch (err) {
        console.error('Failed to load holidays', err)
      }
    })()
    return () => { mounted = false }
  }, [])
  // load attendance settings from backend and map to UI shape
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/settings/attendance')
        if (!res.ok) return
        const body = await res.json()
        if (!mounted) return
        // body may contain: grace_period, required_daily_hours, break_duration, overtime_threshold, start_time, end_time, half_day
        const mapped = {
          gracePeriod: body && typeof body.grace_period === 'number' ? String(Math.round(body.grace_period / 60)) : defaultAttendanceSettings.gracePeriod,
          requiredDailyHours: body && (body.required_daily_hours != null) ? String(body.required_daily_hours) : defaultAttendanceSettings.requiredDailyHours,
          breakDuration: body && typeof body.break_duration === 'number' ? String(Math.round(body.break_duration / 60)) : defaultAttendanceSettings.breakDuration,
          overtimeThreshold: body && typeof body.overtime_threshold === 'number' ? String(body.overtime_threshold / 3600) : defaultAttendanceSettings.overtimeThreshold,
          startTime: body?.start_time ?? defaultAttendanceSettings.startTime,
          endTime: body?.end_time ?? defaultAttendanceSettings.endTime,
          halfDay: normalizeToTimeString(body?.half_day),
        }
        setAttendanceSettings(mapped)
        setOriginalAttendanceSettings(mapped)
      } catch (err) {
        console.error('Failed to load attendance settings', err)
      }
    })()
    return () => { mounted = false }
  }, [])

  // load payroll settings from backend and map to UI shape
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/settings/payroll')
        if (!res.ok) return
        const body = await res.json()
        if (!mounted) return
        const mapped = {
          undertimeDeduction: body && (body.undertime_deduction != null) ? String(body.undertime_deduction) : defaultPayrollSettings.undertimeDeduction,
          undertimeDeductionRateType: body?.undertime_deduction_rate_type === 'Minute' ? 'Minute' : 'Hour',
          undertimeDeductionRate: body && (body.undertime_deduction_rate != null) ? String(body.undertime_deduction_rate) : defaultPayrollSettings.undertimeDeductionRate,
          specialMonthPay: body && body.special_month_pay ? String(body.special_month_pay).slice(0, 10) : '',
        }
        setPayrollSettings(mapped)
        setOriginalPayrollSettings(mapped)
      } catch (err) {
        console.error('Failed to load payroll settings', err)
      }
    })()
    return () => { mounted = false }
  }, [])
  const [earningsTypesList, setEarningsTypesList] = useState(earningsTypes)
  const [deductionTypesList, setDeductionTypesList] = useState(deductionTypes)
  const [selectedHoliday, setSelectedHoliday] = useState<any | null>(null)
  const [selectedUser, setSelectedUser] = useState<any | null>(null)
  const [editingHoliday, setEditingHoliday] = useState<{ index: number; item: any } | null>(null)
  const [editingUser, setEditingUser] = useState<{ index: number; item: any } | null>(null)
  const [showConfirmSave, setShowConfirmSave] = useState(false)
  const [addUserOpen, setAddUserOpen] = useState(false)
  const [newUser, setNewUser] = useState<{ username: string; name: string; email: string; password: string; role: string; status: string; restaurant: string }>({ username: '', name: '', email: '', password: '', role: 'Staff', status: 'Active', restaurant: 'Both' })
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'holiday' | 'user'; index: number; item: any } | null>(null)
  const [deleteSalaryTarget, setDeleteSalaryTarget] = useState<{ kind: 'earning' | 'deduction'; key: string } | null>(null)
  const [tab, setTab] = useState<Tab>('payroll')
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false)

  const defaultPayrollSettings = {
    undertimeDeduction: '0',
    undertimeDeductionRateType: 'Hour',
    undertimeDeductionRate: '1',
    specialMonthPay: '',
  }

  const defaultAttendanceSettings = {
    gracePeriod: '5',
    requiredDailyHours: '8',
    breakDuration: '60',
    overtimeThreshold: '8',
    startTime: '08:00',
    endTime: '17:00',
    halfDay: '12:00',
  }

  const [payrollSettings, setPayrollSettings] = useState(defaultPayrollSettings)
  const [originalPayrollSettings, setOriginalPayrollSettings] = useState(defaultPayrollSettings)
  const [attendanceSettings, setAttendanceSettings] = useState(defaultAttendanceSettings)
  const [originalAttendanceSettings, setOriginalAttendanceSettings] = useState(defaultAttendanceSettings)

  const defaultEarningsAmounts: Record<string, number> = {
    'Basic Salary': 15000,
    'Overtime': 1000,
    'Holiday Pay': 3500,
    'Night Differential': 500,
    'Allowance': 2000,
    'Bonus': 0,
    'Commission': 0,
  }

  const [earningsAmounts, setEarningsAmounts] = useState<Record<string, number>>(defaultEarningsAmounts)

  const defaultDeductionAmounts: Record<string, number> = {
    SSS: 500,
    PhilHealth: 150,
    'Pag-IBIG': 100,
    'Withholding Tax': 1200,
    Late: 0,
    Undertime: 0,
    Absence: 0,
    Loan: 0,
    Other: 0,
  }

  const [deductionAmounts, setDeductionAmounts] = useState<Record<string, number>>(defaultDeductionAmounts)

  const [editingAmount, setEditingAmount] = useState<{ kind: 'earning' | 'deduction'; key: string; value: number } | null>(null)

  const formatCurrency = (n: number) => `Php ${Math.round(n).toLocaleString()}`

  const calculateRequiredHours = (startTime: string, endTime: string): string => {
    if (!startTime || !endTime) return '0'
    const [startH, startM] = startTime.split(':').map(Number)
    const [endH, endM] = endTime.split(':').map(Number)
    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM
    let diffMinutes = endMinutes - startMinutes
    if (diffMinutes < 0) diffMinutes += 24 * 60 // handle overnight shifts
    const breakMinutes = Number(attendanceSettings.breakDuration) || 60
    const workMinutes = Math.max(0, diffMinutes - breakMinutes)
    return String((workMinutes / 60).toFixed(2))
  }

  const formatTime12h = (time24: string) => {
    if (!time24) return ''
    const [h, m] = time24.split(':').map(Number)
    const hour = h % 12 || 12
    const ampm = h >= 12 ? 'PM' : 'AM'
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
  }

  const normalizeToTimeString = (value: string | null | undefined) => {
    if (!value) return defaultAttendanceSettings.halfDay
    const raw = String(value).trim()
    if (!raw) return defaultAttendanceSettings.halfDay
    const [hour, minute] = raw.split(':')
    if (!hour || !minute) return defaultAttendanceSettings.halfDay
    const normalizedHour = String(Number(hour)).padStart(2, '0')
    const normalizedMinute = String(Number(minute)).padStart(2, '0')
    return `${normalizedHour}:${normalizedMinute}`
  }

  const getHalfDayValueForSave = () => {
    const normalized = normalizeToTimeString(attendanceSettings.halfDay)
    return normalized === 'NaN:NaN' ? defaultAttendanceSettings.halfDay : normalized
  }

  const timeToParts = (time: string) => {
    if (!time) return { hour: '08', minute: '00' }
    const [h, m] = time.split(':')
    return { hour: h || '08', minute: m || '00' }
  }

const [openTimePicker, setOpenTimePicker] = useState<{ field: 'startTime' | 'endTime'; part: 'hour' | 'minute' } | null>(null)
  const pickerRef = useRef<HTMLDivElement | null>(null)

  const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => (i + 1).toString().padStart(2, '0'))
  const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'))

  const updateTime = (field: 'startTime' | 'endTime', part: 'hour' | 'minute', value: string) => {
    setAttendanceSettings(prev => {
      const current = timeToParts(prev[field])
      const next = { ...current, [part]: value }
      return { ...prev, [field]: `${next.hour}:${next.minute}` }
    })
    setOpenTimePicker(null)
  }

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setOpenTimePicker(null)
      }
    }
    if (openTimePicker) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [openTimePicker])

  const TimePickerColumn = ({ options, value, field, part, openTimePicker, setOpenTimePicker, updateTime }: {
    options: string[]
    value: string
    field: 'startTime' | 'endTime'
    part: 'hour' | 'minute'
    openTimePicker: { field: 'startTime' | 'endTime'; part: 'hour' | 'minute' } | null
    setOpenTimePicker: (v: { field: 'startTime' | 'endTime'; part: 'hour' | 'minute' } | null) => void
    updateTime: (field: 'startTime' | 'endTime', part: 'hour' | 'minute', value: string) => void
  }) => {
    const isOpen = openTimePicker?.field === field && openTimePicker?.part === part
    return (
      <div className="relative flex-1">
        <div
          className="border border-slate-200 bg-white rounded-lg px-3 py-2 text-sm text-slate-700 font-display cursor-pointer select-none text-center"
          onClick={e => { e.stopPropagation(); setOpenTimePicker(isOpen ? null : { field, part }) }}
        >
          {value}
        </div>
        {isOpen && (
          <div
            className="absolute z-50 mt-1 w-full border border-slate-200 bg-white rounded-lg shadow-lg overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="overflow-y-auto h-40">
              {options.map(opt => (
                <div
                  key={opt}
                  onClick={e => { e.stopPropagation(); updateTime(field, part, opt) }}
                  className={`px-3 py-2 text-sm cursor-pointer font-display text-center ${opt === value ? 'bg-indigo-100 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'}`}
                >
                  {opt}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const handleSave = () => setSaveConfirmOpen(true)

  const saveSummary: Record<Tab, string[]> = {
    payroll: ['Undertime deduction', 'Undertime deduction rate type', 'Undertime deduction rate', '13th Month Pay Date'],
    attendance: ['Start time', 'End time', 'Half Day Pay', 'Grace period'],
    holidays: ['Holiday calendar', 'Holiday types', 'Holiday status settings'],
    users: ['User access', 'Role assignments', 'Account status settings'],
  }

  const tabChanges = {
    payroll: [
      {
        label: 'Undertime Deduction',
        from: defaultPayrollSettings.undertimeDeduction,
        to: (payrollSettings as any).undertimeDeduction,
      },
      {
        label: 'Undertime Deduction Rate Type',
        from: defaultPayrollSettings.undertimeDeductionRateType,
        to: (payrollSettings as any).undertimeDeductionRateType,
      },
      {
        label: 'Undertime Deduction Rate',
        from: defaultPayrollSettings.undertimeDeductionRate,
        to: (payrollSettings as any).undertimeDeductionRate,
      },
      {
        label: '13th Month Pay Date',
        from: (originalPayrollSettings as any).specialMonthPay || '',
        to: (payrollSettings as any).specialMonthPay || '',
      },
    ].filter(change => String(change.from ?? '') !== String(change.to ?? '')),

    attendance: [
      {
        label: 'Start Time',
        from: originalAttendanceSettings.startTime,
        to: attendanceSettings.startTime,
      },
      {
        label: 'End Time',
        from: originalAttendanceSettings.endTime,
        to: attendanceSettings.endTime,
      },
      {
        label: 'Half Day Pay',
        from: originalAttendanceSettings.halfDay,
        to: attendanceSettings.halfDay,
      },
      {
        label: 'Grace Period (minutes)',
        from: originalAttendanceSettings.gracePeriod,
        to: attendanceSettings.gracePeriod,
      },
    ].filter(change => change.from !== change.to),

    holidays: [],
    users: [],
  } as const

  const confirmSave = async () => {
    setSaveConfirmOpen(false)
    try {
      if (tab === 'attendance') {
        const requiredHours = Number(calculateRequiredHours(attendanceSettings.startTime, attendanceSettings.endTime)) || 0
        const response = await fetch('/api/settings/attendance', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            start_time: attendanceSettings.startTime,
            end_time: attendanceSettings.endTime,
            half_day: getHalfDayValueForSave(),
            grace_period: (Number(attendanceSettings.gracePeriod) || 0) * 60,
            required_daily_hours: requiredHours,
            break_duration: (Number(attendanceSettings.breakDuration) || 0) * 60,
            overtime_threshold: (Number(attendanceSettings.overtimeThreshold) || 0) * 3600,
          }),
        })

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}))
          throw new Error(errorBody?.error || 'Attendance settings save failed')
        }
      }

      if (tab === 'payroll') {
        const payResponse = await fetch('/api/settings/payroll', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            undertime_deduction: Number((payrollSettings as any).undertimeDeduction || 0),
            undertime_deduction_rate_type: (payrollSettings as any).undertimeDeductionRateType === 'Minute' ? 'Minute' : 'Hour',
            undertime_deduction_rate: Number((payrollSettings as any).undertimeDeductionRate || 0),
            special_month_pay: (payrollSettings as any).specialMonthPay ? String((payrollSettings as any).specialMonthPay).slice(0, 10) : null,
          }),
        })

        if (!payResponse.ok) {
          const errorBody = await payResponse.json().catch(() => ({}))
          throw new Error(errorBody?.error || 'Payroll settings save failed')
        }
      }
      showToast({
        type: 'success',
        message: 'Settings saved',
        description: `Changes to ${tabLabels.find(t => t.id === tab)?.label ?? 'this settings section'} were saved successfully.`,
      })
    } catch (err) {
      showToast({ type: 'error', message: 'Save failed', description: 'Could not save settings' })
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 font-display">Settings</h2>
        <p className="text-sm text-slate-500 mt-0.5">Configure system and payroll settings</p>
      </div>

      {isMobile ? (
        <div className="border-slate-100 flex flex-wrap gap-1">
          <select
            value={tab}
            onChange={(e) => setTab(e.target.value as Tab)}
            className="w-md px-2 py-2.5 mb-5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-display cursor-pointer"
          >
            {tabLabels.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
      ) : (
        <div className="flex gap-1 mb-6 flex-wrap">
          {tabLabels.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium rounded-lg font-display
                ${tab === t.id ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'payroll' && (
        <div className="bg-white rounded-t rounded-xl border border-slate-200 p-6 shadow-sm max-w-xl">
          <p className="text-sm font-semibold text-slate-700 font-display mb-5">Payroll Settings</p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Undertime Deduction (PHP)</label>
              <input
                value={(payrollSettings as any).undertimeDeduction}
                onChange={e => setPayrollSettings(prev => ({ ...prev, undertimeDeduction: e.target.value }))}
                type="number"
                step="0.01"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Undertime Deduction Rate Type</label>
              <select
                value={(payrollSettings as any).undertimeDeductionRateType}
                onChange={e => setPayrollSettings(prev => ({ ...prev, undertimeDeductionRateType: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="Hour">Hour</option>
                <option value="Minute">Minute</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Undertime Deduction Rate</label>
              <input
                value={(payrollSettings as any).undertimeDeductionRate}
                onChange={e => setPayrollSettings(prev => ({ ...prev, undertimeDeductionRate: e.target.value }))}
                type="number"
                step="0.01"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 font-display">13th Month Pay Date</label>
              <input
                value={(payrollSettings as any).specialMonthPay || ''}
                onChange={e => setPayrollSettings(prev => ({ ...prev, specialMonthPay: e.target.value }))}
                type="date"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              <p className="mt-1 text-[11px] text-slate-400">Leave blank to disable the 13th month pay trigger for future payroll periods.</p>
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <button onClick={handleSave} className="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display">Save Changes</button>
          </div>
        </div>
      )}

      {tab === 'attendance' && (
        <div className="bg-white rounded-t rounded-xl border border-slate-200 p-6 shadow-sm max-w-xl">
          <p className="text-sm font-semibold text-slate-700 font-display mb-5">Attendance Settings</p>
          <div className="space-y-4" ref={pickerRef}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Start Time</label>
                <div className="flex items-center gap-2">
                  <TimePickerColumn
                    options={HOUR_OPTIONS}
                    value={timeToParts(attendanceSettings.startTime).hour}
                    part="hour"
                    field="startTime"
                    openTimePicker={openTimePicker}
                    setOpenTimePicker={setOpenTimePicker}
                    updateTime={updateTime}
                  />
                  <span className="text-slate-400 px-1">:</span>
                  <TimePickerColumn
                    options={MINUTE_OPTIONS}
                    value={timeToParts(attendanceSettings.startTime).minute}
                    part="minute"
                    field="startTime"
                    openTimePicker={openTimePicker}
                    setOpenTimePicker={setOpenTimePicker}
                    updateTime={updateTime}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">End Time</label>
                <div className="flex items-center gap-2">
                  <TimePickerColumn
                    options={HOUR_OPTIONS}
                    value={timeToParts(attendanceSettings.endTime).hour}
                    part="hour"
                    field="endTime"
                    openTimePicker={openTimePicker}
                    setOpenTimePicker={setOpenTimePicker}
                    updateTime={updateTime}
                  />
                  <span className="text-slate-400 px-1">:</span>
                  <TimePickerColumn
                    options={MINUTE_OPTIONS}
                    value={timeToParts(attendanceSettings.endTime).minute}
                    part="minute"
                    field="endTime"
                    openTimePicker={openTimePicker}
                    setOpenTimePicker={setOpenTimePicker}
                    updateTime={updateTime}
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Required Daily Hours</label>
                <input
                  value={`${calculateRequiredHours(attendanceSettings.startTime, attendanceSettings.endTime)} (${formatTime12h(attendanceSettings.startTime)} to ${formatTime12h(attendanceSettings.endTime)})`}
                  readOnly
                  className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm outline-none text-slate-500 font-display"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Grace Period (minutes)</label>
                <input
                  value={attendanceSettings.gracePeriod}
                  onChange={e => setAttendanceSettings(prev => ({ ...prev, gracePeriod: e.target.value }))}
                  type="number"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>
            <div className="max-w-xs">
              <TimePicker
                value={attendanceSettings.halfDay}
                onChange={value => setAttendanceSettings(prev => ({ ...prev, halfDay: value }))}
                label="Half Day Pay"
              />
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <button onClick={handleSave} className="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display">Save Changes</button>
          </div>
        </div>
      )}

      {tab === 'holidays' && (
        <div className="bg-white rounded-t rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-700 font-display">Holidays</p>
            <button onClick={() => setEditingHoliday({ index: -1, item: { holiday: '', date: '', type: 'Regular Holiday', status: 'Active', raw: null } })} className="flex items-center gap-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-display">
              <Plus size={14} /> Add Holiday
            </button>
          </div>
          {!isMobile ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Date', 'Holiday', 'Type', 'Status'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {holidayList.map((h, i) => (
                  <tr
                    key={`${h.date}-${h.holiday}`}
                    className="hover:bg-slate-50 group cursor-pointer"
                    onClick={() => setSelectedHoliday(h)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedHoliday(h)
                      }
                    }}
                  >
                    <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap">{h.date}</td>
                    <td className="py-3 px-4 text-sm font-medium text-slate-700 font-display">{h.holiday}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium font-display ${holidayTypeColor[h.type]}`}>{h.type}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium font-display">{h.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col">
              {holidayList.map((h, i) => (
                <div key={`${h.date}-${h.holiday}`} className="p-3 border-b border-slate-50 flex items-center justify-between gap-3">
                  <button onClick={() => setSelectedHoliday(h)} className="text-left flex-1 min-w-0 hover:bg-slate-50">
                    <div className="text-sm font-medium text-slate-700">{h.holiday}</div>
                    <div className="text-xs text-slate-400">{h.date} • {h.type}</div>
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* Holidays do not use the global Save Changes button here; actions are per-item in the modal */}
        </div>
      )}

      {tab === 'users' && (
        <div className="bg-white rounded-t rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-700 font-display">Users & Roles</p>
            <button onClick={() => { setAddUserOpen(true); setNewUser({ username: '', name: '', email: '', password: '', role: 'Staff', status: 'Active', restaurant: 'Both' }) }} className="flex items-center gap-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-display">
              <Plus size={14} /> Add Users
            </button>
          </div>
          {!isMobile ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['User', 'Email', 'Role', 'Status'].map(h => (
                        <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">{h}</th>
                      ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {userList.map((u, i) => (
                  <tr
                    key={`${u.email}-${u.name}`}
                    className="hover:bg-slate-50 group cursor-pointer"
                    onClick={() => setSelectedUser(u)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedUser(u)
                      }
                    }}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                          <span className="text-indigo-700 text-xs font-bold font-display">{u.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</span>
                        </div>
                        <span className="text-sm font-medium text-slate-700 font-display">{u.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-500">{u.email}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium font-display ${roleColor[u.role] || 'bg-slate-100 text-slate-500'}`}>{u.role}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium font-display">{u.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col">
              {userList.map((u, i) => (
                <div key={`${u.email}-${u.name}`} className="p-3 border-b border-slate-50 flex items-center justify-between gap-3">
                  <button
                    onClick={() => setSelectedUser(u)}
                    className="flex flex-col items-start text-left min-w-0 hover:bg-slate-50"
                  >
                    <span className="text-sm font-medium text-slate-700">{u.name}</span>
                    <span className="text-xs text-slate-400">{u.role}</span>
                    <span className="text-xs text-slate-400">{u.email}</span>
                  </button>

                  <div className="flex gap-1">
                    <button onClick={() => setEditingUser({ index: i, item: u })} className="p-1.5 text-slate-400 hover:text-slate-700">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => setDeleteTarget({ kind: 'user', index: i, item: u })} className="p-1.5 text-slate-400 hover:text-red-600">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {saveConfirmOpen && (
        <Modal open={saveConfirmOpen} title="Save Changes?" onClose={() => setSaveConfirmOpen(false)}>
          <div className="w-full p-2">
            <p className="text-sm font-semibold text-slate-700 mb-3">{tabLabels.find(t => t.id === tab)?.label ?? 'This section'}</p>
            <p className="text-sm text-slate-600 mb-4">You are about to save the following changes:</p>
            {tabChanges[tab].length > 0 ? (
              <ul className="mb-5 text-sm text-slate-600 space-y-3">
                {tabChanges[tab].map(change => (
                  <li key={change.label} className="flex flex-col border border-slate-200 rounded-lg bg-slate-50 p-3">
                    <div className="text-sm font-medium text-slate-700">{change.label}</div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                      <span className="text-slate-500">{change.from}</span>
                      <span className="text-slate-400">→</span>
                      <span className="font-medium text-indigo-600">{change.to}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="space-y-2 mb-5 text-sm text-slate-600">
                {saveSummary[tab].map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setSaveConfirmOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
              <button onClick={confirmSave} className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display">Confirm Save</button>
            </div>
          </div>
        </Modal>
      )}

      {editingAmount && (
        <Modal open={!!editingAmount} title={`Edit ${editingAmount.key}`} onClose={() => setEditingAmount(null)}>
          <div className="w-full p-2">
            <p className="text-sm text-slate-600 mb-4">Adjust amount for <span className="font-medium text-slate-700">{editingAmount.key}</span></p>
            <div className="mb-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Current amount</div>
              <div className="text-sm font-medium text-slate-700 mt-1">{formatCurrency(editingAmount.value)}</div>
            </div>
            <div className="mb-4">
              <label className="block text-xs text-slate-500 mb-1">New amount (PHP)</label>
              <input
                type="number"
                value={editingAmount.value}
                onChange={e => setEditingAmount(prev => prev ? { ...prev, value: Number(e.target.value) } : prev)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setEditingAmount(null)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
              <button
                onClick={() => {
                  if (!editingAmount) return
                  if (editingAmount.kind === 'earning') {
                    setEarningsAmounts(prev => ({ ...prev, [editingAmount.key]: editingAmount.value }))
                  } else {
                    setDeductionAmounts(prev => ({ ...prev, [editingAmount.key]: editingAmount.value }))
                  }
                  setEditingAmount(null)
                  showToast({ type: 'success', message: 'Amount updated', description: `${editingAmount.key} updated to ${formatCurrency(editingAmount.value)}` })
                }}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display"
              >
                Save
              </button>
            </div>
          </div>
        </Modal>
      )}

      {editingHoliday && (
        <Modal open={!!editingHoliday} title="Edit Holiday" onClose={() => setEditingHoliday(null)}>
          <div className="w-full p-2">
            <div className="w-md space-y-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Holiday Name</label>
                <input
                  value={editingHoliday.item.holiday}
                  onChange={e => setEditingHoliday(prev => prev ? { ...prev, item: { ...prev.item, holiday: e.target.value } } : prev)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Date</label>
                <input
                  type="date"
                  value={editingHoliday.item.date || ''}
                  onChange={e => setEditingHoliday(prev => prev ? { ...prev, item: { ...prev.item, date: e.target.value } } : prev)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Type</label>
                <select
                  value={editingHoliday.item.type}
                  onChange={e => setEditingHoliday(prev => prev ? { ...prev, item: { ...prev.item, type: e.target.value } } : prev)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  {Object.keys(holidayTypeColor).map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Status</label>
                <select
                  value={editingHoliday.item.status}
                  onChange={e => setEditingHoliday(prev => prev ? { ...prev, item: { ...prev.item, status: e.target.value } } : prev)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex gap-3 justify-end">
              <button onClick={() => setEditingHoliday(null)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
              <button
                onClick={async () => {
                  if (!editingHoliday) return
                  const item: any = editingHoliday.item
                  const mapTypeToDb = (t: string) => {
                    if (t === 'Company Holiday') return 'COMPANY'
                    // prefer new 'SPECIAL' enum value, but backend accepts both
                    if (t === 'Special Non-Working Holiday') return 'SPECIAL'
                    return 'REGULAR'
                  }

                  const toIsoDate = (d: any) => {
                    if (!d) return null
                    // prefer raw if available
                    if (item.raw && item.raw.date) return new Date(item.raw.date).toISOString().slice(0,10)
                    const parsed = new Date(d)
                    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0,10)
                    // try parsing short format like "Aug 26, 2026"
                    const p2 = new Date(d)
                    if (!isNaN(p2.getTime())) return p2.toISOString().slice(0,10)
                    return null
                  }

                  const payload = {
                    date: toIsoDate(item.date),
                    holiday_name: item.holiday,
                    type: mapTypeToDb(item.type),
                    active: item.status === 'Active'
                  }

                  try {
                    if (item.id) {
                      const res = await fetch(`/api/settings/holidays/${item.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
                      if (!res.ok) throw new Error('Update failed')
                      const updated = await res.json()
                      const mapped = { id: updated.id, date: new Date(updated.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), holiday: updated.holiday_name, type: (updated.type === 'SPECIAL' || updated.type === 'SPECIAL_NON_WORKING') ? 'Special Non-Working Holiday' : updated.type === 'COMPANY' ? 'Company Holiday' : 'Regular Holiday', status: updated.active ? 'Active' : 'Inactive', raw: updated }
                      setHolidayList(prev => prev.map((it) => it.id === mapped.id ? mapped : it))
                      showToast({ type: 'success', message: 'Holiday updated', description: `${mapped.holiday} was updated successfully.` })
                    } else {
                      const res = await fetch('/api/settings/holidays', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
                      if (!res.ok) throw new Error('Create failed')
                      const created = await res.json()
                      const mapped = { id: created.id, date: new Date(created.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), holiday: created.holiday_name, type: (created.type === 'SPECIAL' || created.type === 'SPECIAL_NON_WORKING') ? 'Special Non-Working Holiday' : created.type === 'COMPANY' ? 'Company Holiday' : 'Regular Holiday', status: created.active ? 'Active' : 'Inactive', raw: created }
                      setHolidayList(prev => [mapped, ...prev])
                      showToast({ type: 'success', message: 'Holiday created', description: `${mapped.holiday} was added.` })
                    }
                  } catch (err) {
                    console.error('Holiday save error', err)
                    showToast({ type: 'error', message: 'Save failed', description: 'Could not save holiday' })
                  } finally {
                    setEditingHoliday(null)
                  }
                }}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display"
              >
                Save Changes
              </button>
            </div>
          </div>
        </Modal>
      )}

      {editingUser && (
        <Modal open={!!editingUser} title="Edit User" onClose={() => setEditingUser(null)}>
          <div className="w-full p-2">
            <div className="w-md space-y-4">
              <div>
                 <label className="block text-xs text-slate-500 mb-1">Full Name</label>
                 <input
                   value={editingUser.item.name}
                   onChange={e => setEditingUser(prev => prev ? { ...prev, item: { ...prev.item, name: e.target.value } } : prev)}
                   className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                 />
               </div>
               <div>
                 <label className="block text-xs text-slate-500 mb-1">Username</label>
                 <input
                   value={editingUser.item.username}
                   onChange={e => setEditingUser(prev => prev ? { ...prev, item: { ...prev.item, username: e.target.value } } : prev)}
                   className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                 />
               </div>
               <div>
                 <label className="block text-xs text-slate-500 mb-1">Email</label>
                 <input
                   value={editingUser.item.email}
                   onChange={e => setEditingUser(prev => prev ? { ...prev, item: { ...prev.item, email: e.target.value } } : prev)}
                   className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                 />
               </div>
               <div>
                 <label className="block text-xs text-slate-500 mb-1">Password</label>
                 <input
                   value={editingUser.item.password}
                   placeholder="Enter new password"
                   onChange={e => setEditingUser(prev => prev ? { ...prev, item: { ...prev.item, password: e.target.value } } : prev)}
                   className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                 />
               </div>
               <div>
                 <label className="block text-xs text-slate-500 mb-1">Role</label>
                 <select
                   value={editingUser.item.role}
                   onChange={e => setEditingUser(prev => prev ? { ...prev, item: { ...prev.item, role: e.target.value } } : prev)}
                   className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                 >
                   {Object.keys(roleColor).map(role => (
                     <option key={role} value={role}>{role}</option>
                   ))}
                 </select>
               </div>
               <div>
                 <label className="block text-xs text-slate-500 mb-1">Restaurant</label>
                 <select
                   value={editingUser.item.restaurant}
                   onChange={e => setEditingUser(prev => prev ? { ...prev, item: { ...prev.item, restaurant: e.target.value } } : prev)}
                   className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                 >
                   <option value="Both">Both</option>
                   <option value="Lakay Ago">Lakay Ago</option>
                   <option value="Aroo">Aroo</option>
                 </select>
               </div>
               <div>
                 <label className="block text-xs text-slate-500 mb-1">Status</label>
                 <select
                   value={editingUser.item.status}
                   onChange={e => setEditingUser(prev => prev ? { ...prev, item: { ...prev.item, status: e.target.value } } : prev)}
                   className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                 >
                   <option value="Active">Active</option>
                   <option value="Inactive">Inactive</option>
                 </select>
               </div>
            </div>
            <div className="mt-5 flex gap-3 justify-end">
              <button onClick={() => setEditingUser(null)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
              <button
                onClick={() => {
                  if (!editingUser) return
                  setShowConfirmSave(true)
                }}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display"
              >
                Save Changes
              </button>
            </div>
          </div>
        </Modal>
      )}

      {addUserOpen && (
        <Modal open={addUserOpen} title="Add User" onClose={() => setAddUserOpen(false)}>
          <div className="w-full p-2">
            <div className="w-md space-y-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Full Name</label>
                <input
                  value={newUser.name}
                  onChange={e => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Username</label>
                <input
                  value={newUser.username}
                  onChange={e => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Email</label>
                <input
                  value={newUser.email}
                  onChange={e => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Password</label>
                <div className="flex items-center border border-slate-200 rounded-lg px-3 py-2">
                  <input
                    value={newUser.password}
                    onChange={e => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                    type={showNewUserPassword ? 'text' : 'password'}
                    className="flex-1 text-sm outline-none"
                  />
                  <button type="button" onClick={() => setShowNewUserPassword(s => !s)} className="text-slate-400 hover:text-slate-600 ml-2">
                    {showNewUserPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Role</label>
                <select
                  value={newUser.role}
                  onChange={e => setNewUser(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  {Object.keys(roleColor).map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Restaurant</label>
                <select
                  value={newUser.restaurant}
                  onChange={e => setNewUser(prev => ({ ...prev, restaurant: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="Both">Both</option>
                  <option value="Lakay Ago">Lakay Ago</option>
                  <option value="Aroo">Aroo</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Status</label>
                <select
                  value={newUser.status}
                  onChange={e => setNewUser(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex gap-3 justify-end">
              <button onClick={() => setAddUserOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
              <button
                onClick={async () => {
                  if (!newUser.name || !newUser.email || !newUser.username || !newUser.password) {
                    showToast({ type: 'error', message: 'Missing fields', description: 'Username, name, email and password are required.' })
                    return
                  }
                  try {
                    const payload = {
                      username: newUser.username,
                      name: newUser.name,
                      email: newUser.email,
                      password: newUser.password,
                      role: newUser.role,
                      restaurant: newUser.restaurant,
                    }
                    const res = await fetch('/api/users', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
                    if (!res.ok) {
                      const body = await res.json().catch(() => ({}))
                      showToast({ type: 'error', message: 'Create failed', description: body?.error || 'Could not create user' })
                      return
                    }
                    const created = await res.json()
                    const mapped = { username: newUser.username, name: created.name || newUser.name, email: created.email || newUser.email, role: created.role === 'SuperAdmin' ? 'Super Admin' : created.role, restaurant: created.restaurant || newUser.restaurant, status: 'Active' }
                    setUserList(prev => [mapped, ...prev])
                    setAddUserOpen(false)
                    setNewUser({ username: '', name: '', email: '', password: '', role: 'Staff', status: 'Active', restaurant: 'Both' })
                    showToast({ type: 'success', message: 'User added', description: `${mapped.name} was added.` })
                  } catch (err) {
                    console.error('Create user error', err)
                    showToast({ type: 'error', message: 'Create failed', description: 'Could not create user' })
                  }
                }}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display"
              >
                Add User
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal open={!!deleteTarget} title="Confirm deletion" onClose={() => setDeleteTarget(null)}>
          <div className="w-full p-2">
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to delete <span className="font-semibold text-slate-700">{deleteTarget.kind === 'holiday' ? (deleteTarget.item as any).holiday : (deleteTarget.item as any).name}</span>?
            </p>
            <p className="text-xs text-slate-500 mb-5">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
              <button
                onClick={async () => {
                  if (!deleteTarget) return
                  if (deleteTarget.kind === 'holiday') {
                    const item: any = deleteTarget.item
                    if (item && item.id) {
                      try {
                        const res = await fetch(`/api/settings/holidays/${item.id}`, { method: 'DELETE' })
                        if (!res.ok) throw new Error('Delete failed')
                        setHolidayList(prev => prev.filter(h => h.id !== item.id))
                        showToast({ type: 'success', message: 'Holiday deleted', description: `${item.holiday} was removed.` })
                      } catch (err) {
                        showToast({ type: 'error', message: 'Delete failed', description: 'Could not delete holiday' })
                      }
                    } else {
                      setHolidayList(prev => prev.filter((_, idx) => idx !== deleteTarget.index))
                      showToast({ type: 'success', message: 'Holiday deleted', description: `${(deleteTarget.item as any).holiday} was removed.` })
                    }
                  } else {
                    setUserList(prev => prev.filter((_, idx) => idx !== deleteTarget.index))
                    showToast({ type: 'success', message: 'User deleted', description: `${(deleteTarget.item as any).name} was removed.` })
                  }
                  setDeleteTarget(null)
                }}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg font-display"
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteSalaryTarget && (
        <Modal open={!!deleteSalaryTarget} title="Confirm deletion" onClose={() => setDeleteSalaryTarget(null)}>
          <div className="w-full p-2">
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to delete <span className="font-semibold text-slate-700">{deleteSalaryTarget.key}</span>?
            </p>
            <p className="text-xs text-slate-500 mb-5">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteSalaryTarget(null)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
              <button
                onClick={() => {
                  if (!deleteSalaryTarget) return
                  if (deleteSalaryTarget.kind === 'earning') {
                    setEarningsTypesList(prev => prev.filter(type => type !== deleteSalaryTarget.key))
                    setEarningsAmounts(prev => {
                      const next = { ...prev }
                      delete next[deleteSalaryTarget.key]
                      return next
                    })
                    showToast({ type: 'success', message: 'Earning type deleted', description: `${deleteSalaryTarget.key} was removed from earnings.` })
                  } else {
                    setDeductionTypesList(prev => prev.filter(type => type !== deleteSalaryTarget.key))
                    setDeductionAmounts(prev => {
                      const next = { ...prev }
                      delete next[deleteSalaryTarget.key]
                      return next
                    })
                    showToast({ type: 'success', message: 'Deduction type deleted', description: `${deleteSalaryTarget.key} was removed from deductions.` })
                  }
                  setDeleteSalaryTarget(null)
                }}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg font-display"
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}

      {selectedHoliday && (
        <Modal open={!!selectedHoliday} title={selectedHoliday.holiday || selectedHoliday.label || 'Holiday'} onClose={() => setSelectedHoliday(null)}>
          <div className="space-y-3">
            <div className="w-md grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-400">Date</p>
                <p className="text-sm font-medium">{selectedHoliday.date}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Type</p>
                <p className="text-sm font-medium">{selectedHoliday.type}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400">Status</p>
              <p className="text-sm font-medium">{selectedHoliday.status}</p>
            </div>
          </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button onClick={() => setSelectedHoliday(null)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Close</button>
            <button onClick={() => {
                const idx = holidayList.findIndex(it => it.holiday === selectedHoliday.holiday && it.date === selectedHoliday.date)
                const isoDate = selectedHoliday?.raw?.date ? new Date(selectedHoliday.raw.date).toISOString().slice(0,10) : (selectedHoliday?.date ? new Date(selectedHoliday.date).toISOString().slice(0,10) : '')
                setSelectedHoliday(null)
                setEditingHoliday({ index: idx, item: { ...selectedHoliday, date: isoDate } })
              }} className="px-3 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">Edit</button>
            <button onClick={() => { setSelectedHoliday(null); setDeleteTarget({ kind: 'holiday', index: holidayList.findIndex(it => it.holiday === selectedHoliday.holiday && it.date === selectedHoliday.date), item: selectedHoliday }) }} className="px-3 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg">Delete</button>
          </div>
        </Modal>
      )}

      {showConfirmSave && (
        <Modal open={showConfirmSave} title="Confirm changes" onClose={() => setShowConfirmSave(false)}>
          <div className="w-full p-2">
            <p className="text-sm text-slate-600">Are you sure you want to save these changes?</p>
            <div className="mt-5 flex gap-3 justify-end">
              <button onClick={() => setShowConfirmSave(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
              <button
                onClick={() => {
                  if (!editingUser) return
                  setUserList(prev => prev.map((item, idx) => idx === editingUser.index ? editingUser.item : item))
                  setEditingUser(null)
                  setShowConfirmSave(false)
                  showToast({ type: 'success', message: 'User updated', description: `${editingUser.item.name} was updated successfully.` })
                }}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display"
              >
                Confirm Save
              </button>
            </div>
          </div>
        </Modal>
      )}

      {selectedUser && (
        <Modal open={!!selectedUser} title="User Information" onClose={() => setSelectedUser(null)}>
          <div className="space-y-3">
            <div className="w-md grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-400">Name</p>
                <p className="text-sm font-medium">{selectedUser.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Username</p>
                <p className="text-sm font-medium">{selectedUser.username}</p>
              </div>
            </div>
            <div className="w-md grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-400">Email</p>
                <p className="text-sm font-medium">{selectedUser.email}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Role</p>
                <p className="text-sm font-medium">{selectedUser.role}</p>
              </div>
            </div>
            <div className="w-md grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-400">Restaurant</p>
                <p className="text-sm font-medium">{selectedUser.restaurant}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Status</p>
                <p className="text-sm font-medium">{selectedUser.status}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button onClick={() => { setSelectedUser(null); setDeleteTarget({ kind: 'user', index: userList.findIndex(it => it.email === selectedUser.email), item: selectedUser }) }} className="px-3 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg">Delete</button>
              <button onClick={() => { setSelectedUser(null); setEditingUser({ index: userList.findIndex(it => it.email === selectedUser.email), item: selectedUser }) }} className="px-3 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">Edit</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
