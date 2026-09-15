'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2, CircleDollarSign, Plus, Trash2, Wallet, ClipboardList } from 'lucide-react'
import CenteredEmptyRows from '../components/CenteredEmptyRows'
import { useApp } from '../App'
import { useRealtimeEntity } from '../hooks/useRealtimeEntity'
import Modal from '../components/Modal'
import PaginationFooter from '../components/PaginationFooter'

type PaymentEntry = {
  cash_advance_payments_id: string
  report_period_id: number | null
  report_period_label: string
  amount_deducted: number
  created_at: string
}

type CashAdvanceItem = {
  cash_advances_id: string
  employee_id: number | null
  employee_name: string
  restaurant: string
  amount: number
  date_requested: string | null
  date_released: string | null
  status: string
  approved_by: string | null
  approved_name: string | null
  remarks: string
  balance_remaining: number
  is_fully_paid: boolean
  payments: PaymentEntry[]
}

type EmployeeOption = {
  id: string
  name: string
  restaurant: string
}

type ReportPeriodOption = {
  report_period_id: number
  period_start: string
  period_end: string
  restaurant: string
  status: string
}

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  released: 'bg-violet-100 text-violet-700',
  cancelled: 'bg-gray-100 text-gray-700',
  rejected: 'bg-red-100 text-red-700',
}

const lockedStatuses = ['cancelled', 'rejected', 'released'] as const

function getStatusOptions(currentStatus: string): string[] {
  // Per requirements:
  // pending -> approved, cancelled, rejected
  // approved -> released, cancelled
  // cancelled|rejected|released -> no options
  if (currentStatus === 'pending') return ['approved', 'cancelled', 'rejected']
  if (currentStatus === 'approved') return ['released', 'cancelled']
  if (lockedStatuses.includes(currentStatus as any)) return []
  // Fallback: no options
  return []
}

function canChangeStatus(currentStatus: string): boolean {
  return getStatusOptions(currentStatus).length > 0
}

const formatCurrency = (value: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(value)

interface SkeletonBarProps {
  width?: string | number
  height?: string | number
  rounded?: string
  className?: string
}

function SkeletonBar({ width = "100%", height = "1rem", rounded = "rounded-md", className = "" }: SkeletonBarProps) {
  return (
    <div
      className={`bg-slate-200 animate-pulse ${rounded} ${className}`}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
      }}
    />
  )
}

interface SkeletonTableRowsProps {
  columns: number
  rows?: number
  columnConfig?: { width?: string; pill?: boolean }[]
}

function SkeletonTableRows({ columns, rows = 6, columnConfig }: SkeletonTableRowsProps) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIdx) => (
        <tr key={rowIdx} className="border-b border-slate-100">
          {Array.from({ length: columns }, (_, colIdx) => {
            const config = columnConfig?.[colIdx]
            return (
              <td key={colIdx} className="px-4 py-3">
                <SkeletonBar
                  width={config?.width ?? "80%"}
                  height={config?.pill ? "1.1rem" : "0.85rem"}
                  rounded={config?.pill ? "rounded-full" : "rounded-md"}
                />
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}

export default function CashAdvancePage() {
  const { showToast } = useApp()
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [reportPeriods, setReportPeriods] = useState<ReportPeriodOption[]>([])
  const [advances, setAdvances] = useState<CashAdvanceItem[]>([])
  const [selectedAdvance, setSelectedAdvance] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [draftStatus, setDraftStatus] = useState('')
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ employee: 'all', restaurant: 'all', status: 'all', period: 'all' })
  const [draft, setDraft] = useState({
    employeeId: '',
    restaurant: 'Lakay Ago',
    amount: '',
    dateRequested: new Date().toISOString().slice(0, 10),
    remarks: '',
  })
  const [paymentDraft, setPaymentDraft] = useState({ reportPeriodId: '', amount: '1000' })
  const [deleteTarget, setDeleteTarget] = useState<CashAdvanceItem | null>(null)
  const [deletePaymentTarget, setDeletePaymentTarget] = useState<{ advanceId: string; paymentId: string; label: string } | null>(null)
  const [editDraft, setEditDraft] = useState({ restaurant: 'Lakay Ago', amount: '', dateRequested: '', remarks: '' })
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  const reportPeriodOptions = useMemo(
    () => reportPeriods.map(period => ({
      id: String(period.report_period_id),
      label: `${period.period_start} to ${period.period_end}`,
    })),
    [reportPeriods],
  )

  const selectedRecord = useMemo(
    () => advances.find(item => item.cash_advances_id === selectedAdvance) ?? advances[0] ?? null,
    [advances, selectedAdvance],
  )

  const selectedStatusOptions = selectedRecord ? getStatusOptions(selectedRecord.status) : []
  const selectedStatusLocked = selectedRecord ? !canChangeStatus(selectedRecord.status) : false

  const filteredAdvances = useMemo(() => {
    return advances.filter(item => {
      const employeeOk = filters.employee === 'all' || String(item.employee_id) === filters.employee
      const restaurantOk = filters.restaurant === 'all' || item.restaurant === filters.restaurant
      const statusOk = filters.status === 'all' || item.status === filters.status
      const periodOk = filters.period === 'all' || item.payments.some(payment => String(payment.report_period_id) === filters.period)
      return employeeOk && restaurantOk && statusOk && periodOk
    })
  }, [advances, filters])

  const totalPages = Math.max(1, Math.ceil(filteredAdvances.length / PAGE_SIZE))
  const pageData = filteredAdvances.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const emptyRowsCount = pageData.length === 0 ? 0 : Math.max(0, PAGE_SIZE - pageData.length)

  const totalOutstanding = advances.reduce((sum, item) => sum + item.balance_remaining, 0)
  const paidCount = advances.filter(item => item.is_fully_paid).length

  const loadEmployees = async () => {
    try {
      const res = await fetch('/api/employees')
      if (!res.ok) return
      const body = await res.json()
      const nextEmployees = (body.employees ?? []).map((employee: any) => ({
        id: String(employee.id),
        name: employee.name,
        restaurant: employee.restaurant,
      }))
      setEmployees(nextEmployees)
      setDraft(prev => ({
        ...prev,
        employeeId: prev.employeeId || nextEmployees[0]?.id || '',
      }))
    } catch (error) {
      console.error('Failed to load employees', error)
    }
  }

  const loadReportPeriods = async () => {
    try {
      const res = await fetch('/api/report_periods')
      if (!res.ok) return
      const body = await res.json()
      setReportPeriods(body.periods ?? [])
      setPaymentDraft(prev => ({ ...prev, reportPeriodId: prev.reportPeriodId || String((body.periods ?? [])[0]?.report_period_id ?? '') }))
    } catch (error) {
      console.error('Failed to load periods', error)
    }
  }

  const loadAdvances = async () => {
    try {
      const res = await fetch('/api/cash_advances')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        showToast({ type: 'error', message: 'Failed to load cash advances', description: body.error || 'Please try again.' })
        return
      }

      const body = await res.json()
      const nextAdvances: CashAdvanceItem[] = (body.cash_advances ?? []).map((item: any) => ({
        cash_advances_id: String(item.cash_advances_id),
        employee_id: item.employee_id != null ? Number(item.employee_id) : null,
        employee_name: item.employee_name ?? 'Unknown Employee',
        restaurant: item.restaurant ?? 'Both',
        amount: Number(item.amount ?? 0),
        date_requested: item.date_requested ?? null,
        date_released: item.date_released ?? null,
        status: item.status ?? 'pending',
        approved_by: item.approved_by ?? null,
        approved_name: item.approved_name ?? null,
        remarks: item.remarks ?? '',
        balance_remaining: Number(item.balance_remaining ?? 0),
        is_fully_paid: Boolean(item.is_fully_paid),
        payments: (item.payments ?? []).map((payment: any) => ({
          cash_advance_payments_id: String(payment.cash_advance_payments_id),
          report_period_id: payment.report_period_id != null ? Number(payment.report_period_id) : null,
          report_period_label: payment.report_period_label ?? 'Selected period',
          amount_deducted: Number(payment.amount_deducted ?? 0),
          created_at: payment.created_at ?? '',
        })),
      }))

      setAdvances(nextAdvances)
      setSelectedAdvance(current => {
        if (current && nextAdvances.some((item: CashAdvanceItem) => item.cash_advances_id === current)) return current
        return nextAdvances[0]?.cash_advances_id ?? null
      })
    } catch (error) {
      console.error('Failed to load cash advances', error)
      showToast({ type: 'error', message: 'Network error', description: 'Could not load cash advance records.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadEmployees()
    void loadReportPeriods()
    void loadAdvances()
  }, [])

  useRealtimeEntity('cash_advances', {
    onChange: () => {
      void loadAdvances()
    },
  })

  useRealtimeEntity('cash_advance_payments', {
    onChange: () => {
      void loadAdvances()
      void loadReportPeriods()
    },
  })

  useRealtimeEntity('report_periods', {
    onChange: () => {
      void loadReportPeriods()
      void loadAdvances()
    },
  })

  useEffect(() => {
    setDraftStatus(selectedRecord?.status ?? '')
  }, [selectedRecord])

  const addAdvance = async () => {
    const amount = Number(draft.amount)
    if (!draft.employeeId || !amount || amount <= 0 || !draft.dateRequested) {
      showToast({ type: 'error', message: 'Validation failed', description: 'Select an employee, valid amount, and requested date.' })
      return
    }

    try {
      const res = await fetch('/api/cash_advances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: Number(draft.employeeId),
          restaurant: draft.restaurant,
          amount,
          date_requested: draft.dateRequested,
          remarks: draft.remarks,
        }),
      })

      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast({ type: 'error', message: 'Cash advance not saved', description: body.error || 'Please try again.' })
        return
      }

      setDraft({
        employeeId: employees[0]?.id ?? '',
        restaurant: 'Lakay Ago',
        amount: '',
        dateRequested: new Date().toISOString().slice(0, 10),
        remarks: '',
      })
      setShowCreate(false)
      await loadAdvances()
      const createdId = String(body.cash_advance?.cash_advances_id ?? '')
      if (createdId) setSelectedAdvance(createdId)
      showToast({ type: 'success', message: 'Cash advance created', description: 'The advance was saved to the database.' })
    } catch (error) {
      console.error('Failed to create advance', error)
      showToast({ type: 'error', message: 'Network error', description: 'Could not save the cash advance.' })
    }
  }

  const updateStatus = async (cashAdvanceId: string, nextStatus: string) => {
    try {
      const res = await fetch(`/api/cash_advances/${cashAdvanceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast({ type: 'error', message: 'Status update failed', description: body.error || 'Please try again.' })
        return
      }

      await loadAdvances()
      showToast({ type: 'success', message: 'Status updated', description: `Advance status changed to ${nextStatus}.` })
    } catch (error) {
      console.error('Failed to update status', error)
      showToast({ type: 'error', message: 'Network error', description: 'Could not update cash advance status.' })
    }
  }

  const addPayment = async () => {
    if (!selectedRecord) return

    // Only allow payments when status is released
    if (selectedRecord.status !== 'released') {
      showToast({ type: 'error', message: 'Payments not allowed', description: 'Payments can only be added when status is released.' })
      return
    }

    const amount = Number(paymentDraft.amount)
    if (!paymentDraft.reportPeriodId || !amount || amount <= 0) {
      showToast({ type: 'error', message: 'Invalid payment', description: 'Select a payroll period and valid amount.' })
      return
    }

    // Payment must be exact remaining balance
    if (Math.abs(amount - Number(selectedRecord.balance_remaining)) > 0.0001) {
      showToast({ type: 'error', message: 'Invalid payment amount', description: `Payment must equal remaining balance (${formatCurrency(selectedRecord.balance_remaining)}).` })
      return
    }

    try {
      const res = await fetch(`/api/cash_advances/${selectedRecord.cash_advances_id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_period_id: Number(paymentDraft.reportPeriodId),
          amount_deducted: amount,
        }),
      })

      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast({ type: 'error', message: 'Payment failed', description: body.error || 'Please try again.' })
        return
      }

      setPaymentDraft({ reportPeriodId: reportPeriodOptions[0]?.id ?? '', amount: '1000' })
      setShowPayment(false)
      await loadAdvances()
      showToast({ type: 'success', message: 'Payment posted', description: `${formatCurrency(amount)} was added to the ledger.` })
    } catch (error) {
      console.error('Failed to add payment', error)
      showToast({ type: 'error', message: 'Network error', description: 'Could not add the payment.' })
    }
  }

  const deleteAdvance = (advance: CashAdvanceItem) => {
    setDeleteTarget(advance)
  }

  const confirmDeleteAdvance = async (cashAdvanceId: string) => {
    try {
      const res = await fetch(`/api/cash_advances/${cashAdvanceId}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast({ type: 'warning', message: 'Cannot delete', description: body.error || 'This cash advance cannot be removed.' })
        return
      }

      await loadAdvances()
      showToast({ type: 'success', message: 'Cash advance deleted', description: 'The record was removed from the database.' })
    } catch (error) {
      console.error('Failed to delete advance', error)
      showToast({ type: 'error', message: 'Network error', description: 'Could not delete the cash advance.' })
    } finally {
      setDeleteTarget(null)
    }
  }

  const deletePayment = (advanceId: string, paymentId: string, label: string) => {
    setDeletePaymentTarget({ advanceId, paymentId, label })
  }

  const confirmDeletePayment = async (advanceId: string, paymentId: string) => {
    try {
      const res = await fetch(`/api/cash_advances/${advanceId}/payments/${paymentId}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast({ type: 'warning', message: 'Cannot delete', description: body.error || 'This payment cannot be removed.' })
        return
      }

      await loadAdvances()
      showToast({ type: 'success', message: 'Payment deleted', description: 'The payment was removed from the ledger.' })
    } catch (error) {
      console.error('Failed to delete payment', error)
      showToast({ type: 'error', message: 'Network error', description: 'Could not delete the payment.' })
    } finally {
      setDeletePaymentTarget(null)
    }
  }

  const updateAdvance = async (cashAdvanceId: string) => {
    try {
      const amount = Number(editDraft.amount)
      if (!amount || amount <= 0) {
        showToast({ type: 'error', message: 'Validation failed', description: 'Enter a valid amount.' })
        return
      }

      const res = await fetch(`/api/cash_advances/${cashAdvanceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant: editDraft.restaurant,
          amount,
          date_requested: editDraft.dateRequested,
          remarks: editDraft.remarks,
        }),
      })

      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast({ type: 'error', message: 'Update failed', description: body.error || 'Please try again.' })
        return
      }

      setShowEditModal(false)
      await loadAdvances()
      showToast({ type: 'success', message: 'Cash advance updated', description: 'The record was updated.' })
    } catch (error) {
      console.error('Failed to update advance', error)
      showToast({ type: 'error', message: 'Network error', description: 'Could not update the cash advance.' })
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800 font-display">Cash Advance</h2>
            <p className="text-sm text-slate-500 mt-0.5">Manage employee advances and payroll deductions</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg font-display">
            <Plus size={16} /> Add Cash Advance
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[0, 1, 2].map(i => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <SkeletonBar width="90px" height="12px" rounded="rounded-md" />
                <SkeletonBar width="18px" height="18px" rounded="rounded-md" />
              </div>
              <div className="mt-3">
                <SkeletonBar width="130px" height="24px" rounded="rounded-md" />
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map(i => (
              <SkeletonBar key={i} width="100%" height="38px" rounded="rounded-lg" />
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Restaurant</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Balance</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <SkeletonTableRows columns={5} rows={PAGE_SIZE} columnConfig={[
                  { width: "70%" }, { width: "45%" },
                  { width: "45%" }, { width: "45%" },
                  { width: "40%", pill: true }
                ]} />
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-display">Cash Advance</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage employee advances and payroll deductions</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg font-display">
          <Plus size={16} /> Add Cash Advance
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs uppercase tracking-wide">Outstanding</span>
            <CircleDollarSign size={16} />
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-800 font-display">{formatCurrency(totalOutstanding)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs uppercase tracking-wide">Paid Off</span>
            <CheckCircle2 size={16} />
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-800 font-display">{paidCount}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs uppercase tracking-wide">Active Advances</span>
            <Wallet size={16} />
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-800 font-display">{advances.length}</div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-3">
          <select value={filters.employee} onChange={e => { setFilters(prev => ({ ...prev, employee: e.target.value })); setPage(1) }} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 outline-none focus:border-indigo-400">
            <option value="all">All employees</option>
            {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
          </select>
          <select value={filters.restaurant} onChange={e => { setFilters(prev => ({ ...prev, restaurant: e.target.value })); setPage(1) }} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 outline-none focus:border-indigo-400">
            <option value="all">All restaurants</option>
            {['Lakay Ago', 'Aroo', 'Both'].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={filters.status} onChange={e => { setFilters(prev => ({ ...prev, status: e.target.value })); setPage(1) }} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 outline-none focus:border-indigo-400">
            <option value="all">All statuses</option>
            {Object.keys(statusStyles).map(status => <option key={status} value={status}>{status}</option>)}
          </select>
          <select value={filters.period} onChange={e => { setFilters(prev => ({ ...prev, period: e.target.value })); setPage(1) }} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 outline-none focus:border-indigo-400">
            <option value="all">All payroll periods</option>
            {reportPeriodOptions.map(period => <option key={period.id} value={period.id}>{period.label}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Restaurant</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAdvances.length === 0 ? (
                <CenteredEmptyRows columns={5} rows={PAGE_SIZE} message={<span className="text-sm text-slate-500">No cash advances found.</span>} />
              ) : (
                pageData.map(item => (
                  <tr
                    key={item.cash_advances_id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => { setSelectedAdvance(item.cash_advances_id); setShowDetailModal(true); }}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-700 font-display">{item.employee_name}</div>
                      <div className="text-xs text-slate-500">Requested: {item.date_requested ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{item.restaurant}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-700">{formatCurrency(item.amount)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-700">{formatCurrency(item.balance_remaining)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusStyles[item.status] ?? 'bg-slate-100 text-slate-600'}`}>{item.status}</span>
                    </td>
                  </tr>
                ))
              )}
              {emptyRowsCount > 0 && (
                Array.from({ length: emptyRowsCount }).map((_, ei) => (
                  <tr key={`empty-${ei}`} className="invisible">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-700 font-display">Placeholder</div>
                      <div className="text-xs text-slate-500">Requested: 2020-01-01</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">Restaurant</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-700">PHP 0.00</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-700">PHP 0.00</td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded-full font-medium">Status</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationFooter items={filteredAdvances} page={page} setPage={setPage} pageSize={PAGE_SIZE} noun="advances" />
      </div>

      {selectedRecord && (
        <Modal open={showDetailModal} title="Cash Advance Details" onClose={() => setShowDetailModal(false)}>
          <div className="space-y-3 w-full max-w-md">
            <div className="w-md grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-400">Employee</p>
                <p className="text-sm font-medium">{selectedRecord.employee_name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Restaurant</p>
                <p className="text-sm font-medium">{selectedRecord.restaurant}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Amount</p>
                <p className="text-sm font-medium">{formatCurrency(selectedRecord.amount)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Balance</p>
                <p className="text-sm font-medium">{formatCurrency(selectedRecord.balance_remaining)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Requested</p>
                <p className="text-sm font-medium">{selectedRecord.date_requested ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Released</p>
                <p className="text-sm font-medium">{selectedRecord.date_released ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Approved by</p>
                <p className="text-sm font-medium">{selectedRecord.approved_name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Status</p>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusStyles[selectedRecord.status] ?? 'bg-slate-100 text-slate-600'}`}>
                  {selectedRecord.status}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-400">Payment ledger</p>
                {/* Add payment button: visible only when status is released and not fully paid */}
                {(selectedRecord.status === 'released' && !selectedRecord.is_fully_paid) && (
                  <button onClick={() => setShowPayment(true)} className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                    <Plus size={12} /> Add payment
                  </button>
                )}
              </div>
              {selectedRecord.payments.length === 0 ? (
                <p className="text-sm text-slate-400 py-2">No payment rows recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {selectedRecord.payments.map(payment => (
                    <div key={payment.cash_advance_payments_id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm">
                      <div>
                        <div className="font-medium">{payment.report_period_label}</div>
                        <div className="text-xs text-slate-400">{payment.created_at ? String(payment.created_at).slice(0, 10) : '—'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{formatCurrency(payment.amount_deducted)}</div>
                        <button
                          onClick={() => deletePayment(selectedRecord.cash_advances_id, payment.cash_advance_payments_id, payment.report_period_label)}
                          className="p-1 text-slate-400 hover:text-red-600"
                          title="Delete payment"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Status section: hide entirely for locked statuses (cancelled, rejected, released) */}
            {!lockedStatuses.includes(selectedRecord.status as any) && (
              <div className="pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-400 mb-2">Status</p>
                <div className="flex items-center gap-2">
                  <select
                    value={draftStatus || selectedRecord.status}
                    onChange={(e) => setDraftStatus(e.target.value)}
                    className={`flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100`}
                  >
                    {/* Always show the current status first */}
                    <option key="current" value={selectedRecord.status}>{selectedRecord.status}</option>
                    {/* Then show available next statuses (if any) */}
                    {selectedStatusOptions.map(status => (
                      // avoid duplicating the current status if present
                      status === selectedRecord.status ? null : (
                        <option key={status} value={status}>{status}</option>
                      )
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => { setShowDetailModal(false); setShowStatusModal(true) }}
                    className="px-3 py-2 text-sm text-white bg-indigo-700 hover:bg-indigo-600 rounded-lg whitespace-nowrap"
                  >
                    Update Status
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              {/* Edit button: hidden for locked statuses */}
              {!lockedStatuses.includes(selectedRecord.status as any) && (
                <button
                  type="button"
                  onClick={() => {
                    // populate edit draft and open modal
                    setEditDraft({
                      restaurant: selectedRecord.restaurant || 'Lakay Ago',
                      amount: String(selectedRecord.amount ?? ''),
                      dateRequested: selectedRecord.date_requested ?? new Date().toISOString().slice(0,10),
                      remarks: selectedRecord.remarks ?? '',
                    })
                    setShowEditModal(true)
                  }}
                  className="px-3 py-2 text-sm text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Edit
                </button>
              )}

              {/* Delete button: hidden for locked statuses */}
              {!lockedStatuses.includes(selectedRecord.status as any) && (
                <button
                  type="button"
                  onClick={() => { setShowDetailModal(false); setDeleteTarget(selectedRecord) }}
                  className="px-3 py-2 text-sm text-white bg-red-700 hover:bg-red-600 rounded-lg"
                >
                  Delete
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
      {showEditModal && selectedRecord && (
        <Modal open={showEditModal} title="Edit Cash Advance" onClose={() => setShowEditModal(false)}>
          <div className="w-full p-2">
            <div className="space-y-4 w-md">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Restaurant</label>
                <select value={editDraft.restaurant} onChange={e => setEditDraft(prev => ({ ...prev, restaurant: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400">
                  {['Lakay Ago', 'Aroo', 'Both'].map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Amount</label>
                <input type="number" min="0" step="0.01" value={editDraft.amount} onChange={e => setEditDraft(prev => ({ ...prev, amount: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Date Requested</label>
                <input type="date" value={editDraft.dateRequested} onChange={e => setEditDraft(prev => ({ ...prev, dateRequested: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Remarks</label>
                <textarea value={editDraft.remarks} onChange={e => setEditDraft(prev => ({ ...prev, remarks: e.target.value }))} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 resize-none" placeholder="Optional notes" />
              </div>
            </div>
            <div className="mt-5 flex gap-3 justify-end">
              <button onClick={() => setShowEditModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={() => void updateAdvance(selectedRecord.cash_advances_id)} className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">Save</button>
            </div>
          </div>
        </Modal>
      )}

      {showCreate && (
        <Modal open={showCreate} title="Create Cash Advance" onClose={() => setShowCreate(false)}>
          <div className="w-full p-2">
            <div className="space-y-4 w-md">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Employee</label>
                <select value={draft.employeeId} onChange={e => setDraft(prev => ({ ...prev, employeeId: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400">
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Restaurant</label>
                <select value={draft.restaurant} onChange={e => setDraft(prev => ({ ...prev, restaurant: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400">
                  {['Lakay Ago', 'Aroo', 'Both'].map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Amount</label>
                <input type="number" min="0" step="0.01" value={draft.amount} onChange={e => setDraft(prev => ({ ...prev, amount: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Date Requested</label>
                <input type="date" value={draft.dateRequested} onChange={e => setDraft(prev => ({ ...prev, dateRequested: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Remarks</label>
                <textarea value={draft.remarks} onChange={e => setDraft(prev => ({ ...prev, remarks: e.target.value }))} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 resize-none" placeholder="Optional notes" />
              </div>
            </div>
            <div className="mt-5 flex gap-3 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={() => void addAdvance()} className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">Save</button>
            </div>
          </div>
        </Modal>
      )}

      {showPayment && selectedRecord && (
        <Modal open={showPayment} title="Record payroll deduction" onClose={() => setShowPayment(false)}>
          <div className="w-full p-2">
            <div className="space-y-4 w-md">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Payroll Period</label>
                <select value={paymentDraft.reportPeriodId} onChange={e => setPaymentDraft(prev => ({ ...prev, reportPeriodId: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400">
                  {reportPeriodOptions.map(period => <option key={period.id} value={period.id}>{period.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Amount Deducted</label>
                <input type="number" min="0" step="0.01" value={paymentDraft.amount} onChange={e => setPaymentDraft(prev => ({ ...prev, amount: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" />
              </div>
            </div>
            <div className="mt-5 flex gap-3 justify-end">
              <button onClick={() => setShowPayment(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={() => void addPayment()} className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">Post payment</button>
            </div>
          </div>
        </Modal>
      )}
      {deleteTarget && (
        <Modal open={true} title="Delete Cash Advance" onClose={() => setDeleteTarget(null)}>
          <div className="p-6">
            <p className="mb-4">Are you sure you want to delete this cash advance?</p>
            <div className="flex gap-3">
              <button onClick={() => { setDeleteTarget(null); showToast({ type: 'error', message: 'Delete cancelled' }) }} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
              <button onClick={() => confirmDeleteAdvance(deleteTarget!.cash_advances_id)} className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg font-display">Delete</button>
            </div>
          </div>
        </Modal>
      )}
      {deletePaymentTarget && (
        <Modal open={true} title="Delete Payment" onClose={() => setDeletePaymentTarget(null)}>
          <div className="p-6">
            <p className="mb-4">Are you sure you want to delete this payment for {deletePaymentTarget!.label}?</p>
            <div className="flex gap-3">
              <button onClick={() => { setDeletePaymentTarget(null); showToast({ type: 'error', message: 'Delete cancelled' }) }} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
              <button onClick={() => confirmDeletePayment(deletePaymentTarget!.advanceId, deletePaymentTarget!.paymentId)} className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg font-display">Delete</button>
            </div>
          </div>
        </Modal>
      )}
      {showStatusModal && (
        <Modal open={true} title="Update Cash Advance Status" onClose={() => setShowStatusModal(false)}>
          <div className="p-6">
            <p className="mb-4">Are you sure you want to update the status to <span className="font-semibold text-slate-800">{draftStatus}</span>?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowStatusModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
              <button onClick={() => { setShowStatusModal(false); updateStatus(selectedRecord.cash_advances_id, draftStatus) }} className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display">Update</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
