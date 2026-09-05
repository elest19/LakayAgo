'use client'
import { useEffect, useState, useRef } from 'react'
import { CheckCircle2, Circle, AlertTriangle, ChevronRight, X, Search, ChevronDown } from 'lucide-react'
import { useApp } from '../App'
import useIsMobile from '../hooks/isMobile'
import Modal from '../components/Modal'
import WorkflowStepper from '../components/WorkflowStepper'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0)

const fmtMinutes = (n: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(Number.isFinite(n) ? n : 0)

const formatIsoToShort = (iso?: string) => {
  if (!iso) return ''
  const s = String(iso).slice(0,10)
  const parts = s.split('-')
  if (parts.length !== 3) return s
  const [y, m, d] = parts
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const mi = Number(m) - 1
  return `${months[mi] ?? m} ${Number(d)}, ${y}`
}

type Step = 'attendance' | 'calculation' | 'review' | 'approved'

type PayrollRow = {
  employee_id: number | string
  employee_name: string
  pay_per_day: number
  present_total: number
  absent_total: number
  on_leave_total: number
  paid_leave_pay: number
  special_month?: number
  special_month_pay?: number
  halfday_total: number
  worked_minutes_total: number
  overtime_minutes_total: number
  late_minutes_total: number
  undertime_minutes_total: number
  required_daily_minutes: number
  required_daily_hours: number
  undertime_deduction_total: number
  undertime_deduction_rate_type: string
  undertime_deduction: number
  undertime_deduction_rate: number
  rate_in_minutes: number
  deductions: number
  net_pay: number
  holiday_pay?: number
  gross_pay: number
  overtime_pay: number
  halfday_payment: number
  health_deduction: number
  sss_deduction: number
  philhealth_deduction: number
  pagibig_deduction: number
  sum_late_min: number
  gross_base: number
  attendance_deduction: number
  total_deduction: number
  employee_department?: string
  emp: {
    id: number | string
    firstName: string
    lastName: string
    department: string
  }
  cash_advance_deduction?: number
  // override support
  original_net_pay?: number
  net_pay_overridden?: boolean
}

const payrollWorkflowSteps = [
  { id: 'file-upload', label: 'File Upload', description: 'Initial file' },
  { id: 'attendance-validation', label: 'Attendance Validation', description: 'Check records' },
  { id: 'attendance-import', label: 'Attendance Import', description: 'Load attendance' },
  { id: 'calculation', label: 'Calculation', description: 'Compute payroll' },
  { id: 'review', label: 'Review', description: 'Verify values' },
  { id: 'approval', label: 'Approval', description: 'Approve batch' },
  { id: 'payslip', label: 'Payslip', description: 'Finalize payslips' },
]

const stepToIndex: Record<Step, number> = {
  attendance: 2,
  calculation: 3,
  review: 4,
  approved: 6,
}

// Use backend payroll calculate endpoint when activePayrollPeriod is set

function PayrollBreakdownModal({ row, onClose }: { row: any; onClose: () => void }) {
  const { openEmployee } = useApp()
  const [openItem, setOpenItem] = useState<string | null>(null)
  const displayName = row.employee_name || `${row.emp?.firstName || ''} ${row.emp?.lastName || ''}`.trim() || 'Employee'
  const regularHours = row.pay_per_day > 0 ? Math.max(0, (Number(row.gross_base || 0) / row.pay_per_day) * 8) : 0

  const payPerDay = Number(row.pay_per_day || 0)
  const basePay = Number(row.gross_base || 0)
  const overtimePay = Number(row.overtime_pay || 0)
  const halfdayPay = Number(row.halfday_payment || 0)
  const holidayPay = Number(row.holiday_pay || row.holiday_payment || row.holidayPay || 0)
  const paidLeavePay = Number(row.paid_leave_pay || 0)
  const specialMonthPay = Number(row.special_month ?? row.special_month_pay ?? 0)
  const undertimeDeductionValue = Number(row.undertime_deduction_total || 0)
  const lateDeductionValue = Number(row.sum_late_min || 0)
  const healthDeduction = Number(row.health_deduction || 0)
  const workedMinutes = Number(row.worked_minutes_total || 0)
  const overtimeMinutes = Number(row.overtime_minutes_total || 0)
  const halfdayTotal = Number(row.halfday_total || 0)
  const undertimeMinutes = Number(row.undertime_minutes_total || 0)
  const lateMinutes = Number(row.late_minutes_total || 0)
  const requiredHours = Number(row.required_daily_hours || 8)
  const sssAmount = Number(row.sss_deduction || 0)
  const philhealthAmount = Number(row.philhealth_deduction || 0)
  const pagibigAmount = Number(row.pagibig_deduction || 0)
  const undertimeRateType = String(row.undertime_deduction_rate_type || 'Hour')
  const undertimeRate = Number(row.undertime_deduction_rate || 0)
  const undertimeRateInMinutes = undertimeRateType === 'Minute' ? undertimeRate : undertimeRate * 60

  const detailEntries = {
    earnings: [
      {
        id: 'base-pay',
        label: 'Base Pay',
        amount: basePay,
        detail: `${fmtMinutes(workedMinutes)} minutes worked ÷ (${requiredHours} hrs × 60) × ${fmt(payPerDay)}/day`,
      },
      {
        id: 'overtime-pay',
        label: 'Overtime Pay',
        amount: overtimePay,
        detail: `${fmtMinutes(overtimeMinutes)} minutes overtime ÷ 60 × (${fmt(payPerDay)} ÷ 8)`,
      },
      {
        id: 'holiday-pay',
        label: 'Holiday Pay',
        amount: holidayPay,
        detail: `Holiday pay: ${fmt(holidayPay)}`,
      },
      {
        id: 'paid-leave-pay',
        label: 'Paid Leave',
        amount: paidLeavePay,
        detail: `${Number(row.on_leave_total || 0)} paid leave day(s) × ${fmt(payPerDay)}`,
      },
      ...(specialMonthPay > 0 ? [{
        id: 'special-month-pay',
        label: '13th Month Pay',
        amount: specialMonthPay,
        detail: `13th month pay schedule active for this period: ${fmt(specialMonthPay)}`,
      }] : []),
      {
        id: 'halfday-pay',
        label: 'Halfday Pay',
        amount: halfdayPay,
        detail: `${halfdayTotal} halfday(s) × (${fmt(payPerDay)} ÷ 2)`,
      },
    ].filter(entry => Number(entry.amount || 0) !== 0),
    deductions: [
      {
        id: 'undertime-deductions',
        label: 'Undertime Deductions',
        amount: undertimeDeductionValue,
        detail: `${fmtMinutes(undertimeMinutes)} minutes undertime ÷ ${fmtMinutes(undertimeRateInMinutes)} × ${fmt(Number(row.undertime_deduction || 0))}`,
      },
      {
        id: 'late-deductions',
        label: 'Late Deductions',
        amount: lateDeductionValue,
        detail: `${fmtMinutes(lateMinutes)} minutes late ÷ 15 × ₱50`,
      },
      {
        id: 'cash-advance',
        label: 'Cash Advance',
        amount: Number(row.cash_advance_deduction || 0),
        detail: `Total cash advance deduction for period: ${fmt(Number(row.cash_advance_deduction || 0))}`,
      },
      {
        id: 'health-deductions',
        label: 'Health Deductions',
        amount: healthDeduction,
        detail: `SSS: ${fmt(sssAmount)} + PhilHealth: ${fmt(philhealthAmount)} + Pag-IBIG: ${fmt(pagibigAmount)}`,
      },
    ],
  }

  const toggleItem = (itemId: string) => setOpenItem(openItem === itemId ? null : itemId)

  return (
    <Modal open={true} title={displayName} onClose={onClose}>
      <div className="w-full max-h-[70vh] overflow-y-auto">
        <div className="w-md px-3 py-2 space-y-5">
          <div className="bg-slate-50 rounded-xl p-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 font-display">Attendance Summary</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Regular Hours', value: `${regularHours.toFixed(1)} hrs` },
                { label: 'Absence', value: `${Number(row.absent_total || 0)} days` },
                { label: 'Present', value: `${Number(row.present_total || 0)} days` },
                { label: 'On Leave', value: `${Number(row.on_leave_total || 0)} days` },
              ].map(f => (
                <div key={f.label}>
                  <p className="text-xs text-slate-400 font-display">{f.label}</p>
                  <p className="text-sm font-semibold text-slate-700 font-mono">{f.value}</p>
                </div>
              ))}
            </div>
          </div>
 

 

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 font-display">Earnings</p>
            <div className="space-y-2 mb-2">
              {detailEntries.earnings.map(e => (
                <div key={e.id} className="rounded-lg border border-slate-100 bg-white px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => toggleItem(e.id)}
                    className="flex w-full items-center justify-between gap-3 text-left text-sm"
                  >
                    <span className="flex items-center gap-2 text-slate-600">
                      {openItem === e.id ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
                      {e.label}
                    </span>
                    <span className="font-mono text-slate-700">{fmt(e.amount)}</span>
                  </button>
                  {openItem === e.id && (
                    <div className="mt-1 ml-5 rounded-md bg-slate-50 px-2 py-2 text-[11px] leading-relaxed text-slate-600">
                      {e.detail}
                    </div>
                  )}
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold border-t border-slate-100 pt-2 mt-1">
                <span className="text-slate-700">Gross Pay</span>
                <span className="font-mono text-slate-800">{fmt(Number(row.gross_pay || basePay + overtimePay + holidayPay + halfdayPay + paidLeavePay + specialMonthPay || 0))}</span>
              </div>
            </div>

            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 font-display">Deductions</p>
            <div className="space-y-2">
              {detailEntries.deductions.map(d => (
                <div key={d.id} className="rounded-lg border border-slate-100 bg-white px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => toggleItem(d.id)}
                    className="flex w-full items-center justify-between gap-3 text-left text-sm"
                  >
                    <span className="flex items-center gap-2 text-slate-600">
                      {openItem === d.id ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
                      {d.label}
                    </span>
                    <span className="font-mono text-red-600">{fmt(d.amount)}</span>
                  </button>
                  {openItem === d.id && (
                    <div className="mt-1 ml-5 rounded-md bg-red-50 px-2 py-2 text-[11px] leading-relaxed text-slate-600">
                      {d.detail}
                    </div>
                  )}
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold border-t border-slate-100 pt-2 mt-1">
                <span className="text-slate-700">Total Deductions</span>
                <span className="font-mono text-red-600">{fmt(Number(row.total_deduction || row.deductions || 0))}</span>
              </div>
            </div>
          </div>

          <div className="bg-indigo-600 rounded-xl p-4 text-center">
            <p className="text-indigo-200 text-xs mb-1 font-display">NET PAY</p>
            <p className="text-3xl font-bold text-white font-display">{fmt(Number(row.net_pay || 0))}</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => openEmployee?.(row.emp?.id ?? row.employee_id)}
              className="flex-1 text-sm font-medium border border-slate-200 rounded-lg py-2 hover:bg-slate-50 font-display text-slate-600"
            >
              View Attendance
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default function ProcessPayroll() {
  const { showToast, navigate, activePayrollPeriod } = useApp()
  const isMobile = useIsMobile()
  const [step, setStep] = useState<Step>('calculation')
  const [search, setSearch] = useState('')
  const [viewRow, setViewRow] = useState<any | null>(null)
  const [approveConfirm, setApproveConfirm] = useState(false)
  const [payrollRowsState, setPayrollRowsState] = useState<PayrollRow[]>([])
  const [isApproving, setIsApproving] = useState(false)
  const [isMarkingReview, setIsMarkingReview] = useState(false)
  const [advancesForReview, setAdvancesForReview] = useState<any[]>([])
  const [holidaysInPeriod, setHolidaysInPeriod] = useState<any[]>([])
  const [loadingAdvancesForReview, setLoadingAdvancesForReview] = useState(false)
  const [cashAdvanceDeductions, setCashAdvanceDeductions] = useState<Record<string, number>>({})
  const cashAdvanceDeductionsRef = useRef<Record<string, number>>(cashAdvanceDeductions)
  const [deductionDrafts, setDeductionDrafts] = useState<Record<string, string>>({})
  const [showDeductConfirm, setShowDeductConfirm] = useState(false)
  const [selectedAdvanceForConfirm, setSelectedAdvanceForConfirm] = useState<any | null>(null)
  const [editingNetFor, setEditingNetFor] = useState<string | null>(null)
  const [netDrafts, setNetDrafts] = useState<Record<string, string>>({})
  const [advancesOpen, setAdvancesOpen] = useState(false)
  const [holidaysOpen, setHolidaysOpen] = useState(true)
  const [payrollPage, setPayrollPage] = useState(0)
  const PAYROLL_PAGE_SIZE = 10
  const holidaysInnerRef = useRef<HTMLDivElement | null>(null)
  const holidaysWrapperRef = useRef<HTMLDivElement | null>(null)
  const [holidaysMaxHeight, setHolidaysMaxHeight] = useState('0px')
  const advancesInnerRef = useRef<HTMLDivElement | null>(null)
  const advancesWrapperRef = useRef<HTMLDivElement | null>(null)
  const [advancesMaxHeight, setAdvancesMaxHeight] = useState('0px')
  const advancesRequestId = useRef(0)
  const payrollRequestId = useRef(0)

  const [carouselIndex, setCarouselIndex] = useState(0)
  const totalEmployees = payrollRowsState.length
  const totalGrossPayroll = payrollRowsState.reduce((sum, row) => {
    const specialMonth = Number(row.special_month ?? row.special_month_pay ?? 0)
    return sum + Number(row.gross_pay ?? (Number(row.gross_base || 0) + Number(row.overtime_pay || 0) + Number(row.holiday_pay || 0) + Number(row.halfday_payment || 0) + Number(row.paid_leave_pay || 0) + specialMonth))
  }, 0)
  const totalDeductions = payrollRowsState.reduce((sum, row) => sum + Number(row.total_deduction || row.deductions || 0), 0)
  const totalNetPayroll = payrollRowsState.reduce((sum, row) => sum + Number(row.net_pay || 0), 0)
  const totalOvertime = payrollRowsState.reduce((sum, row) => sum + Number(row.overtime_pay || 0), 0)
  const totalHolidayPay = payrollRowsState.reduce((sum, row) => sum + Number(row.holiday_pay || 0), 0)
  const totalSpecialMonthPay = payrollRowsState.reduce((sum, row) => sum + Number(row.special_month ?? row.special_month_pay ?? 0), 0)

  const activePayrollIndex = stepToIndex[step]
  const maxCarouselIndex = Math.max(0, payrollWorkflowSteps.length - 3)

  useEffect(() => {
    const desired = Math.min(Math.max(activePayrollIndex - 1, 0), maxCarouselIndex)
    setCarouselIndex(desired)
  }, [activePayrollIndex, maxCarouselIndex])

  useEffect(() => {
    let mounted = true
    if (!activePayrollPeriod) return
    ;(async () => {
      try {
        const rawPeriodId = (activePayrollPeriod as any).report_period_id ?? (activePayrollPeriod as any).period_id ?? (activePayrollPeriod as any).id
        const periodId = Number(rawPeriodId)

        if (!Number.isFinite(periodId)) {
          console.error('Invalid payroll period id selected:', rawPeriodId)
          return
        }

        await fetchPayrollRows(periodId)
      } catch (err) {
        console.error('Failed to fetch payroll calculate', err)
      }
    })()
    return () => { mounted = false }
  }, [activePayrollPeriod])

  // load holidays for the active payroll period and show them in Calculation step
  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!activePayrollPeriod) return
      try {
        const res = await fetch('/api/settings/holidays')
        if (!res.ok) return
        const body = await res.json()
        if (!mounted) return
        const start = new Date(activePayrollPeriod.period_start)
        const end = new Date(activePayrollPeriod.period_end)
        const list = (body || []).filter((h: any) => {
          try {
            const d = new Date(h.date)
            // include only active holidays within range
            return h.active && d >= start && d <= end
          } catch (e) {
            return false
          }
        }).map((h: any) => ({
          id: h.id,
          date: new Date(h.date).toISOString().slice(0,10),
          label: h.holiday_name || h.holiday || '',
          type: (h.type === 'SPECIAL' || h.type === 'SPECIAL_NON_WORKING') ? 'Special Non-Working Holiday' : h.type === 'COMPANY' ? 'Company Holiday' : 'Regular Holiday',
          raw: h,
        }))
        setHolidaysInPeriod(list)
      } catch (err) {
        console.error('Failed to load holidays for period', err)
      }
    })()
    return () => { mounted = false }
  }, [activePayrollPeriod])

  async function fetchPayrollRows(periodId: number) {
    const requestId = ++payrollRequestId.current
    try {
      const res = await fetch(`/api/payroll/calculate?period_id=${periodId}`)
      if (!res.ok) return
      const body = await res.json()

      if (requestId !== payrollRequestId.current) return // stale response — a newer fetch wins

      const rows = (body.rows || body.payroll || []).map((r: any) => {
        const fullName = String(r.employee_name || r.name || '').trim()
        const [firstName = '', ...rest] = fullName.split(' ')
        const lastName = rest.join(' ')

        return {
          employee_id: r.employee_id ?? r.id ?? '',
          employee_name: r.employee_name || r.name || 'Unknown Employee',
          pay_per_day: Number(r.pay_per_day ?? r.payPerDay ?? 0),
          present_total: Number(r.present_total ?? 0),
          absent_total: Number(r.absent_total ?? 0),
          on_leave_total: Number(r.on_leave_total ?? 0),
          paid_leave_pay: Number(r.paid_leave_pay ?? 0),
          special_month: Number(r.special_month ?? r.special_month_pay ?? 0),
          special_month_pay: Number(r.special_month ?? r.special_month_pay ?? 0),
          halfday_total: Number(r.halfday_total ?? 0),
          worked_minutes_total: Number(r.worked_minutes_total ?? 0),
          overtime_minutes_total: Number(r.overtime_minutes_total ?? 0),
          late_minutes_total: Number(r.late_minutes_total ?? 0),
          undertime_minutes_total: Number(r.undertime_minutes_total ?? 0),
          required_daily_minutes: Number(r.required_daily_minutes ?? 0),
          required_daily_hours: Number(r.required_daily_hours ?? 8),
          undertime_deduction_total: Number(r.undertime_deduction_total ?? 0),
          undertime_deduction_rate_type: r.undertime_deduction_rate_type || 'Hour',
          undertime_deduction: Number(r.undertime_deduction ?? 0),
          undertime_deduction_rate: Number(r.undertime_deduction_rate ?? 0),
          rate_in_minutes: Number(r.rate_in_minutes ?? 0),
          deductions: Number(r.deductions ?? r.total_deduction ?? 0),
          net_pay: Number(r.net_pay ?? r.netPay ?? 0),
          // ensure gross includes holiday, halfday, and paid leave when backend doesn't provide gross_pay
          gross_pay: Number(r.gross_pay ?? (Number(r.gross_base ?? 0) + Number(r.overtime_pay ?? 0) + Number(r.holiday_pay ?? 0) + Number(r.halfday_payment ?? 0) + Number(r.paid_leave_pay ?? 0) + Number(r.special_month ?? r.special_month_pay ?? 0))),
          holiday_pay: Number(r.holiday_pay ?? r.holidayPay ?? r.holiday_payment ?? 0),
          overtime_pay: Number(r.overtime_pay ?? 0),
          halfday_payment: Number(r.halfday_payment ?? 0),
          health_deduction: Number(r.health_deduction ?? 0),
          sss_deduction: Number(r.sss_deduction ?? 0),
          philhealth_deduction: Number(r.philhealth_deduction ?? 0),
          pagibig_deduction: Number(r.pagibig_deduction ?? 0),
          sum_late_min: Number(r.sum_late_min ?? 0),
          gross_base: Number(r.gross_base ?? 0),
          attendance_deduction: Number(r.attendance_deduction ?? 0),
          total_deduction: Number(r.total_deduction ?? r.deductions ?? 0),
          employee_department: r.employee_department || r.department || '',
          emp: {
            id: r.employee_id ?? r.id ?? '',
            firstName,
            lastName,
            department: r.employee_department || r.department || '',
          },
          cash_advance_deduction: Number(r.cash_advance_deduction ?? 0),
        }
      })
      // store base rows; cash advance merging is handled by a dedicated effect
      setPayrollRowsState(rows)
    } catch (err) {
      console.error('fetchPayrollRows failed', err)
    }
  }  useEffect(() => {
    let mounted = true
    async function loadApprovedAdvances() {
      if (!activePayrollPeriod) return
      const requestId = ++advancesRequestId.current
      setLoadingAdvancesForReview(true)
      try {
        const res = await fetch('/api/cash_advances')
        if (!res.ok) return
        const body = await res.json()
        if (!mounted) return
        if (requestId !== advancesRequestId.current) return // superseded
        const periodId = Number((activePayrollPeriod as any).report_period_id ?? (activePayrollPeriod as any).period_id ?? (activePayrollPeriod as any).id)
        const restaurant = (activePayrollPeriod as any).restaurant
        const all = (body.cash_advances || [])
          const candidates = all.filter((c: any) => (c.status === 'approved' || c.status === 'released' || c.status === 'deducted') && Number(c.balance_remaining) >= 0 && (c.restaurant === restaurant || c.restaurant === 'Both'))
          const mapped = candidates.map((c: any) => {
            const remaining = Number(c.balance_remaining ?? c.amount ?? 0)
            return {
              cash_advances_id: c.cash_advances_id,
              employee_id: c.employee_id,
              employee_name: c.employee_name,
              amount: Number(c.amount ?? 0),
              balance_remaining: remaining,
              status: c.status,
              deducted: remaining <= 0,
              payments: c.payments || [],
            }
          })
        if (requestId !== advancesRequestId.current) return // superseded
        setAdvancesForReview(mapped)
        if (requestId !== advancesRequestId.current) return
        const defaults: Record<string, string> = {}
        mapped.forEach((m: any) => { defaults[m.cash_advances_id] = String(m.balance_remaining ?? m.amount ?? 0) })
        setDeductionDrafts(defaults)

        // compute cash advance deductions per employee for this period
        const cad: Record<string, number> = {}
        all.forEach((c: any) => {
          (c.payments || []).forEach((p: any) => {
            const rid = Number(p.report_period_id)
            if (Number.isFinite(rid) && rid === periodId) {
              const empId = String(c.employee_id)
              const amt = Number(p.amount_deducted ?? p.amount ?? 0)
              cad[empId] = (cad[empId] || 0) + (Number.isFinite(amt) ? amt : 0)
            }
          })
        })
        if (requestId !== advancesRequestId.current) return // superseded
        setCashAdvanceDeductions(cad)
        
        // After loading cash advance deductions, refresh payroll rows with the deductions
        if (mounted && requestId === advancesRequestId.current) {
          await fetchPayrollRows(periodId)
        }
      } catch (err) {
        console.error('Failed to load advances for review', err)
      } finally {
        setLoadingAdvancesForReview(false)
      }
    }

    if (step === 'review' || step === 'calculation') void loadApprovedAdvances()
    return () => { mounted = false }
  }, [step, activePayrollPeriod])

  // auto-open accordion if there are advances
  useEffect(() => {
    if ((advancesForReview || []).length > 0) setAdvancesOpen(true)
  }, [advancesForReview])

  useEffect(() => {
    const el = advancesInnerRef.current
    if (!el) {
      setAdvancesMaxHeight('0px')
      return
    }
    if (advancesOpen) {
      setAdvancesMaxHeight(`${el.scrollHeight}px`)
    } else {
      setAdvancesMaxHeight('0px')
    }
  }, [advancesOpen, advancesForReview, loadingAdvancesForReview])

  useEffect(() => {
    const el = holidaysInnerRef.current
    if (!el) {
      setHolidaysMaxHeight('0px')
      return
    }
    if (holidaysOpen) {
      setHolidaysMaxHeight(`${el.scrollHeight}px`)
    } else {
      setHolidaysMaxHeight('0px')
    }
  }, [holidaysOpen, holidaysInPeriod])

  // Recalculate per-row deductions (attendance, total) when payroll rows or cash advance map changes
  // keep a ref in sync so async functions can read the latest deductions
  useEffect(() => { cashAdvanceDeductionsRef.current = cashAdvanceDeductions }, [cashAdvanceDeductions])

  // Recalculate per-row deductions when either the cash advance map or the payroll rows change.
  // Guard: only update state when computed values actually differ to avoid infinite loops.
  useEffect(() => {
    if (!payrollRowsState || payrollRowsState.length === 0) return

    const merged = payrollRowsState.map(r => {
      const empId = String(r.employee_id)
      const attendanceDeduction = Number(r.sum_late_min || 0) + Number(r.undertime_deduction_total || 0)
      const cashAdvance = Number(cashAdvanceDeductionsRef.current[empId] || 0)
      const health = Number(r.health_deduction || 0)
      const totalDeduction = attendanceDeduction + health + cashAdvance
      const specialMonth = Number(r.special_month ?? r.special_month_pay ?? 0)
      const gross = Number(r.gross_pay ?? (Number(r.gross_base || 0) + Number(r.overtime_pay || 0) + Number(r.holiday_pay || 0) + Number(r.halfday_payment || 0) + Number(r.paid_leave_pay || 0) + specialMonth))

      if (r.net_pay_overridden) {
        return {
          ...r,
          attendance_deduction: attendanceDeduction,
          cash_advance_deduction: cashAdvance,
          total_deduction: totalDeduction,
          net_pay: Number(r.net_pay ?? r.original_net_pay ?? gross - totalDeduction),
        }
      }

      const net = gross - totalDeduction
      return { ...r, attendance_deduction: attendanceDeduction, cash_advance_deduction: cashAdvance, total_deduction: totalDeduction, net_pay: net }
    })

    // compare merged with existing payrollRowsState; only set if something changed
    let changed = false
    if (merged.length !== payrollRowsState.length) changed = true
    else {
      for (let i = 0; i < merged.length; i++) {
        const a = merged[i]
        const b = payrollRowsState[i]
        if (Number(a.attendance_deduction || 0) !== Number(b.attendance_deduction || 0)
          || Number(a.cash_advance_deduction || 0) !== Number(b.cash_advance_deduction || 0)
          || Number(a.total_deduction || 0) !== Number(b.total_deduction || 0)
          || Number(a.net_pay || 0) !== Number(b.net_pay || 0)) {
          changed = true
          break
        }
      }
    }

    if (changed) setPayrollRowsState(merged)
  }, [cashAdvanceDeductions, payrollRowsState])

  const handleDeductAdvance = async (adv: any, amountParam?: number) => {
    if (!activePayrollPeriod) return
    const requestId = ++advancesRequestId.current
    try {
      const periodId = Number((activePayrollPeriod as any).report_period_id ?? (activePayrollPeriod as any).period_id ?? (activePayrollPeriod as any).id)
      const amount = amountParam != null ? Number(amountParam) : Number(adv.balance_remaining ?? adv.amount ?? 0)
      if (!amount || Number.isNaN(amount) || amount <= 0) {
        showToast({ type: 'error', message: 'Invalid amount', description: 'Enter a valid deduction amount.' })
        return
      }

      const remainingBal = Number(adv.balance_remaining ?? adv.amount ?? 0)
      if (amount > remainingBal) {
        showToast({ type: 'error', message: 'Deduction exceeds remaining balance', description: `Remaining balance is ${fmt(remainingBal)}` })
        return
      }

      const res = await fetch(`/api/cash_advances/${adv.cash_advances_id}/payments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ report_period_id: periodId, amount_deducted: amount }),
      })
      const body = await res.json()
      if (!res.ok) {
        console.error('Failed to post deduction', body)
        showToast({ type: 'error', message: 'Deduction failed', description: body?.error || 'Server error' })
        return
      }

      if (requestId !== advancesRequestId.current) return

      const updatedAdvance = body?.cash_advance || null
      const remainingAfter = Number(updatedAdvance?.balance_remaining ?? (remainingBal - amount))
      const empId = String(adv.employee_id)

      setAdvancesForReview(prev => prev.map(p => p.cash_advances_id === adv.cash_advances_id ? {
        ...p,
        balance_remaining: remainingAfter,
        status: updatedAdvance?.status ?? p.status,
        deducted: remainingAfter <= 0 || Boolean(updatedAdvance?.payments?.length),
      } : p))

      setCashAdvanceDeductions(prev => ({ ...prev, [empId]: (prev[empId] || 0) + amount }))

      setPayrollRowsState(prev => prev.map(r => {
        if (String(r.employee_id) !== empId) return r
        const attendanceDeduction = Number(r.sum_late_min || 0) + Number(r.undertime_deduction_total || 0)
        const health = Number(r.health_deduction || 0)
        const cashAdvance = Number((r.cash_advance_deduction || 0) + amount)
        const totalDeduction = attendanceDeduction + health + cashAdvance
        const specialMonth = Number(r.special_month ?? r.special_month_pay ?? 0)
        const gross = Number(r.gross_pay ?? (Number(r.gross_base || 0) + Number(r.overtime_pay || 0) + Number(r.holiday_pay || 0) + Number(r.halfday_payment || 0) + Number(r.paid_leave_pay || 0) + specialMonth))
        const net = gross - totalDeduction
        return { ...r, attendance_deduction: attendanceDeduction, cash_advance_deduction: cashAdvance, total_deduction: totalDeduction, net_pay: net }
      }))

      if (requestId !== advancesRequestId.current) return
      showToast({ type: 'success', message: 'Deduction applied', description: `${adv.employee_name} will be deducted ${fmt(amount)} for this period.` })

      const defaults: Record<string, string> = {}
      const nextAdvanceList = (updatedAdvance ? [{
        cash_advances_id: updatedAdvance.cash_advances_id,
        employee_id: updatedAdvance.employee_id,
        employee_name: updatedAdvance.employee_name,
        amount: Number(updatedAdvance.amount ?? 0),
        balance_remaining: Number(updatedAdvance.balance_remaining ?? 0),
        status: updatedAdvance.status,
        deducted: Number(updatedAdvance.balance_remaining ?? 0) <= 0 || (updatedAdvance.payments || []).length > 0,
      }] : [])

      if (nextAdvanceList.length > 0) {
        const draftValue = String(nextAdvanceList[0].balance_remaining ?? nextAdvanceList[0].amount ?? 0)
        defaults[nextAdvanceList[0].cash_advances_id] = draftValue
        setDeductionDrafts(prev => ({ ...prev, ...defaults }))
      }
    } catch (err) {
      console.error('Deduct advance error', err)
      showToast({ type: 'error', message: 'Deduction failed', description: String(err) })
    }
  }

  const goToStepIndex = (nextIndex: number) => {
    if (nextIndex <= 2) setStep('attendance')
    else if (nextIndex === 3) setStep('calculation')
    else if (nextIndex === 4) setStep('review')
    else setStep('approved')
  }

  const handlePrevious = () => {
    const nextIndex = Math.max(activePayrollIndex - 1, 0)
    goToStepIndex(nextIndex)
  }

  const handleNext = () => {
    const nextIndex = Math.min(activePayrollIndex + 1, payrollWorkflowSteps.length - 1)
    goToStepIndex(nextIndex)
  }

  const filteredRows = payrollRowsState.filter(r => {
    const q = search.toLowerCase()
    const empName = `${r.employee_name || `${r.emp.firstName} ${r.emp.lastName}`}`.toLowerCase()
    return !q || empName.includes(q)
  })

  const totalPages = Math.ceil(filteredRows.length / PAYROLL_PAGE_SIZE)
  const paginatedRows = filteredRows.slice(payrollPage * PAYROLL_PAGE_SIZE, (payrollPage + 1) * PAYROLL_PAGE_SIZE)

  if (!activePayrollPeriod) {
    return (
      <div className="p-6">
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 font-display mb-2">No payroll period selected</h2>
          <p className="text-sm text-slate-500 mb-5">Choose a payroll period before processing payroll.</p>
          <button
            type="button"
            onClick={() => navigate('payroll-periods')}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display"
          >
            Go back to Payroll Periods
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 font-display">Payroll Processing</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          {activePayrollPeriod.period_start} – {activePayrollPeriod.period_end}
        </p>
      </div>

      <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800 font-display">
        Processing: {activePayrollPeriod.period_start} – {activePayrollPeriod.period_end} · {activePayrollPeriod.restaurant}
      </div>

      <div className="mb-6">
        <WorkflowStepper
          steps={payrollWorkflowSteps}
          activeIndex={activePayrollIndex}
          carouselIndex={carouselIndex}
          showNavigation
          onPrevious={handlePrevious}
          onNext={handleNext}
          visibleCount={3}
        />
      </div>

      {step === 'calculation' && (
        <div className="space-y-5">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { label: 'Employees', value: String(totalEmployees), color: 'text-slate-800' },
              { label: 'Total Deductions', value: fmt(totalDeductions), color: 'text-red-600' },
              { label: 'Net Payroll', value: fmt(totalNetPayroll), color: 'text-emerald-600' },
              { label: 'Holiday Pay', value: fmt(totalHolidayPay), color: 'text-purple-600' },
              { label: '13th Month Pay', value: fmt(totalSpecialMonthPay), color: 'text-indigo-600' },
              { label: 'Overtime', value: fmt(totalOvertime), color: 'text-yellow-600' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm text-center">
                <p className={`font-bold font-display ${s.color} ${isMobile ? 'text-sm' : 'text-lg'}`}>{s.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Holidays in this payroll period */}
          <div className="bg-white rounded-xl border border-slate-200 p-0 shadow-sm">
            <button type="button" onClick={() => setHolidaysOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                {holidaysOpen ? <ChevronDown size={16} className="text-slate-600" /> : <ChevronRight size={16} className="text-slate-600" />}
                <p className="text-sm font-semibold text-slate-700 font-display">Holidays in this period</p>
              </div>
              <div className="text-xs text-slate-400">{holidaysInPeriod.length} items</div>
            </button>
            <div ref={holidaysWrapperRef} style={{ maxHeight: holidaysMaxHeight, overflow: 'hidden', transition: 'max-height 240ms ease' }} className="border-t border-slate-100">
              <div ref={holidaysInnerRef} className="p-4">
              {holidaysInPeriod.length === 0 ? (
                <p className="text-sm text-slate-500">No holidays for this period.</p>
              ) : (
                <div className="space-y-2">
                  {holidaysInPeriod.map(h => (
                    <div key={h.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                      <div>
                        <div className="font-medium text-slate-700">{h.label}</div>
                        <div className="text-xs text-slate-500">{formatIsoToShort(h.date)} • {h.type}</div>
                      </div>
                      <div />
                    </div>
                  ))}
                </div>
              )}
              </div>
            </div>
          </div>
          {/* Cash Advances shown before payroll table */}
          <div className="bg-white rounded-xl border border-slate-200 p-0 shadow-sm">
            <button type="button" onClick={() => setAdvancesOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                {advancesOpen ? <ChevronDown size={16} className="text-slate-600" /> : <ChevronRight size={16} className="text-slate-600" />}
                <p className="text-sm font-semibold text-slate-700 font-display">Approved Cash Advances (before payroll)</p>
              </div>
              <div className="text-xs text-slate-400">{advancesForReview.length} items</div>
            </button>
            <div ref={advancesWrapperRef} style={{ maxHeight: advancesMaxHeight, overflow: 'hidden', transition: 'max-height 240ms ease' }} className="border-t border-slate-100">
              <div ref={advancesInnerRef} className="p-4">
                {loadingAdvancesForReview ? (
                  <p className="text-sm text-slate-500">Loading approved advances…</p>
                ) : advancesForReview.length === 0 ? (
                  <p className="text-sm text-slate-500">No approved cash advances for this period.</p>
                ) : (
                  <div className="space-y-2">
                    {advancesForReview.map((a: any) => (
                      <div key={a.cash_advances_id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                        <div>
                          <div className="font-medium text-slate-700">{a.employee_name}</div>
                          <div className="text-xs text-slate-500">Outstanding: {fmt(Number(a.balance_remaining || 0))}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {Number(a.balance_remaining || 0) <= 0 ? (
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Paid</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button onClick={() => { setSelectedAdvanceForConfirm(a); setShowDeductConfirm(true) }} className="text-sm bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-md font-semibold">Deduct</button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <div>
                {/* Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-3">
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
                    <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5 flex-1 max-w-xs focus-within:border-indigo-400">
                      <Search size={13} className="text-slate-400 shrink-0" />
                      <input value={search} onChange={e => { setSearch(e.target.value); setPayrollPage(0) }} placeholder="Search employee..." className="bg-transparent text-sm outline-none text-slate-700 w-full placeholder:text-slate-400" />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    {!isMobile ? (
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50">
                            {['Employee Name', 'Pay Per Day', 'Present Total', 'Absent Total', 'On Leave', 'Deductions', 'Net Pay'].map(h => (
                              <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {filteredRows.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                                No payroll rows available for this period.
                              </td>
                            </tr>
                          ) : (
                            paginatedRows.map(r => (
                              <tr
                                key={String(r.employee_id)}
                                className="hover:bg-slate-50 group cursor-pointer"
                                onClick={() => setViewRow(r)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    setViewRow(r)
                                  }
                                }}
                              >
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                                      <span className="text-indigo-700 text-[10px] font-bold font-display">{(r.emp.firstName || r.employee_name || 'E').charAt(0).toUpperCase()}{(r.emp.lastName || '').charAt(0).toUpperCase()}</span>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-slate-700 font-display whitespace-nowrap">{r.employee_name}</p>
                                      <p className="text-xs text-slate-400">{r.employee_department || r.emp.department}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4 font-mono text-xs text-slate-700">{fmt(r.pay_per_day)}</td>
                                <td className="py-3 px-4 font-mono text-xs text-slate-700">{r.present_total}</td>
                                <td className="py-3 px-4 font-mono text-xs text-slate-700">{r.absent_total}</td>
                                <td className="py-3 px-4 font-mono text-xs text-violet-700">{r.on_leave_total}</td>
                                <td className="py-3 px-4 font-mono text-xs text-red-600">{fmt(r.total_deduction)}</td>
                                <td className="py-3 px-4 font-mono text-xs font-semibold text-emerald-700">{fmt(r.net_pay)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    ) : (
                      <div className="flex flex-col">
                        {paginatedRows.map(r => (
                          <button key={String(r.employee_id)} onClick={() => setViewRow(r)} className="text-left p-3 border-b border-slate-50 hover:bg-slate-50 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-700">{r.employee_name}</div>
                              <div className="text-xs text-slate-400">{r.employee_department || r.emp.department}</div>
                            </div>
                            <div className="text-sm font-mono text-emerald-700">{fmt(r.net_pay)}</div>
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              </div>

                {totalPages > 1 && (
                <div className="flex items-center justify-end gap-3 mt-4 mb-5">
                  <button
                    onClick={() => setPayrollPage(p => Math.max(0, p - 1))}
                    disabled={payrollPage === 0}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-display"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-slate-500 font-display">
                    Page {payrollPage + 1} of {Math.max(totalPages, 1)}
                  </span>
                  <button
                    onClick={() => setPayrollPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={payrollPage >= totalPages - 1}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-display"
                  >
                    Next
                  </button>
                </div>
                )}

                <div className="flex justify-end gap-3 mt-3">
                  <button onClick={() => setStep('attendance')} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Back</button>
                  <button
                    onClick={async () => {
                      // mark period as Under Review in DB, then go to review
                      try {
                        if (!activePayrollPeriod) return
                        setIsMarkingReview(true)
                        const periodId = (activePayrollPeriod as any).report_period_id ?? (activePayrollPeriod as any).period_id ?? (activePayrollPeriod as any).id
                        await fetch(`/api/report_periods/${periodId}/status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'Under Review' }) })
                      } catch (err) {
                        console.error('Failed to mark review', err)
                      } finally {
                        setIsMarkingReview(false)
                        setStep('review')
                      }
                    }}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg font-display"
                  >
                    {isMarkingReview ? 'Marking...' : 'Proceed to Review'} <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </div>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-5">
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {[
              { label: 'Total Employees', value: String(totalEmployees), color: 'text-slate-600' },
              { label: 'Total Deductions', value: fmt(totalDeductions), color: 'text-red-600' },
              { label: 'Net Payroll', value: fmt(totalNetPayroll), color: 'text-green-600' },
              { label: 'Overtime Cost', value: fmt(totalOvertime), color: 'text-yellow-600' },
              { label: 'Late Deductions', value: fmt(payrollRowsState.reduce((sum, row) => sum + Number(row.sum_late_min || 0), 0)), color: 'text-red-800' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm text-center">
                <p className={`font-bold font-display ${s.color} ${isMobile ? 'text-sm' : 'text-lg'}`}>{s.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          {/* Review table: allow net pay override per employee */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-3">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {['Employee Name', 'Deductions', 'Net Pay', 'Actions'].map(h => (
                      <th key={h} className={` ${h === 'Employee Name' ? 'text-left' : 'text-center'} py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display whitespace-nowrap`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-sm text-slate-500">No payroll rows available for this period.</td>
                    </tr>
                  ) : (
                    filteredRows.map(r => {
                      const empId = String(r.employee_id)
                      return (
                        <tr key={empId} className="group">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                                <span className="text-indigo-700 text-[10px] font-bold font-display">{(r.emp.firstName || r.employee_name || 'E').charAt(0).toUpperCase()}{(r.emp.lastName || '').charAt(0).toUpperCase()}</span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-slate-700 font-display whitespace-nowrap">{r.employee_name}</p>
                                <p className="text-xs text-slate-400">{r.employee_department || r.emp.department}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-red-600 text-center">{fmt(r.total_deduction)}</td>
                          <td className="py-3 px-4 font-mono text-xs font-semibold text-emerald-700 text-center">
                            {editingNetFor === empId ? (
                              <input type="number" step="0.01" className="border border-slate-200 rounded-lg px-2 py-1 text-sm w-28" value={netDrafts[empId] ?? (Number(r.net_pay ?? 0).toFixed(2))} onChange={e => setNetDrafts(prev => ({ ...prev, [empId]: e.target.value }))} />
                            ) : (
                              <span>{fmt(r.net_pay)}</span>
                            )}
                            {r.net_pay_overridden && !editingNetFor && <span className="ml-2 text-[11px] bg-yellow-100 text-yellow-600 px-2 py-0.5 rounded">Adjusted</span>}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {editingNetFor === empId ? (
                              <div>
                                <button className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-1.5 rounded-md font-semibold mr-2" onClick={async (e) => {
                                  e.stopPropagation()
                                  const val = Number(netDrafts[empId])
                                  if (Number.isNaN(val)) {
                                    showToast({ type: 'error', message: 'Invalid number' })
                                    return
                                  }
                                  const prevRow = payrollRowsState.find(p => String(p.employee_id) === empId)
                                  const oldNet = Number(prevRow?.net_pay ?? 0)
                                  const newNet = Number(val)
                                  if (newNet !== oldNet) {
                                    setPayrollRowsState(prev => prev.map(p => {
                                      if (String(p.employee_id) !== empId) return p
                                      const next = {
                                        ...p,
                                        original_net_pay: p.original_net_pay ?? p.net_pay,
                                        net_pay: newNet,
                                        net_pay_overridden: true,
                                      }
                                      return next
                                    }))
                                  }
                                  setEditingNetFor(null)
                                  // post audit log
                                  try {
                                    await fetch('/api/audit-logs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'override_net_pay', table_name: 'payslips', record_id: empId, old_data: { net_pay: oldNet }, new_data: { net_pay: val }, description: `Override net pay for period ${activePayrollPeriod?.period_id ?? activePayrollPeriod?.report_period_id ?? activePayrollPeriod?.id}` }) })
                                    showToast({ type: 'success', message: 'Net pay overridden' })
                                  } catch (err) {
                                    console.error('Failed to log audit', err)
                                  }
                                }}>Save</button>
                                <button className="text-sm bg-red-600 hover:bg-red-700 text-white px-5 py-1.5 rounded-md font-semibold" onClick={(e) => { e.stopPropagation(); setEditingNetFor(null) }}>Cancel</button>
                              </div>
                            ) : (
                              <button className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-1.5 rounded-md font-semibold" onClick={(e) => { e.stopPropagation(); setEditingNetFor(empId); setNetDrafts(prev => ({ ...prev, [empId]: Number(r.net_pay ?? 0).toFixed(2) })) }}>Edit</button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-3">
            <div className="flex gap-3">
              <button onClick={() => setStep('calculation')} className="px-2 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">
                Back to Calculation
              </button>
              <button onClick={() => setApproveConfirm(true)} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg font-display">
                Approve Payroll <CheckCircle2 size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'approved' && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 font-display mb-2">Payroll Approved!</h3>
            <p className="text-sm text-slate-500 mb-6">Payroll has been approved and finalized.<br />Payslips are ready for distribution.</p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => navigate('payroll-history')}
                className="px-5 py-2.5 text-sm font-semibold border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-display"
              >
                View Payroll History
              </button>
              <button
                type="button"
                onClick={() => navigate('payslips')}
                className="px-5 py-2.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display"
              >
                View Payslips
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Confirm Modal */}
      {approveConfirm && (
        <Modal open={true} title="Approve Payroll?" onClose={() => setApproveConfirm(false)}>
          <div className="w-full max-w-md p-2">
            <p className="text-sm text-slate-600 mb-2">
              Once approved, payroll will be marked as finalized.
            </p>
            <div className="bg-slate-50 rounded-xl p-3 mb-5">
              <p className="text-sm font-medium text-slate-700 font-display">{activePayrollPeriod?.period_start ?? ''} – {activePayrollPeriod?.period_end ?? ''}</p>
              <p className="text-xs text-slate-400 mt-0.5">Net Payroll: {fmt(totalNetPayroll)} · {totalEmployees} employees</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setApproveConfirm(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
              <button
                onClick={async () => {
                  try {
                    setIsApproving(true)
                    const periodId = (activePayrollPeriod as any).report_period_id ?? (activePayrollPeriod as any).period_id ?? (activePayrollPeriod as any).id
                    const res = await fetch('/api/payroll/approve', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ period_id: Number(periodId), rows: payrollRowsState }) })
                    const body = await res.json()
                    if (!res.ok) {
                      console.error('Approve failed', body)
                      showToast({ type: 'error', message: 'Approve failed', description: body?.error || 'Server error' })
                      return
                    }
                    showToast({ type: 'success', message: 'Payroll approved!', description: `Inserted ${body.inserted_count || 0} payslips.` })
                    setApproveConfirm(false)
                    setStep('approved')
                    // After successful approval (status set to 'released' server-side), move user to Payroll History
                    navigate('payroll-history')
                  } catch (err) {
                    console.error('Approve error', err)
                    showToast({ type: 'error', message: 'Approve failed', description: String(err) })
                  } finally {
                    setIsApproving(false)
                  }
                }}
                className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-display"
              >
                {isApproving ? 'Approving...' : 'Approve Payroll'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showDeductConfirm && selectedAdvanceForConfirm && (
        <Modal open={true} title={`Deduct ${selectedAdvanceForConfirm.employee_name}?`} onClose={() => setShowDeductConfirm(false)}>
          <div className="w-full max-w-md p-2">
            <p className="text-sm text-slate-600 mb-2">Confirm deduction amount for this payroll period.</p>
            <div className="bg-slate-50 rounded-xl p-3 mb-5">
              <p className="text-sm font-medium text-slate-700">{selectedAdvanceForConfirm.employee_name}</p>
              <p className="text-xs text-slate-400 mt-0.5">Outstanding: {fmt(Number(selectedAdvanceForConfirm.balance_remaining ?? selectedAdvanceForConfirm.amount ?? 0))}</p>
            </div>
            <div className="mb-4">
              <label className="block text-xs text-slate-500 mb-1">Amount to deduct</label>
              <input type="number" min="0" step="0.01" value={deductionDrafts[selectedAdvanceForConfirm.cash_advances_id] ?? ''} onChange={e => setDeductionDrafts(prev => ({ ...prev, [selectedAdvanceForConfirm.cash_advances_id]: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeductConfirm(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              <button
                onClick={async () => {
                  try {
                    const adv = selectedAdvanceForConfirm
                    const amount = Number(deductionDrafts[adv.cash_advances_id] ?? 0)
                    setShowDeductConfirm(false)
                    setSelectedAdvanceForConfirm(null)
                    await handleDeductAdvance(adv, amount)
                  } catch (err) {
                    console.error('Confirm deduct error', err)
                  }
                }}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
              >
                Confirm Deduction
              </button>
            </div>
          </div>
        </Modal>
      )}

      {viewRow && <PayrollBreakdownModal row={viewRow} onClose={() => setViewRow(null)} />}
    </div>
  )
}
