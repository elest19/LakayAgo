import { useState } from 'react'
import { Plus, ArrowRight, X, Eye, Download } from 'lucide-react'
import { payrollPeriods } from '../data/mockData'
import type { PayrollPeriod } from '../types'
import { useApp } from '../App'
import useIsMobile from '../hooks/isMobile'
import Modal from '../components/Modal'

const fmt = (n: number) =>
  n === 0 ? '—' : new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(n)

const statusColor: Record<PayrollPeriod['status'], string> = {
  'Pending': 'bg-slate-100 text-slate-500',
  'Attendance Imported': 'bg-blue-100 text-blue-700',
  'Validation Required': 'bg-amber-100 text-amber-700',
  'Ready for Payroll': 'bg-indigo-100 text-indigo-700',
  Calculated: 'bg-violet-100 text-violet-700',
  'Under Review': 'bg-orange-100 text-orange-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Finalized: 'bg-emerald-100 text-emerald-700',
}

function CreatePeriodModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  return (
    <Modal open={true} title="Create Payroll Period" onClose={onClose}>
      <div className="w-full">
        <div className="w-md px-2 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Payroll Type</label>
            <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 font-display">
              <option>Semi-Monthly</option>
              <option>Monthly</option>
              <option>Bi-Weekly</option>
              <option>Weekly</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Period Start</label>
              <input type="date" defaultValue="2026-09-01" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Period End</label>
              <input type="date" defaultValue="2026-09-15" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Pay Date</label>
            <input type="date" defaultValue="2026-09-20" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
          </div>
        </div>
        <div className="px-2 py-4 border-t border-slate-100 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
          <button onClick={onSave} className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display">Create Payroll Period</button>
        </div>
      </div>
    </Modal>
  )
}

export default function PayrollPeriods() {
  const { navigate, showToast } = useApp()
  const isMobile = useIsMobile()
  const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriod | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [activeTab, setActiveTab] = useState<'periods' | 'history'>('periods')

  const visiblePeriods =
    activeTab === 'periods'
      ? payrollPeriods.filter(p => p.status === 'Pending' || p.status === 'Under Review')
      : payrollPeriods.filter(p => p.status === 'Finalized')

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-display">Payroll Periods</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage payroll processing periods</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg font-display"
        >
          <Plus size={16} /> Create Payroll Period
        </button>
      </div>

      <div className="mb-5">
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-sm">
          {[
            { key: 'periods', label: 'Payroll Periods' },
            { key: 'history', label: 'Payroll History' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as 'periods' | 'history')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors font-display ${
                activeTab === tab.key
                  ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'periods' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            {!isMobile ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {['Payroll Period', 'Employees', 'Attendance', 'Gross Payroll', 'Deductions', 'Net Payroll', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {visiblePeriods.map(pp => (
                    <tr key={pp.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4">
                        <p className="text-sm font-semibold text-slate-700 font-display">{pp.label}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{pp.payrollType} · Pay: {pp.payDate}</p>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600">{pp.employees}</td>
                      <td className="py-3.5 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium font-display ${pp.attendanceStatus === 'Imported' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                          {pp.attendanceStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-700">{fmt(pp.grossPayroll)}</td>
                      <td className="py-3.5 px-4 font-mono text-xs text-red-600">{fmt(pp.deductions)}</td>
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-emerald-700">{fmt(pp.netPayroll)}</td>
                      <td className="py-3.5 px-4">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium font-display whitespace-nowrap ${statusColor[pp.status]}`}>{pp.status}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1">
                          {pp.status !== 'Finalized' && pp.status !== 'Pending' ? (
                            <button
                              onClick={() => navigate('process-payroll')}
                              className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 font-display"
                            >
                              Continue <ArrowRight size={12} />
                            </button>
                          ) : (
                            <button onClick={() => setSelectedPeriod(pp)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" title="View">
                              <Eye size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col">
                {visiblePeriods.map(pp => (
                  <button key={pp.id} onClick={() => setSelectedPeriod(pp)} className="text-left p-3 border-b border-slate-50 hover:bg-slate-50 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-700">{pp.label}</div>
                      <div className="text-xs text-slate-400">{pp.payrollType} • {pp.payDate}</div>
                    </div>
                    <div className="text-sm text-emerald-700">
                      <div className="text-sm font-semibold">{fmt(pp.netPayroll)}</div>
                      <div className="text-xs text-slate-400">{pp.status}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            {!isMobile ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {['Payroll Period', 'Employees', 'Gross Payroll', 'Deductions', 'Net Payroll', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {visiblePeriods.map(pp => (
                    <tr key={pp.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4">
                        <p className="text-sm font-semibold text-slate-700 font-display">{pp.label}</p>
                        <p className="text-xs text-slate-400 mt-0.5">Pay Date: {pp.payDate}</p>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600">{pp.employees}</td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-700">{fmt(pp.grossPayroll)}</td>
                      <td className="py-3.5 px-4 font-mono text-xs text-red-600">{fmt(pp.deductions)}</td>
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-emerald-700">{fmt(pp.netPayroll)}</td>
                      <td className="py-3.5 px-4">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium font-display ${statusColor[pp.status] || 'bg-slate-100 text-slate-500'}`}>{pp.status}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setSelectedPeriod(pp)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" title="View Payroll"><Eye size={14} /></button>
                          {pp.status === 'Finalized' && (
                            <button className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100" title="Download Report"><Download size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col">
                {visiblePeriods.map(pp => (
                  <button key={pp.id} onClick={() => setSelectedPeriod(pp)} className="text-left p-3 border-b border-slate-50 hover:bg-slate-50 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-700">{pp.label}</div>
                      <div className="text-xs text-slate-400">{pp.payDate}</div>
                    </div>
                    <div className="text-sm text-emerald-700">
                      <div className="text-sm font-semibold">{fmt(pp.netPayroll)}</div>
                      <div className="text-xs text-slate-400">{pp.status}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {selectedPeriod && (
        <Modal open={!!selectedPeriod} title={`Payroll Date: ${selectedPeriod.label}`} onClose={() => setSelectedPeriod(null)}>
          <div className="w-full p-3">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-400">Type</p>
                  <p className="text-sm font-medium">{selectedPeriod.payrollType}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Status</p>
                  <p className="text-sm font-medium">{selectedPeriod.status}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Employees</p>
                  <p className="text-sm font-medium">{selectedPeriod.employees}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Pay Date</p>
                  <p className="text-sm font-medium">{selectedPeriod.payDate}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Gross</p>
                  <p className="text-sm font-medium">{fmt(selectedPeriod.grossPayroll)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Net</p>
                  <p className="text-sm font-medium text-emerald-700">{fmt(selectedPeriod.netPayroll)}</p>
                </div>
              </div>
            </div>
            {selectedPeriod.status !== 'Finalized' ? (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => navigate('process-payroll')}
                  className="flex items-center gap-1 text-xs p-2 rounded-xl font-medium bg-indigo-600 text-white hover:bg-indigo-700 font-display"
                >
                  Continue <ArrowRight size={12} />
                </button>
              </div>
            ) : (
              <div className="mt-6 flex justify-end">
                <button 
                className="flex items-center gap-1 text-xs p-2 rounded-xl font-medium bg-indigo-600 text-white hover:bg-indigo-700 font-display" 
                title="Download Report">
                  <Download size={14} />Download Payroll 
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {showCreate && (
        <CreatePeriodModal
          onClose={() => setShowCreate(false)}
          onSave={() => {
            setShowCreate(false)
            showToast({ type: 'success', message: 'Payroll period created', description: 'September 1–15, 2026 has been created.' })
          }}
        />
      )}
    </div>
  )
}
