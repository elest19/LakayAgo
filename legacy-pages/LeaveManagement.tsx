'use client'
import { useState } from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'
import { leaveRequests, employees } from '../data/mockData'
import type { LeaveRequest } from '../types'
import { useApp } from '../App'
import useIsMobile from '../hooks/isMobile'
import Modal from '../components/Modal'

const statusColor: Record<LeaveRequest['status'], string> = {
  Pending: 'bg-amber-200 text-amber-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-red-100 text-red-700',
}

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
      <div className="w-full p-2">
        <div className="bg-slate-50 rounded-xl p-4 mb-5">
          <p className="text-sm font-semibold text-slate-700 font-display">{leave.employeeName}</p>
          <p className="text-xs text-slate-500 mt-0.5">{leave.leaveType} · {leave.startDate} – {leave.endDate} ({leave.days} day{leave.days > 1 ? 's' : ''})</p>
          <p className="text-xs text-slate-500 mt-1 italic">"{leave.reason}"</p>
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

export default function LeaveManagement() {
  const { showToast } = useApp()
  const isMobile = useIsMobile()
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null)
  const [tab, setTab] = useState<'requests' | 'balances'>('requests')
  const [actionModal, setActionModal] = useState<{ leave: LeaveRequest; action: 'Approve' | 'Reject' } | null>(null)
  const [statusFilter, setStatusFilter] = useState('')

  const leaveEntitlements: Record<string, number> = {
    'Vacation Leave': 10,
    'Sick Leave': 10,
    'Emergency Leave': 3,
    'Maternity Leave': 60,
    'Paternity Leave': 7,
    'Bereavement Leave': 5,
    'Unpaid Leave': 0,
  }

  function getVisibleLeaveTypes(employeeId: string) {
    const emp = employees.find(e => e.id === employeeId)
    const sex = emp?.sex ?? ''

    return Object.keys(leaveEntitlements).filter(type => {
      if (sex === 'Male') return type !== 'Maternity Leave'
      if (sex === 'Female') return type !== 'Paternity Leave'
      return true
    })
  }

  function getLeaveBalances(employeeId: string) {
    const types = getVisibleLeaveTypes(employeeId)

    return types.map((type) => {
      const total = leaveEntitlements[type] ?? 0
      const used = leaveRequests
        .filter(l => l.employeeId === employeeId && l.leaveType === type && l.status !== 'Rejected')
        .reduce((sum, l) => sum + l.days, 0)
      return { type, used, total, remaining: Math.max(total - used, 0) }
    })
  }

  const filtered = leaveRequests.filter(l => !statusFilter || l.status === statusFilter)

  const pending = leaveRequests.filter(l => l.status === 'Pending').length
  const approved = leaveRequests.filter(l => l.status === 'Approved').length
  const rejected = leaveRequests.filter(l => l.status === 'Rejected').length

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
          { label: 'Employees on Leave', value: 2, color: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
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
        {[{ id: 'requests', label: 'Leave Requests' }, { id: 'balances', label: 'Leave Balances' }].map(t => (
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
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-600 bg-white outline-none focus:border-indigo-400 font-display">
              <option value="">Status: All</option>
              <option>Pending</option>
              <option>Approved</option>
              <option>Rejected</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            {!isMobile ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {['Employee', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Reason', 'Status'].map(h => (
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
                                {leave.employeeName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-700 font-display whitespace-nowrap">{leave.employeeName}</p>
                              <p className="text-xs text-slate-400">{leave.department}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium font-display ${leaveColors[ltIdx]}`}>{leave.leaveType}</span>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap">{leave.startDate}</td>
                        <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap">{leave.endDate}</td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-700">{leave.days}</td>
                        <td className="py-3 px-4 text-sm text-slate-500 max-w-45 truncate">{leave.reason}</td>
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium font-display ${statusColor[leave.status]}`}>{leave.status}</span>
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
                      <div className="text-xs text-slate-400">{leave.leaveType} • {leave.startDate}</div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor[leave.status]}`}>{leave.status}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'balances' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.slice(0, 9).map(emp => {
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
                  <p className="text-xs text-slate-400">Department</p>
                  <p className="text-sm font-medium">{selectedLeave.department}</p>
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
                  <p className="text-sm font-medium">{selectedLeave.startDate}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">End</p>
                  <p className="text-sm font-medium">{selectedLeave.endDate}</p>
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
          onConfirm={() => {
            const { leave, action } = actionModal
            setActionModal(null)
            showToast({
              type: action === 'Approve' ? 'success' : 'info',
              message: `Leave ${action.toLowerCase()}d`,
              description: `${leave.leaveType} for ${leave.employeeName} has been ${action.toLowerCase()}d.`
            })
          }}
        />
      )}
    </div>
  )
}
