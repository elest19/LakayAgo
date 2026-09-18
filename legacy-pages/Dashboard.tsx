'use client'
import dynamic from 'next/dynamic'
import { useEffect, useState, useMemo } from 'react'
import { useApp } from '../App'
import useIsMobile from '../hooks/isMobile'
import {
  Users, UserCheck, AlertTriangle, Clock, TrendingUp, TrendingDown,
  ArrowRight, CheckCircle2, Circle, FileText, Activity,
  Eye, HeartPulse
} from 'lucide-react'
import DateFilter, { defaultDateFilterValue, resolveDateRange, type DateFilterValue } from '../components/DateFilter'

const ChartPlaceholder = ({ height = 180 }: { height?: number }) => (
  <div
    className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-400"
    style={{ height }}
  >
    Loading chart…
  </div>
)

const BarChart = dynamic(() => import('recharts').then((mod) => mod.BarChart), { ssr: false, loading: () => <ChartPlaceholder /> })
const Bar = dynamic(() => import('recharts').then((mod) => mod.Bar), { ssr: false, loading: () => null })
const LineChart = dynamic(() => import('recharts').then((mod) => mod.LineChart), { ssr: false, loading: () => <ChartPlaceholder /> })
const Line = dynamic(() => import('recharts').then((mod) => mod.Line), { ssr: false, loading: () => null })
const XAxis = dynamic(() => import('recharts').then((mod) => mod.XAxis), { ssr: false, loading: () => null })
const YAxis = dynamic(() => import('recharts').then((mod) => mod.YAxis), { ssr: false, loading: () => null })
const CartesianGrid = dynamic(() => import('recharts').then((mod) => mod.CartesianGrid), { ssr: false, loading: () => null })
const Tooltip = dynamic(() => import('recharts').then((mod) => mod.Tooltip), { ssr: false, loading: () => null })
const ResponsiveContainer = dynamic(() => import('recharts').then((mod) => mod.ResponsiveContainer), { ssr: false, loading: () => <ChartPlaceholder /> })

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(n)

const StatCard = ({
  label, value, sub, icon, color, trend
}: {
  label: string; value: string; sub?: string; icon: React.ReactNode
  color: string; trend?: { dir: 'up' | 'down'; text: string }
}) => {
  const isMobile = useIsMobile()
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
        {trend && (
          <span className={`flex items-center gap-1 text-xs font-medium ${trend.dir === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>
          </span>
        )}
      </div>
      {isMobile ? (
        <p className="text-md font-bold text-slate-800 font-display">{value}</p>
      ) : (
        <p className="text-xl font-bold text-slate-800 font-display">{value}</p>
      )}
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  )
}

const formatDateRange = (start: string | null | undefined, end: string | null | undefined) => {
  if (!start || !end) return 'No active period'

  try {
    const startDate = new Date(start)
    const endDate = new Date(end)
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 'No active period'

    const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return `${formatter.format(startDate)} – ${formatter.format(endDate)}`
  } catch {
    return 'No active period'
  }
}

const isTrueLike = (value: any) => value === true || value === 'true' || value === 'TRUE' || value === 1 || value === '1'

const RECENT_ACTIVITY_LIMIT = 5

// --- Dashboard loading skeleton (mirrors the real layout: cards, panels, charts) ---

function SkeletonBlock({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`bg-slate-200 animate-pulse rounded-md ${className}`} style={style} />
}

function SkeletonStatCard() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <SkeletonBlock className="w-10 h-10 rounded-lg" />
      </div>
      <SkeletonBlock className="h-6 w-24 mb-2" />
      <SkeletonBlock className="h-3 w-20" />
    </div>
  )
}

function SkeletonPanelCard({ rows = 5, className = '' }: { rows?: number; className?: string }) {
  const widths = ['w-full', 'w-5/6', 'w-4/5', 'w-11/12', 'w-3/4', 'w-2/3']
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-5 shadow-sm ${className}`}>
      <SkeletonBlock className="h-4 w-36 mb-5" />
      <div className="space-y-3.5">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <SkeletonBlock className="w-7 h-7 rounded-lg shrink-0" />
            <SkeletonBlock className={`h-3.5 ${widths[i % widths.length]}`} />
          </div>
        ))}
      </div>
    </div>
  )
}

function SkeletonChartCard({ height = 180, bars = 8 }: { height?: number; bars?: number }) {
  const heights = [45, 70, 55, 85, 60, 90, 50, 75, 65, 40]
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <SkeletonBlock className="h-4 w-40 mb-1.5" />
      <SkeletonBlock className="h-3 w-56 mb-4" />
      <div className="flex items-end gap-2" style={{ height }}>
        {Array.from({ length: bars }, (_, i) => (
          <SkeletonBlock key={i} className="flex-1 rounded-t-md" style={{ height: `${heights[i % heights.length]}%` }} />
        ))}
      </div>
    </div>
  )
}

function DashboardSkeleton({ isMobile }: { isMobile: boolean }) {
  return (
    <div className="space-y-6">
      {/* Stat cards */}
      {isMobile ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }, (_, i) => <SkeletonStatCard key={i} />)}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }, (_, i) => <SkeletonStatCard key={i} />)}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
          {Array.from({ length: 8 }, (_, i) => <SkeletonStatCard key={i} />)}
        </div>
      )}

      {/* Payroll Period Progress + Recent Activity panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SkeletonPanelCard rows={6} />
        <div className="lg:col-span-2">
          <SkeletonPanelCard rows={5} />
        </div>
      </div>

      {/* Attendance + Overtime charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SkeletonChartCard height={180} bars={8} />
        <SkeletonChartCard height={120} bars={8} />
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-1 font-display">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="flex gap-1">
          <span className="capitalize">{p.name}:</span>
          <span className="font-medium">
            {typeof p.value === 'number' && p.value > 1000 ? fmt(p.value) : p.value}
          </span>
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { navigate, appMode } = useApp()
  const isMobile = useIsMobile()
  const currentRestaurant = appMode === 'aroo' ? 'Aroo' : 'Lakay Ago'

  const [attendanceRows, setAttendanceRows] = useState<Array<any>>([])
  const [employeeCount, setEmployeeCount] = useState(0)
  const [expectedPresent, setExpectedPresent] = useState(0)
  const [presentToday, setPresentToday] = useState(0)
  const [absentToday, setAbsentToday] = useState(0)
  const [pendingLeaveRequests, setPendingLeaveRequests] = useState(0)
  const [latestPeriod, setLatestPeriod] = useState<any | null>(null)
  const [recentActivity, setRecentActivity] = useState<Array<any>>([])
  const [reportPeriods, setReportPeriods] = useState<Array<any>>([])
  const [payslips, setPayslips] = useState<Array<any>>([])
  const [selectedRestaurant, setSelectedRestaurant] = useState(currentRestaurant)
  const [selectedPeriodId, setSelectedPeriodId] = useState('all')
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(defaultDateFilterValue())
  const [loading, setLoading] = useState(true)

  useEffect(() => { setSelectedRestaurant(currentRestaurant) }, [currentRestaurant])

  const renderActivityRows = (list: Array<any>) =>
    list.length > 0 ? list.map((item, i) => (
      <div key={`${item.msg}-${i}`} className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50 cursor-pointer">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${item.color}`}>
          {item.icon}
        </div>
        <div className="flex-1 min-w-0 lg:col-span-2">
          <p className="text-sm font-medium text-slate-700 font-display">{item.msg}</p>
          <p className="text-xs text-slate-400 truncate">{item.sub}</p>
        </div>
        <span className="text-xs text-slate-400 shrink-0">{item.time}</span>
      </div>
    )) : (
      <div className="px-5 py-6 text-sm text-slate-500">No recent activity found in the database yet.</div>
    )


  const dateRange = useMemo(() => resolveDateRange(dateFilter), [dateFilter])
  const selectedPeriod = useMemo(
    () => reportPeriods.find((period: any) => String(period.report_period_id) === selectedPeriodId) ?? null,
    [reportPeriods, selectedPeriodId],
  )

  useEffect(() => {
    let mounted = true

    const params = new URLSearchParams()
    params.set('restaurant', selectedRestaurant)
    const reportPeriodsUrl = `/api/report_periods?${params.toString()}`

    fetch(reportPeriodsUrl)
      .then(async (res) => {
        if (!res.ok) return []
        const data = await res.json()
        return Array.isArray(data.periods) ? data.periods : []
      })
      .then((periods) => {
        if (!mounted) return
        setReportPeriods(periods)
        if (selectedPeriodId !== 'all' && !periods.some((period: any) => String(period.report_period_id) === selectedPeriodId)) {
          setSelectedPeriodId('all')
        }
      })
      .catch(() => {
        if (mounted) setReportPeriods([])
      })

    return () => { mounted = false }
  }, [selectedRestaurant, selectedPeriodId])

  useEffect(() => {
    let mounted = true

    const employeeParams = new URLSearchParams()
    employeeParams.set('restaurant', selectedRestaurant)
    const employeeUrl = `/api/employees?${employeeParams.toString()}`

    const attendanceParams = new URLSearchParams()
    attendanceParams.set('restaurant', selectedRestaurant)
    const effectiveRange = selectedPeriod ? { start: selectedPeriod.period_start, end: selectedPeriod.period_end } : dateRange
    if (effectiveRange) {
      attendanceParams.set('from', effectiveRange.start)
      attendanceParams.set('to', effectiveRange.end)
    }
    const attendanceUrl = attendanceParams.toString() ? `/api/attendance?${attendanceParams.toString()}` : '/api/attendance'

    const payslipsParams = new URLSearchParams()
    payslipsParams.set('restaurant', selectedRestaurant)
    if (selectedPeriodId !== 'all') payslipsParams.set('period_id', String(selectedPeriodId))
    const payslipsUrl = `/api/payslips?${payslipsParams.toString()}`

    Promise.all([
      fetch(employeeUrl),
      fetch('/api/leave_requests'),
      fetch(attendanceUrl),
      fetch(payslipsUrl),
    ])
      .then(async ([employeesRes, leaveRes, attendanceRes, payslipsRes]) => {
        if (!mounted) return

        const employeePayload = employeesRes.ok ? await employeesRes.json() : { employees: [] }
        const leavePayload = leaveRes.ok ? await leaveRes.json() : { leaveRequests: [] }
        const attendancePayload = attendanceRes.ok ? await attendanceRes.json() : { attendance: [] }
        const payslipPayload = payslipsRes.ok ? await payslipsRes.json() : { payslips: [] }

        const employees = Array.isArray(employeePayload.employees) ? employeePayload.employees : []
        const leaveRequests = Array.isArray(leavePayload.leaveRequests) ? leavePayload.leaveRequests : []
        const attendance = Array.isArray(attendancePayload.attendance) ? attendancePayload.attendance : []
        const payslipRows = Array.isArray(payslipPayload.payslips) ? payslipPayload.payslips : []

        const filteredAttendance = attendance.filter((row: any) => {
          const workDate = String(row.work_date ?? row.date ?? '').slice(0, 10)
          return effectiveRange ? workDate >= effectiveRange.start && workDate <= effectiveRange.end : true
        })

        const presentNow = filteredAttendance.filter((row: any) => !isTrueLike(row.is_absent)).length
        const absentCountFromAttendance = filteredAttendance.filter((row: any) => isTrueLike(row.is_absent)).length

        const pendingLeaveCount = leaveRequests.filter((entry: any) => String(entry.status ?? '').toLowerCase() === 'pending').length
        const latest = reportPeriods.find((period: any) => String(period.restaurant || '') === selectedRestaurant)
          ?? reportPeriods[0] ?? null

        const activity = [
          ...(leaveRequests.slice(0, 3).map((item: any) => ({
            icon: <FileText size={14} />,
            msg: `Leave request: ${String(item.status ?? 'Pending')}`,
            sub: `${item.employeeName || 'Employee'} • ${item.leaveType || 'Leave'} • ${item.status || 'Pending'}`,
            time: item.startDate || 'Recently',
            color: 'bg-violet-100 text-violet-600',
          }))),
          ...(latest ? [{
            icon: <CheckCircle2 size={14} />,
            msg: 'Latest payroll period available',
            sub: `${formatDateRange(latest.period_start, latest.period_end)} • ${latest.status || 'Open'}`,
            time: 'Current',
            color: 'bg-emerald-100 text-emerald-600',
          }] : []),
        ].slice(0, RECENT_ACTIVITY_LIMIT)

        setAttendanceRows(filteredAttendance)
        setEmployeeCount(employees.filter((emp: any) => {
          const status = String(emp.status ?? 'Active').toLowerCase()
          return status !== 'inactive' && status !== 'fired'
        }).length)
        setExpectedPresent(employees.filter((emp: any) => {
          const status = String(emp.status ?? 'Active').toLowerCase()
          return status !== 'inactive' && status !== 'fired'
        }).length)
        setPresentToday(presentNow)
        setAbsentToday(absentCountFromAttendance)
        setPendingLeaveRequests(pendingLeaveCount)
        setPayslips(payslipRows)
        setLatestPeriod(latest)
        setRecentActivity(activity)
        setLoading(false)
      })
      .catch(() => {
        setAttendanceRows([])
        setEmployeeCount(0)
        setExpectedPresent(0)
        setPresentToday(0)
        setAbsentToday(0)
        setPendingLeaveRequests(0)
        setPayslips([])
        setLatestPeriod(null)
        setRecentActivity([])
        setLoading(false)
      })

    return () => { mounted = false }
  }, [selectedRestaurant, selectedPeriodId, dateRange, reportPeriods])

  const currentAttendanceRate = expectedPresent > 0 ? ((presentToday / expectedPresent) * 100) : 0
  const absentCount = Math.max(absentToday, 0)

  const payrollStatusPeriod = useMemo(() => {
    const rows = reportPeriods.filter((period: any) => !period.restaurant || String(period.restaurant) === selectedRestaurant)
    if (rows.length === 0) return null

    return rows.reduce((latest: any, period: any) => {
      const currentDate = new Date(period.period_start).getTime()
      const latestDate = new Date(latest.period_start).getTime()
      return Number.isFinite(currentDate) && Number.isFinite(latestDate) && currentDate > latestDate ? period : latest
    }, rows[0])
  }, [reportPeriods, selectedRestaurant])

  const payrollTotals = useMemo(() => {
    const totals = payslips.reduce((sum, row) => {
      sum.gross += Number(row.gross_pay ?? 0)
      sum.net += Number(row.net_pay ?? 0)
      sum.deductions += Number(row.total_deduction ?? 0)
      sum.health += Number(row.sss_deduction ?? 0)
        + Number(row.philhealth_deduction ?? 0)
        + Number(row.pagibig_deduction ?? 0)
      return sum
    }, { gross: 0, net: 0, deductions: 0, health: 0 })

    return totals
  }, [payslips])

  const payrollGross = payrollTotals.gross
  const payrollNet = payrollTotals.net
  const payrollDeductions = payrollTotals.deductions
  const healthDeductions = payrollTotals.health
  const payrollPeriodLabel = payrollStatusPeriod ? formatDateRange(payrollStatusPeriod.period_start, payrollStatusPeriod.period_end) : 'No period available'
  const payrollStatus = payrollStatusPeriod?.status ? String(payrollStatusPeriod.status) : 'Open'

  const payrollProgressState = useMemo(() => {
    const status = String(payrollStatusPeriod?.status ?? '').trim().toLowerCase()

    if (status === 'pending') {
      return {
        attendanceImported: false,
        attendanceValidated: false,
        payrollCalculation: false,
        payrollReview: false,
        payrollApproval: false,
        payslips: false,
      }
    }

    if (status === 'under review') {
      return {
        attendanceImported: presentToday > 0,
        attendanceValidated: employeeCount > 0,
        payrollCalculation: false,
        payrollReview: false,
        payrollApproval: false,
        payslips: false,
      }
    }

    if (status === 'reviewed') {
      return {
        attendanceImported: presentToday > 0,
        attendanceValidated: employeeCount > 0,
        payrollCalculation: payrollNet > 0,
        payrollReview: false,
        payrollApproval: false,
        payslips: false,
      }
    }

    if (status === 'released') {
      return {
        attendanceImported: presentToday > 0,
        attendanceValidated: employeeCount > 0,
        payrollCalculation: payrollNet > 0,
        payrollReview: true,
        payrollApproval: true,
        payslips: true,
      }
    }

    return {
      attendanceImported: false,
      attendanceValidated: false,
      payrollCalculation: false,
      payrollReview: false,
      payrollApproval: false,
      payslips: false,
    }
  }, [payrollStatusPeriod, presentToday, employeeCount, payrollNet])

  // The stage the payroll period is currently in — derived from its status.
  // 'Pending' means nothing has started yet, so no step is active.
  const activeStepLabel: string | null = (() => {
    const s = String(payrollStatusPeriod?.status ?? '').trim().toLowerCase()
    if (s === 'attendance imported' || s === 'validation required' || s === 'pending') return 'Attendance Validated'
    if (s === 'under review' || s === 'ready for payroll' || s === 'calculated' || s === 'calculation') return 'Payroll Calculation'
    if (s === 'reviewed') return 'Payroll Review'
    if (s === 'approved' || s === 'released') return 'Payslips'
    return null
  })()

  const payrollSteps = [
    { label: 'Attendance Imported', done: payrollProgressState.attendanceImported, active: activeStepLabel === 'Attendance Imported' },
    { label: 'Attendance Validated', done: payrollProgressState.attendanceValidated, active: activeStepLabel === 'Attendance Validated' },
    { label: 'Payroll Calculation', done: payrollProgressState.payrollCalculation, active: activeStepLabel === 'Payroll Calculation' },
    { label: 'Payroll Review', done: payrollProgressState.payrollReview, active: activeStepLabel === 'Payroll Review' },
    { label: 'Payroll Approval', done: payrollProgressState.payrollApproval, active: activeStepLabel === 'Payroll Approval' },
    { label: 'Payslips', done: payrollProgressState.payslips, active: activeStepLabel === 'Payslips' },
  ]

  // Charts driven by the selected payroll period: per-day breakdown of attendance rows.
  const attendanceChartData = useMemo(() => {
    const byDate = new Map<string, { present: number; absent: number }>()
    attendanceRows.forEach((row: any) => {
      const day = String(row.work_date ?? row.date ?? '').slice(0, 10)
      if (!day) return

      // Present requires an actual Time In + Time Out pair (weekend work is
      // optional but those employees still count as Present when they clock in).
      const timeIn = String(row.first_on_duty ?? row.timeIn ?? '').trim()
      const timeOut = String(row.first_off_duty ?? row.timeOut ?? '').trim()
      const hasTimeInOut = timeIn !== '' && timeOut !== ''

      // 0 = Sunday, 6 = Saturday — rest days. Parsed from parts to avoid
      // timezone shifts from UTC date parsing.
      const [year, month, dateNum] = day.split('-').map(Number)
      const dayOfWeek = new Date(year, (month || 1) - 1, dateNum || 1).getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

      const entry = byDate.get(day) ?? { present: 0, absent: 0 }

      if (hasTimeInOut) {
        entry.present += 1
        byDate.set(day, entry)
        return
      }

      // Rest days are neither Present nor Absent unless the employee worked.
      if (isWeekend) return

      if (isTrueLike(row.is_absent)) {
        entry.absent += 1
        byDate.set(day, entry)
      }
    })

    const days = Array.from(byDate.keys()).sort()
    const sameMonth = days.length > 0 && days.every(d => d.slice(0, 7) === days[0].slice(0, 7))
    return days.map(day => {
      const entry = byDate.get(day)!
      return {
        day: sameMonth ? String(Number(day.slice(8, 10))) : `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`,
        present: entry.present,
        absent: entry.absent,
      }
    })
  }, [attendanceRows])

  const overtimeData = useMemo(() => {
    const byDate = new Map<string, number>()
    attendanceRows.forEach((row: any) => {
      const day = String(row.work_date ?? row.date ?? '').slice(0, 10)
      if (!day) return
      byDate.set(day, (byDate.get(day) ?? 0) + Math.max(0, Number(row.overtime_minutes ?? 0) || 0))
    })

    const days = Array.from(byDate.keys()).sort()
    const sameMonth = days.length > 0 && days.every(d => d.slice(0, 7) === days[0].slice(0, 7))
    return days.map(day => ({
      day: sameMonth ? String(Number(day.slice(8, 10))) : `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`,
      hours: Math.round((byDate.get(day) ?? 0) / 60),
    }))
  }, [attendanceRows])

  const highestOvertime = overtimeData.reduce((max, item) => Number(item.hours ?? 0) > Number(max.hours ?? 0) ? item : max, { day: 'N/A', hours: 0 })
  const overtimeHighlight = highestOvertime && highestOvertime.day !== 'N/A'
    ? `Day ${highestOvertime.day}: ${Number(highestOvertime.hours).toFixed(0)} hrs — highest in the selected period`
    : 'No overtime data available yet'

  return (
    <div className="p-6 space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-semibold text-slate-800 font-display">Filters</p>
          <div className="flex items-center gap-2">
            <select
              value={selectedPeriodId}
              onChange={(event) => setSelectedPeriodId(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400"
            >
              <option value="all">All Periods</option>
              {reportPeriods
                .filter((period: any) => !period.restaurant || String(period.restaurant) === selectedRestaurant)
                .map((period: any) => (
                  <option key={period.report_period_id} value={String(period.report_period_id)}>
                    {period.period_start} – {period.period_end}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <DashboardSkeleton isMobile={isMobile} />
      ) : (
        <>
      {isMobile ? (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Employees" value={String(employeeCount)} icon={<Users size={18} className="text-indigo-600" />} color="bg-indigo-50" />
            <StatCard label="Present" value={`${presentToday}`} sub={`${currentAttendanceRate.toFixed(1)}% attendance rate`} icon={<UserCheck size={18} className="text-emerald-600" />} color="bg-emerald-50" />
            <StatCard label="Absent" value={`${absentCount}`} icon={<AlertTriangle size={18} className="text-amber-600" />} color="bg-amber-50" />
            <StatCard label="Pending Leave Requests" value={String(pendingLeaveRequests)} icon={<Clock size={18} className="text-violet-600" />} color="bg-violet-50" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Gross Payroll" value={fmt(payrollGross)} sub={payrollPeriodLabel} icon={<TrendingUp size={18} className="text-blue-600" />} color="bg-blue-50" trend={{ dir: 'up', text: '+0.7%' }} />
            <StatCard label="Total Deductions" value={fmt(payrollDeductions)} icon={<TrendingDown size={18} className="text-red-500" />} color="bg-red-50" />
            <StatCard label="Net Payroll" value={fmt(payrollNet)} icon={<CheckCircle2 size={18} className="text-emerald-600" />} color="bg-emerald-50" />
            <StatCard label="Health Deductions" value={fmt(healthDeductions)} sub={payrollPeriodLabel} icon={<HeartPulse size={18} className="text-rose-600" />} color="bg-rose-50" />
          </div>

          {/* Payroll Period Progress + Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Payroll Period Progress */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Current Payroll Period</p>
                  <p className="text-lg font-bold text-slate-800 mt-0.5 font-display">{payrollPeriodLabel}</p>
                  <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full mt-1">
                    {payrollStatus || 'Open'}
                  </span>
                </div>
              </div>
              <div className="space-y-2.5">
                {payrollSteps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    {step.done ? (
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    ) : step.active ? (
                      <div className="w-4 h-4 rounded-full border-2 border-indigo-600 flex items-center justify-center shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                      </div>
                    ) : (
                      <Circle size={16} className="text-slate-300 shrink-0" />
                    )}
                    <span className={`text-sm font-display ${step.done ? 'text-slate-600' : step.active ? 'text-indigo-600 font-semibold' : 'text-slate-400'}`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate('process-payroll')}
                className="mt-5 w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded-lg font-display flex items-center justify-center gap-2"
              >
                Continue Payroll <ArrowRight size={14} />
              </button>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm lg:col-span-2">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-800 font-display">Recent Activity</p>
                <button
                  onClick={() => navigate('audit-logs')}
                  className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline font-display"
                >
                  <Eye size={14} /> View more...
                </button>
              </div>
              <div className="divide-y divide-slate-50">
                {renderActivityRows(recentActivity.slice(0, RECENT_ACTIVITY_LIMIT))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
        <div className="grid grid-cols-2 gap-2"> 
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
            <StatCard label="Total Employees" value={String(employeeCount)} icon={<Users size={18} className="text-indigo-600" />} color="bg-indigo-50" />
            <StatCard label="Present" value={`${presentToday}`} sub={`${currentAttendanceRate.toFixed(1)}% attendance rate`} icon={<UserCheck size={18} className="text-emerald-600" />} color="bg-emerald-50" />
            <StatCard label="Absent" value={`${absentCount}`} icon={<AlertTriangle size={18} className="text-amber-600" />} color="bg-amber-50" />
            <StatCard label="Pending Leave Requests" value={String(pendingLeaveRequests)} icon={<Clock size={18} className="text-violet-600" />} color="bg-violet-50" />
            <StatCard label="Gross Payroll" value={fmt(payrollGross)} sub={payrollPeriodLabel} icon={<TrendingUp size={18} className="text-blue-600" />} color="bg-blue-50" trend={{ dir: 'up', text: '+0.7%' }} />
            <StatCard label="Net Payroll" value={fmt(payrollNet)} icon={<CheckCircle2 size={18} className="text-emerald-600" />} color="bg-emerald-50" />
            <StatCard label="Total Deductions" value={fmt(payrollDeductions)} icon={<TrendingDown size={18} className="text-red-500" />} color="bg-red-50" />
            <StatCard label="Health Deductions" value={fmt(healthDeductions)} sub={payrollPeriodLabel} icon={<HeartPulse size={18} className="text-rose-600" />} color="bg-rose-50" />
          </div>

        
          <div className="grid grid-cols-1 gap-2 items">
            {/* Recent Activity */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm ">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-800 font-display">Recent Activity</p>
                <button
                  onClick={() => navigate('audit-logs')}
                  className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline font-display"
                >
                  <Eye size={14} /> View more...
                </button>
              </div>
              <div className="divide-y divide-slate-50">
                {renderActivityRows(recentActivity.slice(0, RECENT_ACTIVITY_LIMIT))}
              </div>
            </div>
            {/* Payroll Period Progress */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Current Payroll Period</p>
                  <p className="text-lg font-bold text-slate-800 mt-0.5 font-display">{payrollPeriodLabel}</p>
                  <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full mt-1">
                    {payrollStatus || 'Open'}
                  </span>
                </div>
              </div>
              <div className="space-y-2.5">
                {payrollSteps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    {step.done ? (
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    ) : step.active ? (
                      <div className="w-4 h-4 rounded-full border-2 border-indigo-600 flex items-center justify-center shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                      </div>
                    ) : (
                      <Circle size={16} className="text-slate-300 shrink-0" />
                    )}
                    <span className={`text-sm font-display ${step.done ? 'text-slate-600' : step.active ? 'text-indigo-600 font-semibold' : 'text-slate-400'}`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate('process-payroll')}
                className="mt-5 w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded-lg font-display flex items-center justify-center gap-2"
              >
                Continue Payroll <ArrowRight size={14} />
              </button>
            </div>
            

            </div>
          </div>
        </>
      )}

      {/* Middle row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Attendance Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-slate-800 font-display">Attendance</p>
                <p className="text-xs text-slate-400">Present vs Absent per day (selected payroll period)</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />Present</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" />Absent</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={attendanceChartData} barSize={14} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="present" name="present" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="absent" name="absent" fill="#f87171" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

        {/* Overtime Hours */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-800 font-display mb-1">Overtime Hours</p>
          <p className="text-xs text-slate-400 mb-3">Total overtime hours per day (selected payroll period)</p>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={overtimeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="hours" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-500 mt-2">{overtimeHighlight}</p>
        </div>
      </div>
        </>
      )}
    </div>
  )
}