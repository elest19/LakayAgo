'use client'
import { useEffect, useState, useRef } from 'react'
import { FileText, Download, Printer, BarChart3, Clock, UserCheck, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../App'
import useIsMobile from '../hooks/isMobile'
import Modal from '../components/Modal'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend,
  PieChart, Pie, Cell
} from 'recharts'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(n)

// Simple custom dropdown that renders an open panel with constrained height and scroll
function DropdownSelect<T extends string | number>(props: {
  value: T | 'all' | ''
  options: { value: T | string; label: string }[]
  onChange: (v: T | string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}) {
  const { value, options, onChange, disabled, placeholder, className } = props
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])

  const selected = options.find(o => String(o.value) === String(value))

  return (
    <div ref={ref} className={`relative ${className || ''}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(s => !s)}
        className={`w-full text-left border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 font-display text-slate-600 ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center justify-between">
          <div className="truncate">{selected ? selected.label : (placeholder || 'Select...')}</div>
          <svg className="ml-2 w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
        </div>
      </button>
      {open && !disabled && (
        <div className="absolute z-40 mt-1 w-full bg-white border border-slate-200 rounded shadow-sm max-h-60 overflow-y-auto">
          <ul>
            {options.map(o => (
              <li key={String(o.value)}>
                <button
                  type="button"
                  onClick={() => { onChange(String(o.value)); setOpen(false) }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                >{o.label}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

const attendanceReportTypes = [
  'Daily Attendance', 'Absent Report', 'Late Report',
  'Undertime Report', 'Overtime Report', 'Leave Report',
]
const payrollReportTypes = [
  'Payroll Summary', 'Earnings Report', 'Deduction Report', 'Health Benefits Deduction', 'Other Deductions'
]

export default function Reports() {
  const { showToast, navigate } = useApp()
  const isMobile = useIsMobile()
  const [selectedDept, setSelectedDept] = useState<any | null>(null)
  const [reportType, setReportType] = useState('Department Payroll')
  const [category, setCategory] = useState<'attendance' | 'payroll'>('payroll')
  const [generated, setGenerated] = useState(false)
  const [generating, setGenerating] = useState(false)
  
  const [reportData, setReportData] = useState<any[]>([])

  // Pagination
  const [page, setPage] = useState(1)
  const pageSize = 10
  
  // Filters
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('')
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>('all')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all')
  
  // Dropdown options
  const [periods, setPeriods] = useState<{ id: string; label: string; period_start?: string; period_end?: string; is_special_month?: boolean }[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [employees, setEmployees] = useState<{ id: string; name: string; department: string; restaurant: string }[]>([])
  
  // Loading states
  const [periodsLoading, setPeriodsLoading] = useState(false)
  const [employeesLoading, setEmployeesLoading] = useState(false)
  // Payroll-specific state
  const [payrollEarnings, setPayrollEarnings] = useState<any[]>([])
  const [payrollDeductions, setPayrollDeductions] = useState<any[]>([])
  const [payrollIsSpecial, setPayrollIsSpecial] = useState(false)
  const [payrollCashAdvanceTotal, setPayrollCashAdvanceTotal] = useState(0)

  useEffect(() => {
    // fetch employees on mount; periods are fetched when a restaurant is selected
    fetchEmployees()
  }, [])

  // Re-fetch periods when selectedRestaurant changes
  useEffect(() => {
    // clear existing period selection whenever restaurant changes
    setSelectedPeriodId('')
    // also clear selected employee filter
    setSelectedEmployeeId('all')
    if (selectedRestaurant && selectedRestaurant !== 'all') {
      fetchPeriods()
      fetchEmployees()
    } else {
      setPeriods([])
      fetchEmployees()
    }
  }, [selectedRestaurant])

async function fetchPeriods() {
    setPeriodsLoading(true)
      try {
    const params = new URLSearchParams()
    if (selectedRestaurant && selectedRestaurant !== 'all') params.append('restaurant', selectedRestaurant)
    const url = params.toString() ? `/api/report_periods?${params.toString()}` : '/api/report_periods'
    const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch periods')
      const data = await res.json()
        setPeriods((data.periods || []).map((p: any) => {
          return {
            id: String(p.report_period_id),
            label: (p.period_start || '') + ' - ' + (p.period_end || '') + ' (' + (p.restaurant || '') + ')',
            period_start: p.period_start,
            period_end: p.period_end,
            is_special_month: Boolean(p.is_special_month)
          }
        }))
    } catch (err) {
      console.error('Failed to fetch periods', err)
      showToast({ type: 'error', message: 'Failed to load payroll periods' })
    } finally {
      setPeriodsLoading(false)
    }
  }

async function fetchEmployees() {
    setEmployeesLoading(true)
    try {
  const params = new URLSearchParams()
  if (selectedRestaurant && selectedRestaurant !== 'all') params.append('restaurant', selectedRestaurant)
  const url = params.toString() ? `/api/employees?${params.toString()}` : '/api/employees'
  const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch employees')
      const data = await res.json()
      const empList = (data.employees || []).map((e: any) => ({
        id: String(e.id ?? e.employee_id),
        name: e.name,
        department: e.department || 'Unassigned',
        restaurant: e.restaurant || 'Both',
      }))
      setEmployees(empList)
      // Extract unique departments
      const depts = Array.from(new Set(empList.map((e: any) => e.department).filter(Boolean))) as string[]
      setDepartments(['all', ...depts])
    } catch (err) {
      console.error('Failed to fetch employees', err)
      showToast({ type: 'error', message: 'Failed to load employees' })
    } finally {
      setEmployeesLoading(false)
    }
  }

  const handleGenerate = async () => {
    if (!selectedPeriodId) {
      showToast({ type: 'error', message: 'Please select a payroll period' })
      return
    }
    
    setGenerating(true)
    setGenerated(false)
    
    try {
      let data: any[] = []
      
      if (category === 'payroll') {
        // Fetch payslips for the selected period (and restaurant if provided)
        const params = new URLSearchParams()
        params.append('period_id', selectedPeriodId)
        if (selectedRestaurant && selectedRestaurant !== 'all') params.append('restaurant', selectedRestaurant)
        const res = await fetch(`/api/payslips?${params.toString()}`)
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to fetch payslips')
        }
        const body = await res.json()
        const rows = body.payslips || []

        // Determine is_special_month from periods cache
        const period = periods.find(p => p.id === selectedPeriodId)
        const isSpecial = Boolean(period?.is_special_month)
        setPayrollIsSpecial(isSpecial)

        // Aggregate totals
        const totals = rows.reduce((acc: any, r: any) => {
          acc.base_pay += Number(r.base_pay || 0)
          acc.overtime_pay += Number(r.overtime_pay || 0)
          acc.halfday_pay += Number(r.halfday_pay || 0)
          acc.holiday_pay += Number(r.holiday_pay || 0)
          acc.special_month += Number(r.special_month || 0)
          acc.sss += Number(r.sss_deduction || 0)
          acc.philhealth += Number(r.philhealth_deduction || 0)
          acc.pagibig += Number(r.pagibig_deduction || 0)
          acc.undertime += Number(r.undertime_deduction || 0)
          acc.late += Number(r.late_deduction || 0)
          acc.cash_advance += Number(r.cash_advance_deduction || 0)
          return acc
        }, { base_pay:0, overtime_pay:0, halfday_pay:0, holiday_pay:0, special_month:0, sss:0, philhealth:0, pagibig:0, undertime:0, late:0, cash_advance:0 })

        setPayrollCashAdvanceTotal(totals.cash_advance)

        // Build earnings slices
        const earningsSlices: any[] = [
          { name: 'Base Pay', value: totals.base_pay, color: '#10b981' },
          { name: 'Overtime Pay', value: totals.overtime_pay, color: '#f59e0b' },
          { name: 'Late Time Pay', value: totals.halfday_pay, color: '#7c3aed' },
          { name: 'Holiday Pay', value: totals.holiday_pay, color: '#f97316' },
        ]
        if (isSpecial) earningsSlices.push({ name: '13th Month Pay', value: totals.special_month, color: '#3b82f6' })

        // Build deduction slices
        const deductionSlices: any[] = [
          { name: 'SSS', value: totals.sss, color: '#f472b6' },
          { name: 'PhilHealth', value: totals.philhealth, color: '#06b6d4' },
          { name: 'Pag-Ibig', value: totals.pagibig, color: '#8b5cf6' },
          { name: 'Undertime', value: totals.undertime, color: '#7c2d12' },
          { name: 'Late', value: totals.late, color: '#ef4444' },
        ]
        if (totals.cash_advance > 0) deductionSlices.push({ name: 'Cash Advance', value: totals.cash_advance, color: '#9ca3af' })

        setPayrollEarnings(earningsSlices)
        setPayrollDeductions(deductionSlices)

        // Prepare per-employee rows for table reports
        const empRows = rows.map((r: any) => ({
          employee_name: r.employee_name || r.name || `${r.employee_id}`,
          base_pay: Number(r.base_pay || 0),
          overtime_pay: Number(r.overtime_pay || 0),
          halfday_pay: Number(r.halfday_pay || 0),
          holiday_pay: Number(r.holiday_pay || 0),
          special_month: Number(r.special_month || 0),
          sss: Number(r.sss_deduction || 0),
          philhealth: Number(r.philhealth_deduction || 0),
          pagibig: Number(r.pagibig_deduction || 0),
          undertime: Number(r.undertime_deduction || 0),
          late: Number(r.late_deduction || 0),
          cash_advance: Number(r.cash_advance_deduction || 0),
        }))

        data = empRows
      } else {
          // Attendance reports - fetch attendance rows for selected payroll period + restaurant/employee filters
          const params = new URLSearchParams()
          const period = periods.find(p => p.id === selectedPeriodId)
          if (period) {
            params.append('from', period.period_start || '')
            params.append('to', period.period_end || '')
          }
          if (selectedRestaurant && selectedRestaurant !== 'all') params.append('restaurant', selectedRestaurant)
          if (selectedEmployeeId !== 'all') params.append('employee_id', selectedEmployeeId)

          const res = await fetch(`/api/attendance?${params.toString()}`)
          if (!res.ok) {
            const err = await res.json()
            throw new Error(err.error || 'Failed to generate attendance report')
          }
          const body = await res.json()
          const rows = body.attendance || []

          // Helper: list of dates between period start/end inclusive
          const makeDateRange = (start: string, end: string) => {
            const out: string[] = []
            if (!start || !end) return out
            const s = new Date(start)
            const e = new Date(end)
            for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
              const y = d.getFullYear()
              const m = String(d.getMonth() + 1).padStart(2, '0')
              const day = String(d.getDate()).padStart(2, '0')
              out.push(`${y}-${m}-${day}`)
            }
            return out
          }

          const dates = period ? makeDateRange(period.period_start || '', period.period_end || '') : []

          // Fetch attendance settings if needed for time-based reports
          let settings: any = null
          if (['Late Report', 'Undertime Report', 'Overtime Report'].includes(reportType)) {
            const sres = await fetch('/api/settings/attendance')
            if (sres.ok) settings = await sres.json()
          }

          if (reportType === 'Daily Attendance') {
            data = dates.map(d => {
              const daily = rows.filter((r: any) => String(r.work_date) === d)
              const present = daily.filter((r: any) => !r.is_absent && !r.on_leave).length
              const absent = daily.filter((r: any) => Boolean(r.is_absent)).length
              const onLeave = daily.filter((r: any) => Boolean(r.on_leave)).length
              return { date: d, present, absent, on_leave: onLeave }
            })
          } else if (reportType === 'Absent Report') {
            data = dates.map(d => ({ date: d, value: rows.filter((r: any) => String(r.work_date) === d && Boolean(r.is_absent)).length }))
          } else if (reportType === 'Late Report') {
            const startTime = settings?.start_time || '08:00:00'
            const grace = Number(settings?.grace_period || 0)
            const minutesToAdd = grace / 15
            const parseToMinutes = (t: string) => {
              if (!t) return NaN
              const [hh, mm] = String(t).split(':').map(Number)
              return hh * 60 + (mm || 0)
            }
            const startMinutes = parseToMinutes(startTime)
            data = dates.map(d => {
              const daily = rows.filter((r: any) => String(r.work_date) === d && !r.is_absent && !r.on_leave)
              let lateCount = 0
              for (const r of daily) {
                const firstOn = r.first_on_duty || r.firstOnDuty || ''
                const onMinutes = parseToMinutes(firstOn)
                const cutoff = startMinutes + minutesToAdd
                if (!Number.isFinite(onMinutes)) continue
                if (onMinutes > cutoff) lateCount += 1
              }
              return { date: d, value: lateCount }
            })
          } else if (reportType === 'Undertime Report') {
            const endTime = settings?.end_time || '17:00:00'
            const parseToMinutes = (t: string) => {
              if (!t) return NaN
              const [hh, mm] = String(t).split(':').map(Number)
              return hh * 60 + (mm || 0)
            }
            const endMinutes = parseToMinutes(endTime)
            data = dates.map(d => {
              const daily = rows.filter((r: any) => String(r.work_date) === d && !r.is_absent && !r.on_leave)
              let count = 0
              for (const r of daily) {
                const firstOff = r.first_off_duty || r.firstOffDuty || ''
                const offMinutes = parseToMinutes(firstOff)
                if (!Number.isFinite(offMinutes)) continue
                if (offMinutes < endMinutes) count += 1
              }
              return { date: d, value: count }
            })
          } else if (reportType === 'Overtime Report') {
            const endTime = settings?.end_time || '17:00:00'
            const parseToMinutes = (t: string) => {
              if (!t) return NaN
              const [hh, mm] = String(t).split(':').map(Number)
              return hh * 60 + (mm || 0)
            }
            const endMinutes = parseToMinutes(endTime)
            data = dates.map(d => {
              const daily = rows.filter((r: any) => String(r.work_date) === d && !r.is_absent && !r.on_leave)
              let count = 0
              for (const r of daily) {
                const firstOff = r.first_off_duty || r.firstOffDuty || ''
                const offMinutes = parseToMinutes(firstOff)
                if (!Number.isFinite(offMinutes)) continue
                if (offMinutes > endMinutes) count += 1
              }
              return { date: d, value: count }
            })
          } else if (reportType === 'Leave Report') {
            data = dates.map(d => ({ date: d, value: rows.filter((r: any) => String(r.work_date) === d && Boolean(r.on_leave)).length }))
          } else {
            data = []
          }
        }
      
      setReportData(data)
      setGenerated(true)
      showToast({ type: 'success', message: 'Report generated', description: `${data.length} records found` })
    } catch (err: any) {
      showToast({ type: 'error', message: 'Failed to generate report', description: err.message })
    } finally {
      setGenerating(false)
    }
  }

  const getPeriodLabel = (id: string) => {
    const p = periods.find(p => p.id === id)
    return p ? `${p.period_start} – ${p.period_end}` : 'Select period'
  }

  const getTableHeaders = () => {
    if (category === 'payroll') return ['Department', 'Employees', 'Gross Pay', 'Deductions', 'Net Pay']
    switch (reportType) {
      case 'Daily Attendance': return ['Date', 'Present', 'Absent', 'On Leave']
      case 'Absent Report': return ['Date', 'Absent']
      case 'Late Report': return ['Date', 'Late']
      case 'Undertime Report': return ['Date', 'Undertime']
      case 'Overtime Report': return ['Date', 'Overtime']
      case 'Leave Report': return ['Date', 'Leave']
      default: return ['Date', 'Value']
    }
  }

  // Paged data for table/list rendering
  const totalPages = Math.max(1, Math.ceil(reportData.length / pageSize))
  const pagedData = reportData.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    // reset to first page whenever report data changes
    setPage(1)
  }, [reportData, reportType, category, selectedPeriodId, selectedRestaurant, selectedEmployeeId])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 font-display">Reports</h2>
        <p className="text-sm text-slate-500 mt-0.5">Generate attendance and payroll reports</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report Config */}
        <div className="lg:col-span-1 space-y-5">
          {/* Category tabs */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 font-display">Report Category</p>
            <div className="flex gap-2 mb-4">
              {[
                { id: 'attendance', label: 'Attendance', icon: <UserCheck size={14} /> },
                { id: 'payroll', label: 'Payroll', icon: <BarChart3 size={14} /> },
              ].map(c => (
                <button
                  key={c.id}
                  onClick={() => { setCategory(c.id as any); setGenerated(false) }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium font-display flex-1 justify-center
                    ${category === c.id ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                >
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 font-display">Report Type</p>
            <div className="space-y-1">
              {(category === 'attendance' ? attendanceReportTypes : payrollReportTypes).map(rt => (
                <button
                  key={rt}
                  onClick={() => { setReportType(rt); setGenerated(false) }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-display
                    ${reportType === rt ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {rt}
                </button>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide font-display">Filters</p>
            
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Payroll Period</label>
              <DropdownSelect
                value={selectedPeriodId}
                options={[{ value: '', label: selectedRestaurant === 'all' ? 'Select restaurant first' : 'Select payroll period' }, ...periods.map(p => ({ value: p.id, label: p.label }))]}
                onChange={(v) => { setSelectedPeriodId(String(v)); setGenerated(false) }}
                disabled={periodsLoading || selectedRestaurant === 'all'}
                className={selectedRestaurant === 'all' ? 'bg-slate-200 text-slate-400' : ''}
              />
              {periodsLoading && <p className="text-xs text-slate-400 mt-1">Loading periods...</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Restaurant</label>
              <DropdownSelect
                value={selectedRestaurant}
                options={[{ value: 'all', label: 'All Restaurants' }, { value: 'Lakay Ago', label: 'Lakay Ago' }, { value: 'Aroo', label: 'Aroo' }]}
                onChange={(v) => { setSelectedRestaurant(String(v)); setGenerated(false) }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Employee</label>
              <DropdownSelect
                value={selectedEmployeeId}
                options={[{ value: 'all', label: 'All Employees' }, ...employees.map((e) => ({ value: e.id, label: `${e.name} (${e.department})` }))]}
                onChange={(v) => { setSelectedEmployeeId(String(v)); setGenerated(false) }}
                disabled={periodsLoading || selectedRestaurant === 'all'}
                className={selectedRestaurant === 'all' ? 'bg-slate-200 text-slate-400' : ''}
              />
              {employeesLoading && <p className="text-xs text-slate-400 mt-1">Loading employees...</p>}
            </div>

            {/* Date range driven by selected payroll period only; removed custom date controls */}

            <button
              onClick={handleGenerate}
              disabled={generating || !selectedPeriodId}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded-lg font-display disabled:opacity-70"
            >
              {generating ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText size={14} /> Generate Report
                </>
              )}
            </button>
          </div>
        </div>

        {/* Report Result */}
        <div className="lg:col-span-2">
          {!generated ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm h-full flex items-center justify-center py-24">
              <div className="text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <BarChart3 size={28} className="text-slate-300" />
                </div>
                <p className="text-slate-400 font-display text-sm">Select a report type, period, and filters</p>
                <p className="text-slate-400 font-display text-sm">Click "Generate Report" to view results</p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Report header */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 font-display">{reportType}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {getPeriodLabel(selectedPeriodId)} · {selectedRestaurant === 'all' ? 'All Restaurants' : selectedRestaurant}
                    </p>
                  </div>
                  {/* Export buttons 
                  <div className="flex gap-2">
                    <button 
                      onClick={() => showToast({ type: 'success', message: 'Downloading Excel...', description: `${reportType}.xlsx` })}
                      className="flex items-center gap-1.5 text-xs font-medium border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 font-display"
                    >
                      <Download size={13} /> Excel
                    </button>
                    <button 
                      onClick={() => showToast({ type: 'success', message: 'Downloading PDF...', description: `${reportType}.pdf` })}
                      className="flex items-center gap-1.5 text-xs font-medium border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 font-display"
                    >
                      <Download size={13} /> PDF
                    </button>
                    <button className="flex items-center gap-1.5 text-xs font-medium border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 font-display">
                      <Printer size={13} /> Print
                    </button>
                  </div>
                  */}
                </div>

                {/* Chart */}
                {category === 'payroll' && (
                  <div>
                    {reportType === 'Payroll Summary' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white">
                          <p className="text-sm font-semibold text-slate-500 mb-2">Earnings</p>
                          <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                              <Pie data={payrollEarnings} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={(entry) => entry.name}>
                                {payrollEarnings.map((entry, idx) => (
                                  <Cell key={`e-${idx}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(v: any) => formatCurrency(v)} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="bg-white">
                          <p className="text-sm font-semibold text-slate-500 mb-2">Deductions</p>
                          <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                              <Pie data={payrollDeductions} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={(entry) => entry.name}>
                                {payrollDeductions.map((entry, idx) => (
                                  <Cell key={`d-${idx}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(v: any) => formatCurrency(v)} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-semibold text-slate-500 mb-2">{reportType === 'Earnings Report' ? 'Earnings' : reportType === 'Deduction Report' ? 'Deductions' : reportType}</p>
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie data={
                              reportType === 'Earnings Report' ? payrollEarnings
                                : reportType === 'Deduction Report' ? payrollDeductions
                                : reportType === 'Health Benefits Deduction' ? payrollDeductions.filter((d: any) => ['SSS','PhilHealth','Pag-Ibig'].includes(d.name))
                                : /* Other Deductions */ payrollDeductions.filter((d: any) => ['Undertime','Late','Cash Advance'].includes(d.name))
                            } dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(entry) => entry.name}>
                              {((reportType === 'Earnings Report' ? payrollEarnings
                                : reportType === 'Deduction Report' ? payrollDeductions
                                : reportType === 'Health Benefits Deduction' ? payrollDeductions.filter((d: any) => ['SSS','PhilHealth','Pag-Ibig'].includes(d.name))
                                : payrollDeductions.filter((d: any) => ['Undertime','Late','Cash Advance'].includes(d.name))) || []).map((entry: any, idx: number) => (
                                <Cell key={`p-${idx}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v: any) => formatCurrency(v)} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                )}

                {reportData.length > 0 && category === 'attendance' && reportType === 'Daily Attendance' && (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={reportData} stackOffset="sign">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="present" name="Present" fill="#10b981" />
                      <Bar dataKey="absent" name="Absent" fill="#ef4444" />
                      <Bar dataKey="on_leave" name="On Leave" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                )}

                {reportData.length > 0 && category === 'attendance' && reportType !== 'Daily Attendance' && (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={reportData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Table */}
              {!(category === 'payroll' && reportType === 'Payroll Summary') && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    {!isMobile ? (
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50">
                            {(() => {
                              let headers: string[] = []
                              if (category === 'payroll') {
                                if (reportType === 'Earnings Report') headers = ['Employee Name', 'Base Pay', 'Overtime Pay', 'Late Time Pay', 'Holiday Pay', ...(payrollIsSpecial ? ['13th Month Pay'] : [])]
                                else if (reportType === 'Deduction Report') headers = ['Employee Name', 'SSS', 'PhilHealth', 'Pag-Ibig', 'Undertime', 'Late', ...(payrollCashAdvanceTotal > 0 ? ['Cash Advance'] : [])]
                                else if (reportType === 'Health Benefits Deduction') headers = ['Employee Name', 'SSS', 'PhilHealth', 'Pag-Ibig']
                                else headers = ['Employee Name', 'Undertime', 'Late', ...(payrollCashAdvanceTotal > 0 ? ['Cash Advance'] : [])]
                              } else {
                                headers = getTableHeaders()
                              }
                              return headers.map(h => (
                                <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">{h}</th>
                              ))
                            })()}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {category === 'payroll' ? (
                            pagedData.map((r: any, i: number) => (
                              <tr key={r.employee_name || i} className="hover:bg-slate-50">
                                {reportType === 'Earnings Report' ? (
                                  <>
                                    <td className="py-3 px-4 text-sm font-medium text-slate-700 font-display">{r.employee_name}</td>
                                    <td className="py-3 px-4 font-mono text-xs text-slate-700">{formatCurrency(r.base_pay)}</td>
                                    <td className="py-3 px-4 font-mono text-xs text-slate-700">{formatCurrency(r.overtime_pay)}</td>
                                    <td className="py-3 px-4 font-mono text-xs text-slate-700">{formatCurrency(r.halfday_pay)}</td>
                                    <td className="py-3 px-4 font-mono text-xs text-slate-700">{formatCurrency(r.holiday_pay)}</td>
                                    {payrollIsSpecial && <td className="py-3 px-4 font-mono text-xs text-slate-700">{formatCurrency(r.special_month)}</td>}
                                  </>
                                ) : reportType === 'Deduction Report' ? (
                                  <>
                                    <td className="py-3 px-4 text-sm font-medium text-slate-700 font-display">{r.employee_name}</td>
                                    <td className="py-3 px-4 font-mono text-xs text-red-600">{formatCurrency(r.sss)}</td>
                                    <td className="py-3 px-4 font-mono text-xs text-red-600">{formatCurrency(r.philhealth)}</td>
                                    <td className="py-3 px-4 font-mono text-xs text-red-600">{formatCurrency(r.pagibig)}</td>
                                    <td className="py-3 px-4 font-mono text-xs text-red-600">{formatCurrency(r.undertime)}</td>
                                    <td className="py-3 px-4 font-mono text-xs text-red-600">{formatCurrency(r.late)}</td>
                                    {payrollCashAdvanceTotal > 0 && <td className="py-3 px-4 font-mono text-xs text-red-600">{formatCurrency(r.cash_advance)}</td>}
                                  </>
                                ) : reportType === 'Health Benefits Deduction' ? (
                                  <>
                                    <td className="py-3 px-4 text-sm font-medium text-slate-700 font-display">{r.employee_name}</td>
                                    <td className="py-3 px-4 font-mono text-xs text-red-600">{formatCurrency(r.sss)}</td>
                                    <td className="py-3 px-4 font-mono text-xs text-red-600">{formatCurrency(r.philhealth)}</td>
                                    <td className="py-3 px-4 font-mono text-xs text-red-600">{formatCurrency(r.pagibig)}</td>
                                  </>
                                ) : (
                                  // Other Deductions
                                  <>
                                    <td className="py-3 px-4 text-sm font-medium text-slate-700 font-display">{r.employee_name}</td>
                                    <td className="py-3 px-4 font-mono text-xs text-red-600">{formatCurrency(r.undertime)}</td>
                                    <td className="py-3 px-4 font-mono text-xs text-red-600">{formatCurrency(r.late)}</td>
                                    {payrollCashAdvanceTotal > 0 && <td className="py-3 px-4 font-mono text-xs text-red-600">{formatCurrency(r.cash_advance)}</td>}
                                  </>
                                )}
                              </tr>
                            ))
                          ) : (
                            // Attendance rows unchanged
                            pagedData.map((r: any, i: number) => (
                              <tr key={r.date || i} className="hover:bg-slate-50">
                                {reportType === 'Daily Attendance' ? (
                                  <>
                                    <td className="py-3 px-4 text-sm font-medium text-slate-700 font-display">{r.date}</td>
                                    <td className="py-3 px-4 font-mono text-xs text-emerald-700">{r.present}</td>
                                    <td className="py-3 px-4 font-mono text-xs text-red-600">{r.absent}</td>
                                    <td className="py-3 px-4 font-mono text-xs text-amber-700">{r.on_leave}</td>
                                  </>
                                ) : (
                                  <>
                                    <td className="py-3 px-4 text-sm font-medium text-slate-700 font-display">{r.date}</td>
                                    <td className="py-3 px-4 font-mono text-xs text-slate-700">{r.value}</td>
                                  </>
                                )}
                              </tr>
                            ))
                          )}
                          <tr className="bg-slate-50 border-t-2 border-slate-200">
                            {category === 'payroll' ? (
                              // Totals for payroll tables
                              reportType === 'Earnings Report' ? (
                                <>
                                  <td className="py-3 px-4 text-sm font-bold text-slate-800 font-display">Total</td>
                                  <td className="py-3 px-4 font-mono text-xs font-bold text-slate-700">{formatCurrency(reportData.reduce((a: number, b: any) => a + (b.base_pay || 0), 0))}</td>
                                  <td className="py-3 px-4 font-mono text-xs font-bold text-slate-700">{formatCurrency(reportData.reduce((a: number, b: any) => a + (b.overtime_pay || 0), 0))}</td>
                                  <td className="py-3 px-4 font-mono text-xs font-bold text-slate-700">{formatCurrency(reportData.reduce((a: number, b: any) => a + (b.halfday_pay || 0), 0))}</td>
                                  <td className="py-3 px-4 font-mono text-xs font-bold text-slate-700">{formatCurrency(reportData.reduce((a: number, b: any) => a + (b.holiday_pay || 0), 0))}</td>
                                  {payrollIsSpecial && <td className="py-3 px-4 font-mono text-xs font-bold text-slate-700">{formatCurrency(reportData.reduce((a: number, b: any) => a + (b.special_month || 0), 0))}</td>}
                                </>
                              ) : reportType === 'Deduction Report' ? (
                                <>
                                  <td className="py-3 px-4 text-sm font-bold text-slate-800 font-display">Total</td>
                                  <td className="py-3 px-4 font-mono text-xs font-bold text-red-600">{formatCurrency(reportData.reduce((a: number, b: any) => a + (b.sss || 0), 0))}</td>
                                  <td className="py-3 px-4 font-mono text-xs font-bold text-red-600">{formatCurrency(reportData.reduce((a: number, b: any) => a + (b.philhealth || 0), 0))}</td>
                                  <td className="py-3 px-4 font-mono text-xs font-bold text-red-600">{formatCurrency(reportData.reduce((a: number, b: any) => a + (b.pagibig || 0), 0))}</td>
                                  <td className="py-3 px-4 font-mono text-xs font-bold text-red-600">{formatCurrency(reportData.reduce((a: number, b: any) => a + (b.undertime || 0), 0))}</td>
                                  <td className="py-3 px-4 font-mono text-xs font-bold text-red-600">{formatCurrency(reportData.reduce((a: number, b: any) => a + (b.late || 0), 0))}</td>
                                  {payrollCashAdvanceTotal > 0 && <td className="py-3 px-4 font-mono text-xs font-bold text-red-600">{formatCurrency(reportData.reduce((a: number, b: any) => a + (b.cash_advance || 0), 0))}</td>}
                                </>
                              ) : reportType === 'Health Benefits Deduction' ? (
                                <>
                                  <td className="py-3 px-4 text-sm font-bold text-slate-800 font-display">Total</td>
                                  <td className="py-3 px-4 font-mono text-xs font-bold text-red-600">{formatCurrency(reportData.reduce((a: number, b: any) => a + (b.sss || 0), 0))}</td>
                                  <td className="py-3 px-4 font-mono text-xs font-bold text-red-600">{formatCurrency(reportData.reduce((a: number, b: any) => a + (b.philhealth || 0), 0))}</td>
                                  <td className="py-3 px-4 font-mono text-xs font-bold text-red-600">{formatCurrency(reportData.reduce((a: number, b: any) => a + (b.pagibig || 0), 0))}</td>
                                </>
                              ) : (
                                // Other Deductions totals
                                <>
                                  <td className="py-3 px-4 text-sm font-bold text-slate-800 font-display">Total</td>
                                  <td className="py-3 px-4 font-mono text-xs font-bold text-red-600">{formatCurrency(reportData.reduce((a: number, b: any) => a + (b.undertime || 0), 0))}</td>
                                  <td className="py-3 px-4 font-mono text-xs font-bold text-red-600">{formatCurrency(reportData.reduce((a: number, b: any) => a + (b.late || 0), 0))}</td>
                                  {payrollCashAdvanceTotal > 0 && <td className="py-3 px-4 font-mono text-xs font-bold text-red-600">{formatCurrency(reportData.reduce((a: number, b: any) => a + (b.cash_advance || 0), 0))}</td>}
                                </>
                              )
                            ) : (
                              reportType === 'Daily Attendance' ? (
                                <>
                                  <td className="py-3 px-4 text-sm font-bold text-slate-800 font-display">Total</td>
                                  <td className="py-3 px-4 font-mono text-xs font-bold text-emerald-700">{reportData.reduce((a: number, b: any) => a + (b.present || 0), 0)}</td>
                                  <td className="py-3 px-4 font-mono text-xs font-bold text-red-600">{reportData.reduce((a: number, b: any) => a + (b.absent || 0), 0)}</td>
                                  <td className="py-3 px-4 font-mono text-xs font-bold text-amber-700">{reportData.reduce((a: number, b: any) => a + (b.on_leave || 0), 0)}</td>
                                </>
                              ) : (
                                <>
                                  <td className="py-3 px-4 text-sm font-bold text-slate-800 font-display">Total</td>
                                  <td className="py-3 px-4 font-mono text-xs font-bold text-slate-700">{reportData.reduce((a: number, b: any) => a + (b.value || 0), 0)}</td>
                                </>
                              )
                            )}
                          </tr>
                        </tbody>
                      </table>
                    ) : (
                      <div className="flex flex-col">
                        {pagedData.map((r: any, i: number) => (
                          <button key={r.employee_name || r.date || i} onClick={() => setSelectedDept(r)} className="text-left p-3 border-b border-slate-50 hover:bg-slate-50 flex items-center justify-between gap-3">
                            <div>
                              {category === 'payroll' ? (
                                <>
                                  <div className="text-sm font-semibold text-slate-700 font-display">{r.employee_name}</div>
                                  <div className="text-xs text-slate-400">{reportType}</div>
                                </>
                              ) : reportType === 'Daily Attendance' ? (
                                <>
                                  <div className="text-sm font-semibold text-slate-700 font-display">{r.date}</div>
                                  <div className="text-xs text-slate-400">Present: {r.present} · Absent: {r.absent} · On leave: {r.on_leave}</div>
                                </>
                              ) : (
                                <>
                                  <div className="text-sm font-semibold text-slate-700 font-display">{r.date}</div>
                                  <div className="text-xs text-slate-400">{(getTableHeaders()[1] || 'Value')}: {r.value}</div>
                                </>
                              )}
                            </div>
                            <div className="text-sm font-mono text-emerald-700">{category === 'payroll' ? formatCurrency(((r.base_pay || 0) + (r.overtime_pay || 0) + (r.halfday_pay || 0) + (r.holiday_pay || 0) + (r.special_month || 0))) : (reportType === 'Daily Attendance' ? r.present : r.value)}</div>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-white rounded-b-xl">
                      <p className="text-xs text-slate-500">
                        Showing {reportData.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, reportData.length)} of {reportData.length}
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                        >
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
                              className={`w-7 h-7 rounded-lg text-xs font-medium font-display ${page === p ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                            >
                              {p}
                            </button>
                          )
                        })}
                        <button
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}