'use client'
import { useCallback, useEffect, useState } from 'react'
import { CheckCircle, XCircle, X, Plus } from 'lucide-react'
import type { LeaveRequest } from '../types'
import { useApp } from '../App'
import useIsMobile from '../hooks/isMobile'
import Modal from '../components/Modal'

const statusColor: Record<LeaveRequest['status'], string> = {
  Pending: 'bg-amber-200 text-amber-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-red-100 text-red-700',
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
};

const leaveColors = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-orange-100 text-orange-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
  'bg-cyan-100 text-cyan-700',
  'bg-slate-100 text-slate-600',
]

const leaveTypes = ['Vacation Leave', 'Sick Leave', 'Emergency Leave', 'Maternity Leave', 'Paternity Leave', 'Bereavement Leave', 'Unpaid Leave']

function ApproveRejectModal({ leave, action, onClose, onConfirm }: {
  leave: LeaveRequest; action: 'Approve' | 'Reject'; onClose: () => void; onConfirm: () => void
}) {
  return (
    <Modal open={true} title={`${action} Leave Request?`} onClose={onClose}>
      <div className="p-2">
        <div className="bg-slate-50 rounded-xl p-4 mb-5 space-y-2">
          <p className="text-sm font-semibold text-slate-700 font-display">Name: <label className="text-slate-500">{leave.employeeName}</label></p>
          <p className="text-sm font-semibold text-slate-700 mt-0.5">Restaurant: <label className="text-slate-500">{leave.restaurant}</label></p>
          <p className="text-sm font-semibold text-slate-700 mt-0.5">Leave Type: <label className="text-slate-500">{leave.leaveType}</label></p>
          <p className="text-sm font-semibold text-slate-700 mt-0.5">From: <label className="text-slate-500">{formatDate(leave.startDate)}</label></p>
          <p className="text-sm font-semibold text-slate-700 mt-0.5">To: <label className="text-slate-500">{formatDate(leave.endDate)}</label></p>
          <p className="text-sm font-semibold text-slate-700 mt-0.5">Days: <label className="text-slate-500">{leave.days}</label></p>
          <p className="text-sm font-semibold text-slate-700 mt-1 italic">{leave.reason}</p>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg font-display ${action === 'Approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
          >
            {action} Leave
          </button>
        </div>
      </div>
    </Modal>
  )
}

function AddLeaveModal({ employees, leaveTypesList, onClose, onSave }: {
  employees: any[]
  leaveTypesList: any[]
  onClose: () => void
  onSave: () => void
}) {
  const { showToast } = useApp()
  const [form, setForm] = useState({
    employee_id: '',
    employee_restaurant: '',
    leave_type_id: '',
    leave_type_name: '',
    start_date: '',
    end_date: '',
    reason: '',
  })
  const [loading, setLoading] = useState(false)

  const filteredEmployeesByRestaurant = form.employee_restaurant
    ? employees.filter(emp => (emp.restaurant || '').toLowerCase() === form.employee_restaurant.toLowerCase())
    : employees

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.employee_id || !form.leave_type_name || !form.start_date || !form.end_date) {
      showToast({ type: 'error', message: 'Missing required fields', description: 'Employee, leave type, start and end date are required.' })
      return
    }
    const start = new Date(form.start_date)
    const end = new Date(form.end_date)
    if (end < start) {
      showToast({ type: 'error', message: 'Invalid dates', description: 'End date cannot be before start date.' })
      return
    }
    const diffMs = end.getTime() - start.getTime()
    const calcDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1
    const selectedLt = leaveTypesList.find((t: any) => String(t.name || t.leave_type_name) === form.leave_type_name)
    const leaveNumber = Number(selectedLt?.leave_number ?? 0)
    if (leaveNumber > 0 && calcDays > leaveNumber) {
      showToast({ type: 'error', message: 'Exceeds leave entitlement', description: `${form.leave_type_name} only allows ${leaveNumber} day(s). You requested ${calcDays} day(s).` })
      return
    }
    setLoading(true)
    try {
      const emp = employees.find((x: any) => String(x.id) === String(form.employee_id))
      const res = await fetch('/api/leave_requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: form.employee_id,
          leave_type_id: form.leave_type_id || null,
          leave_type_name: form.leave_type_name,
          start_date: form.start_date,
          end_date: form.end_date,
          days: Math.floor((new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1,
          reason: form.reason || null,
          employee_name: emp ? `${emp.firstName} ${emp.lastName}`.trim() : null,
          department: emp?.department || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create leave request')
      }
      showToast({ type: 'success', message: 'Leave request created', description: 'The leave request has been submitted for approval.' })
      onSave()
      onClose()
    } catch (err: any) {
      showToast({ type: 'error', message: 'Create failed', description: err.message || 'Could not create leave request' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={true} title="Add Leave Request" onClose={onClose}>
      <form onSubmit={handleSubmit} className="bg-white w-full max-h-[70vh] flex flex-col">
        <div className="w-xl flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1 font-display">Employee Name *</label>
              <select
                value={form.employee_id}
                onChange={e => setForm(prev => ({ ...prev, employee_id: e.target.value }))}
                disabled={!form.employee_restaurant}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 font-display disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                required
              >
                <option value="">{form.employee_restaurant ? 'Select Employee' : 'Select Restaurant First'}</option>
                {filteredEmployeesByRestaurant.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1 font-display">Employee Restaurant</label>
              <select
                value={form.employee_restaurant}
                onChange={e => {
                  const selectedRestaurant = e.target.value
                  setForm(prev => ({
                    ...prev,
                    employee_restaurant: selectedRestaurant,
                    employee_id: selectedRestaurant ? prev.employee_id : '',
                  }))
                }}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 font-display"
              >
                <option value="">Select Restaurant</option>
                {Array.from(new Set((employees || []).map(emp => emp.restaurant).filter(Boolean))).map((restaurant) => (
                  <option key={restaurant} value={restaurant}>{restaurant}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1 font-display">Leave Type *</label>
            <select
              value={form.leave_type_name}
              onChange={e => {
                const lt = leaveTypesList.find((t: any) => String(t.name || t.leave_type_name) === e.target.value)
                setForm(prev => ({ ...prev, leave_type_name: e.target.value, leave_type_id: lt ? String(lt.leave_type_id) : '' }))
              }}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 font-display"
              required
            >
              <option value="">Select Leave Type</option>
              {leaveTypesList.map((lt, i) => (
                <option key={`${lt.leave_type_id || i}-${lt.name || lt.leave_type_name}`} value={lt.name || lt.leave_type_name}>
                  {lt.name || lt.leave_type_name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1 font-display">Start Date *</label>
              <input type="date" value={form.start_date} onChange={e => setForm(prev => ({ ...prev, start_date: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" required />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1 font-display">End Date *</label>
              <input type="date" value={form.end_date} onChange={e => setForm(prev => ({ ...prev, end_date: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" required />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1 font-display">Days</label>
            <input
              type="number"
              value={(() => {
                if (!form.start_date || !form.end_date) return 1
                const s = new Date(form.start_date)
                const e = new Date(form.end_date)
                return Math.max(1, Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1)
              })()}
              readOnly
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none bg-slate-50 text-slate-500 cursor-not-allowed caret-transparent"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1 font-display">Reason</label>
            <textarea value={form.reason} onChange={e => setForm(prev => ({ ...prev, reason: e.target.value }))} rows={3} placeholder="Optional note about this leave..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none font-display" />
          </div>
        </div>
        <div className="px-4 py-3 border-t border-slate-100 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
          <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display">{loading ? 'Creating...' : 'Submit Request'}</button>
        </div>
      </form>
    </Modal>
  )
}

function AddLeaveTypeModal({ onClose, onSave, defaultRestaurant }: { onClose: () => void; onSave: () => void; defaultRestaurant?: string }) {
  const { showToast } = useApp()
  const [form, setForm] = useState({ name: '', leave_number: 0, restaurant: defaultRestaurant || 'Both', is_paid: true })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) {
      showToast({ type: 'error', message: 'Name required', description: 'Please enter a leave type name.' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/leave_types', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...form, is_paid: Boolean(form.is_paid) }) })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create leave type')
      }
      showToast({ type: 'success', message: 'Leave type created', description: `${form.name} created.` })
      onSave()
      onClose()
    } catch (err: any) {
      showToast({ type: 'error', message: 'Create failed', description: err.message || 'Could not create leave type' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={true} title="Add Leave Type" onClose={onClose}>
      <form onSubmit={handleSubmit} className="bg-white w-full">
        <div className="px-4 py-4 space-y-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1 font-display">Name *</label>
            <input value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1 font-display">Restaurant</label>
            <select value={form.restaurant} onChange={e => setForm(prev => ({ ...prev, restaurant: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400">
              <option value="Both">Both</option>
              <option value="Lakay Ago">Lakay Ago</option>
              <option value="Aroo">Aroo</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1 font-display">Leave Number per Employee</label>
            <input type="number" min={0} value={form.leave_number} onChange={e => setForm(prev => ({ ...prev, leave_number: Number(e.target.value || 0) }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 font-display">
            <input type="checkbox" checked={Boolean(form.is_paid)} onChange={e => setForm(prev => ({ ...prev, is_paid: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            Paid leave type
          </label>
        </div>
        <div className="px-4 py-3 border-t border-slate-100 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">{loading ? 'Saving...' : 'Create'}</button>
        </div>
      </form>
    </Modal>
  )
}

export default function LeaveManagement() {
  const { showToast } = useApp()
  const isMobile = useIsMobile()
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null)
  const [tab, setTab] = useState<'requests' | 'balances' | 'list'>('requests')
  const [actionModal, setActionModal] = useState<{ leave: LeaveRequest; action: 'Approve' | 'Reject' } | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [leaveRequests, setLeaveRequests] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [leaveTypesList, setLeaveTypesList] = useState<any[]>([])
  const [leaveBalances, setLeaveBalances] = useState<any[]>([])
  const [showAddLeaveType, setShowAddLeaveType] = useState(false)
  const [showAddLeaveRequest, setShowAddLeaveRequest] = useState(false)
  const [balancePage, setBalancePage] = useState(0)
  const [restaurantFilter, setRestaurantFilter] = useState('')
  const BALANCE_PAGE_SIZE = 9

  const loadLeaveRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/leave_requests')
      if (!res.ok) return
      const body = await res.json()
      setLeaveRequests(body.leaveRequests || [])
      if (body.employees && body.employees.length) setEmployees(body.employees)
      else {
        const r2 = await fetch('/api/employees')
        if (r2.ok) {
          const b2 = await r2.json()
          setEmployees((b2.employees || []).map((e: any) => {
            const parts = (e.name || '').split(' ')
            return { id: e.employee_id, firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '', department: e.department, restaurant: e.restaurant }
          }))
        }
      }
    } catch (err) {
      console.error('Failed to load leave requests', err)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!mounted) return
      await loadLeaveRequests()
      // load leave types and balances
      try {
        const [ltRes, bRes] = await Promise.all([fetch('/api/leave_types'), fetch('/api/employee_leave_balances')])
        if (ltRes.ok) {
          const ltBody = await ltRes.json()
          setLeaveTypesList(ltBody.leaveTypes || ltBody || [])
        }
        if (bRes.ok) {
          const bBody = await bRes.json()
          setLeaveBalances(bBody.balances || bBody || [])
        }
      } catch (err) {
        console.error('Failed to load leave meta', err)
      }
    })()
    return () => { mounted = false }
  }, [loadLeaveRequests])

  // Derived leave types and balances fetched from backend. leave_number (total entitlement)
  // is stored on `leave_types.leave_number`; per-employee remaining is `employee_leave_balances.available_leave`.
  // used_leave = leave_number - available_leave (computed)

  function getVisibleLeaveTypes(employeeId: string) {
    const emp = employees.find(e => String(e.id) === String(employeeId))
    const sex = emp?.sex ?? ''
    const empDept = (emp?.restaurant ?? '').trim()
    return (leaveTypesList || []).filter((t: any) => {
      if (sex === 'Male' && t.name === 'Maternity Leave') return false
      if (sex === 'Female' && t.name === 'Paternity Leave') return false
      const r = (t.restaurant || 'Both').trim()
      if (r === 'Both') return true
      return r === empDept
    }).map((t: any) => t.name)
  }

  function getLeaveBalances(employeeId: string) {
    const types = getVisibleLeaveTypes(employeeId)

    return types.map((typeName) => {
      const lt = (leaveTypesList || []).find((t: any) => t.name === typeName)
      const total = Number(lt?.leave_number ?? 0)
      const approvedUsed = (leaveRequests || [])
        .filter((l: any) =>
          String(l.employeeId ?? l.employee_id) === String(employeeId) &&
          String(l.leaveType ?? l.leave_type_name) === typeName &&
          l.status === 'Approved'
        )
        .reduce((sum: number, l: any) => sum + Number(l.days ?? 0), 0)
      const used = Math.max(0, approvedUsed)
      return { type: typeName, used, total, remaining: Math.max(0, total - used) }
    })
  }

  const getLeaveTypeMeta = (leaveTypeName?: string) => {
    if (!leaveTypeName) return null
    return (leaveTypesList || []).find((t: any) => String(t.name || t.leave_type_name) === String(leaveTypeName)) ?? null
  }

  const renderPaidBadge = (isPaid?: boolean) => (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
      {isPaid ? 'Paid' : 'Unpaid'}
    </span>
  )

  const filtered = leaveRequests.filter(l => {
  if (!statusFilter || l.status === statusFilter) {
    if (restaurantFilter && l.employee_id !== null) {
      const emp = employees.find(e => String(e.id) === String(l.employee_id))
      if (emp && emp.restaurant !== restaurantFilter) {
        return false
      }
    }
    return true
  }
  return false
  });
  
  const isOnLeave = (request: any) => {
    const start = new Date(request.startDate)
    const end = new Date(request.endDate)
    const today = new Date()
    return request.status === 'Approved' && today >= start && today <= end
  }

  const countEmployeesOnLeave = () => {
    const approvedRequests = leaveRequests.filter(l => isOnLeave(l))
    const uniqueEmployeeIds = new Set()
    approvedRequests.forEach(request => {
      if (request.employee_id) {
        uniqueEmployeeIds.add(request.employee_id)
      }
    })
    return uniqueEmployeeIds.size
  }

  const pending = leaveRequests.filter(l => l.status === 'Pending').length
  const approved = leaveRequests.filter(l => l.status === 'Approved').length
  const rejected = leaveRequests.filter(l => l.status === 'Rejected').length
  const employeesOnLeave = countEmployeesOnLeave()

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 font-display">Leave Management</h2>
        <p className="text-sm text-slate-500 mt-0.5">Manage employee leave requests and balances</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Pending Requests', value: pending, color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
          { label: 'Approved', value: approved, color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
          { label: 'Rejected', value: rejected, color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
          { label: 'Employees on Leave', value: employeesOnLeave, color: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className={`w-10 h-10 rounded-lg ${s.color} flex items-center justify-center mb-3`}>
              <span className={`w-3 h-3 rounded-full ${s.dot}`} />
            </div>
            <p className="text-2xl font-bold text-slate-800 font-display">{s.value}</p>
            <p className="text-sm text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5">
        {[{ id: 'requests', label: 'Leave Requests' }, { id: 'list', label: 'Leave List' }, { id: 'balances', label: 'Leave Balances' }].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 text-sm font-medium rounded-lg font-display
              ${tab === t.id ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'requests' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100">
             <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-3 text-sm text-slate-600 bg-white outline-none focus:border-indigo-400 font-display">
               <option value="">Status: All</option>
               <option>Pending</option>
               <option>Approved</option>
               <option>Rejected</option>
             </select>
             <div className="flex-1 flex justify-end">
              <button
                onClick={() => setShowAddLeaveRequest(true)}
                className="px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-display"
              >
                Add Leave Request
              </button>
             </div>
           </div>
          <div className="overflow-x-auto">
            {!isMobile ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {['Employee', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Status'].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(leave => {
                    const ltIdx = leaveTypes.indexOf(leave.leaveType) % leaveColors.length
                    return (
                      <tr
                        key={leave.id}
                        className="hover:bg-slate-50 group cursor-pointer"
                        onClick={() => setSelectedLeave(leave)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setSelectedLeave(leave)
                          }
                        }}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                              <span className="text-indigo-700 text-[10px] font-bold font-display">
                                {leave.employeeName.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-700 font-display whitespace-nowrap">{leave.employeeName}</p>
                              <p className="text-xs text-slate-400">{leave.restaurant || leave.employeeRestaurant || 'Both'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium font-display ${leaveColors[ltIdx]}`}>{leave.leaveType}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap">{formatDate(leave.startDate)}</td>
                        <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap">{formatDate(leave.endDate)}</td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-700">{leave.days}</td>
                        <td className="py-3 px-4">
                          {(() => {
                            const key = leave.status as keyof typeof statusColor
                            return <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium font-display ${statusColor[key]}`}>{leave.status}</span>
                          })()}
                        </td>
                        <td className="py-3 px-4">{/* Actions moved into detail modal */}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col">
                {filtered.map(leave => (
                    <button key={leave.id} onClick={() => setSelectedLeave(leave)} className="text-left p-3 border-b border-slate-50 hover:bg-slate-50 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-700">{leave.employeeName}</div>
                      <div className="text-xs text-slate-400">{leave.leaveType} • {formatDate(leave.startDate)}</div>
                    </div>
                      {(() => {
                        const key = leave.status as keyof typeof statusColor
                        return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor[key]}`}>{leave.status}</span>
                      })()}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'list' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700 font-display">Leave Types</h3>
            <button onClick={() => setShowAddLeaveType(true)} className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 font-display">
              <Plus size={14} /> Add Leave Type
            </button>
          </div>
          <div className="px-4 py-3 border-b border-slate-100">
            <select value={restaurantFilter} onChange={e => setRestaurantFilter(e.target.value)} className="px-2 py-1 text-sm border border-slate-200 rounded">
              <option value="">All Restaurants</option>
              <option value="Lakay Ago">Lakay Ago</option>
              <option value="Aroo">Aroo</option>
              <option value="Both">Both</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Name', 'Leave Number', 'Restaurant', 'Is Paid'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {leaveTypesList.filter(lt => !restaurantFilter || lt.restaurant === restaurantFilter).map((lt: any) => (
                  <tr key={lt.leave_type_id}>
                    <td className="py-3 px-4 text-sm font-medium text-slate-700 font-display">{lt.name}</td>
                    <td className="py-3 px-4 text-sm text-slate-600 font-mono">{lt.leave_number}</td>
                    <td className="py-3 px-4 text-sm text-slate-500">{lt.restaurant}</td>
                    <td className="py-3 px-4 text-sm text-slate-500">{renderPaidBadge(Boolean(lt.is_paid))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'balances' && (
        <div>
          {(() => {
            const totalPages = Math.ceil(employees.length / BALANCE_PAGE_SIZE)
            let filteredEmployees = employees
            if (restaurantFilter) {
              filteredEmployees = employees.filter(e => e.restaurant === restaurantFilter || e.restaurant === 'Both')
            }
            const paged = filteredEmployees.slice(balancePage * BALANCE_PAGE_SIZE, (balancePage + 1) * BALANCE_PAGE_SIZE)
            return (
              <>
                <div className="flex items-center justify-end mb-3">
                  <select value={restaurantFilter} onChange={e => setRestaurantFilter(e.target.value)} className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                    <option value="">All Restaurants</option>
                    <option value="Lakay Ago">Lakay Ago</option>
                    <option value="Aroo">Aroo</option>
                    <option value="Both">Both</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paged.map(emp => {
                    const balances = getLeaveBalances(emp.id)

                    return (
                      <div key={emp.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                            <span className="text-indigo-700 text-xs font-bold font-display">{emp.firstName[0]}{emp.lastName[0]}</span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-700 font-display">{emp.firstName} {emp.lastName}</p>
                            <p className="text-xs text-slate-400">{emp.department}</p>
                            <p className="text-xs text-slate-400">{emp.restaurant}</p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          {balances.map(balance => (
                            <div key={balance.type}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-600 font-display">{balance.type}</span>
                                <span className="text-slate-400 font-mono">{balance.used}/{balance.total} days</span>
                              </div>
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${balance.used / Math.max(balance.total, 1) > 0.7 ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${balance.total === 0 ? 0 : (balance.used / balance.total) * 100}%` }} />
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5">{balance.remaining} days remaining</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-end gap-3 mt-5">
                    <button
                      onClick={() => setBalancePage(p => Math.max(0, p - 1))}
                      disabled={balancePage === 0}
                      className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-display"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-slate-500 font-display">
                      Page {balancePage + 1} of {totalPages}
                    </span>
                    <button
                      onClick={() => setBalancePage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={balancePage >= totalPages - 1}
                      className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-display"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}

      {selectedLeave && (
        <Modal open={!!selectedLeave} title={`${selectedLeave.employeeName} — ${selectedLeave.leaveType}`} onClose={() => setSelectedLeave(null)}>
          <div className={`w-full p-3 overflow-y-auto ${isMobile ? 'max-h-[50vh]' : ''}`}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-slate-400">Name</p>
                  <p className="text-sm font-medium">{selectedLeave.employeeName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Restaurant</p>
                  <p className="text-sm font-medium">{selectedLeave.restaurant || selectedLeave.employeeRestaurant || 'Both'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Status</p>
                  <p className="text-sm font-medium">{selectedLeave.status}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Days</p>
                  <p className="text-sm font-medium">{selectedLeave.days}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Start</p>
                  <p className="text-sm font-medium">{formatDate(selectedLeave.startDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">End</p>
                  <p className="text-sm font-medium">{formatDate(selectedLeave.endDate)}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-400">Reason</p>
                <p className="text-sm text-slate-600">{selectedLeave.reason}</p>
              </div>
              {/* Leave balances */}
              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs text-slate-400">Leave Balances</p>
                <div className="space-y-3 mt-2">
                  {getLeaveBalances(selectedLeave.employeeId).map(b => (
                    <div key={b.type}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600">{b.type}</span>
                        <span className="text-slate-400 font-mono">{b.used}/{b.total} days</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${b.used / Math.max(b.total,1) > 0.7 ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${b.total === 0 ? 0 : (b.used / b.total) * 100}%` }} />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{b.remaining} days remaining</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-4">
              {selectedLeave.status === 'Pending' && (
                <>
                  <button
                    onClick={() => {
                      setActionModal({ leave: selectedLeave, action: 'Reject' })
                    }}
                    className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 font-display"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => {
                      setActionModal({ leave: selectedLeave, action: 'Approve' })
                    }}
                    className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-display"
                  >
                    Approve
                  </button>
                </>
              )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {actionModal && (
        <ApproveRejectModal
          leave={actionModal.leave}
          action={actionModal.action}
          onClose={() => setActionModal(null)}
          onConfirm={async () => {
            const { leave, action } = actionModal
            try {
              const res = await fetch(`/api/leave_requests/${leave.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: action }),
              })
              const body = await res.json().catch(() => ({}))
              if (!res.ok) {
                throw new Error(body?.error || 'Failed to update leave request')
              }

              const updatedLeave = body?.leaveRequest || body?.updatedLeaveRequest || leave
              const updatedBalance = body?.balance || null

              setLeaveRequests(prev => prev.map(item => String(item.id) === String(leave.id) ? { ...item, status: updatedLeave.status ?? item.status } : item))
              if (updatedBalance) {
                setLeaveBalances(prev => {
                  const idx = prev.findIndex((b: any) => String(b.employee_id) === String(leave.employeeId) && Number(b.leave_type_id) === Number(updatedBalance.leave_type_id))
                  if (idx >= 0) {
                    const updated = [...prev]
                    updated[idx] = { ...updated[idx], ...updatedBalance }
                    return updated
                  }
                  return [...prev, updatedBalance]
                })
              }

              showToast({
                type: action === 'Approve' ? 'success' : 'info',
                message: `Leave ${action.toLowerCase()}d`,
                description: `${leave.leaveType} for ${leave.employeeName} has been ${action.toLowerCase()}d.`
              })
            } catch (err: any) {
              showToast({ type: 'error', message: 'Update failed', description: err.message || 'Could not update leave request' })
            }
            setActionModal(null)
            setSelectedLeave(null)
          }}
        />
      )}
      {showAddLeaveType && (
        <AddLeaveTypeModal
          defaultRestaurant={undefined}
          onClose={() => setShowAddLeaveType(false)}
          onSave={async () => {
            try {
              const [ltRes, bRes] = await Promise.all([fetch('/api/leave_types'), fetch('/api/employee_leave_balances')])
              if (ltRes.ok) {
                const ltBody = await ltRes.json()
                setLeaveTypesList(ltBody.leaveTypes || ltBody || [])
              }
              if (bRes.ok) {
                const bBody = await bRes.json()
                setLeaveBalances(bBody.balances || bBody || [])
              }
            } catch (err) {
              console.error('Failed to refresh leave meta after create', err)
            }
          }}
        />
      )}
      {showAddLeaveRequest && (
        <AddLeaveModal
          employees={employees}
          leaveTypesList={leaveTypesList}
          onClose={() => setShowAddLeaveRequest(false)}
          onSave={async () => {
            await loadLeaveRequests()
          }}
        />
      )}
    </div>
  )
}
