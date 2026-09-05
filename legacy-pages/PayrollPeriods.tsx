'use client'
import { useCallback, useEffect, useState } from 'react'
import { Plus, ArrowRight, X, Download } from 'lucide-react'
import useIsMobile from '../hooks/isMobile'
const payrollPeriods: any[] = []
// note: keep fallback `payrollPeriods` available for safety; prefer backend data when available
import type { PayrollPeriod } from '../types'
import { useApp } from '../App'
import Modal from '../components/Modal'

const fmt = (n: number) =>
  n === 0 ? '—' : new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(n)

const statusColor: Record<string, string> = {
  'Pending': 'bg-slate-100 text-slate-500',
  'Attendance Imported': 'bg-blue-100 text-blue-700',
  'Validation Required': 'bg-amber-100 text-amber-700',
  'Ready for Payroll': 'bg-indigo-100 text-indigo-700',
  Calculated: 'bg-violet-100 text-violet-700',
  'Under Review': 'bg-orange-100 text-orange-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Finalized: 'bg-emerald-100 text-emerald-700',
  released: 'bg-emerald-100 text-emerald-700',
  Released: 'bg-emerald-100 text-emerald-700',
}

function CreatePeriodModal({ onClose, onSave, existingPeriods, existingPeriod }: { onClose: () => void; onSave: () => void; existingPeriods: any[]; existingPeriod?: any | null }) {
  const { showToast, appMode } = useApp()
  const [periodStart, setPeriodStart] = useState(existingPeriod?.period_start ?? 'yyyy/mm/dd')
  const [periodEnd, setPeriodEnd] = useState(existingPeriod?.period_end ?? 'yyyy/mm/dd')
  const [tabulationDate, setTabulationDate] = useState(existingPeriod?.tabulation_date ?? 'yyyy/mm/dd')

  const restaurant = existingPeriod?.restaurant ?? (appMode === 'aroo' ? 'Aroo' : 'Lakay Ago')

  const handleSave = async () => {
    // Check for overlapping periods
    const newStart = new Date(periodStart)
    const newEnd = new Date(periodEnd)
    
    const hasOverlap = existingPeriods.some(p => {
      if (String(p.restaurant || '').trim() !== String(restaurant).trim()) return false
      const existingStart = new Date(p.period_start)
      const existingEnd = new Date(p.period_end)
      // Overlap if: newStart <= existingEnd AND existingStart <= newEnd
      return newStart <= existingEnd && existingStart <= newEnd
    })
    
    if (hasOverlap && !existingPeriod) {
      showToast({
        type: 'error',
        message: 'Creation failed',
        description: 'The selected period overlaps with an existing payroll period.',
      })
      return
    }

    try {
      if (existingPeriod) {
        const payload: any = { tabulation_date: tabulationDate, restaurant }
        const res = await fetch(`/api/report_periods/${existingPeriod.report_period_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (res.ok) {
          showToast({ type: 'success', message: 'Payroll period updated' })
          onClose(); onSave()
        } else {
          showToast({ type: 'error', message: 'Update failed', description: data.error || 'Server error' })
        }
      } else {
        const res = await fetch('/api/report_periods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ period_start: periodStart, period_end: periodEnd, tabulation_date: tabulationDate, restaurant }),
        })
        const data = await res.json()
        if (res.ok) {
          showToast({ type: 'success', message: 'Payroll period created', description: `Period ${periodStart} – ${periodEnd} created for ${restaurant}.` })
          onClose(); onSave()
        } else {
          showToast({ type: 'error', message: 'Creation failed', description: data.error || 'Server error' })
        }
      }
    } catch (err) {
      showToast({ type: 'error', message: 'Network error' })
    }
  }

  return (
    <Modal open={true} title="Create Payroll Period" onClose={onClose}>
      <div className="w-full">
        <div className="w-md px-2 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Period Start</label>
              <input
                type="date"
                value={periodStart}
                onChange={e => setPeriodStart(e.target.value)}
                readOnly={!!existingPeriod}
                disabled={!!existingPeriod}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Period End</label>
              <input
                type="date"
                value={periodEnd}
                onChange={e => setPeriodEnd(e.target.value)}
                readOnly={!!existingPeriod}
                disabled={!!existingPeriod}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Tabulation Date</label>
            <input
              type="date"
              value={tabulationDate}
              onChange={e => setTabulationDate(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Restaurant</label>
            <input
              type="text"
              value={restaurant}
              readOnly
              className="w-full border border-slate-200 bg-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 outline-none font-display cursor-default caret-transparent"
            />
          </div>
        </div>
        <div className="px-2 py-4 border-t border-slate-100 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display">{existingPeriod ? 'Save Changes' : 'Create Payroll Period'}</button>
        </div>
      </div>
    </Modal>
  )
}

export default function PayrollPeriods() {
  const { navigate, showToast, setActivePayrollPeriod } = useApp()
  const isMobile = useIsMobile()
  const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriod | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editingPeriod, setEditingPeriod] = useState<any | null>(null)
  const [activeTab, setActiveTab] = useState<'periods' | 'history'>('periods')
  const [periods, setPeriods] = useState<any[] | null>(null)

  const loadPeriods = useCallback(async () => {
    try {
      const res = await fetch('/api/report_periods')
      if (!res.ok) {
        console.error('report_periods fetch failed', res.status, await res.text())
        setPeriods(null)
        return
      }
      const body = await res.json()
      const rawPeriods = body.periods || []
      const transformed = rawPeriods.map((p: any) => ({
        report_period_id: p.report_period_id,
        period_start: p.period_start,
        period_end: p.period_end,
        tabulation_date: p.tabulation_date,
        source_file: p.source_file,
        created_at: p.created_at,
        restaurant: p.restaurant,
        status: p.status,
      }))
      setPeriods(transformed)
    } catch (err) {
      console.error('Failed to fetch report periods', err)
      setPeriods(null)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!mounted) return
      await loadPeriods()
    })()
    return () => { mounted = false }
  }, [loadPeriods])

  const visiblePeriods = (() => {
    const source = periods ?? payrollPeriods
    if (activeTab === 'periods') return source.filter((p: any) => String((p.status || '')).toLowerCase() === 'pending' || String((p.status || '')).toLowerCase() === 'under review')
    // history: include any period that is not Pending or Under Review (e.g., Finalized, Approved, released)
    return source.filter((p: any) => {
      const s = String((p.status || '')).toLowerCase()
      return s !== 'pending' && s !== 'under review'
    })
  })()

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
                    {['Period Start', 'Period End', 'Tabulation Date', 'Restaurant', 'Status'].map(h => (
                      <th key={h} className="text-left py-3 px-7 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {visiblePeriods.map(pp => (
                    <tr
                      key={pp.report_period_id}
                      className="hover:bg-slate-50 group cursor-pointer"
                      onClick={() => setSelectedPeriod(pp)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelectedPeriod(pp)
                        }
                      }}
                    >
                      <td className="py-3.5 px-7">
                        <p className="text-sm font-semibold text-slate-700 font-display">{pp.period_start}</p>
                      </td>
                      <td className="py-3.5 px-7">
                        <p className="text-sm font-semibold text-slate-700 font-display">{pp.period_end}</p>
                      </td>
                      <td className="py-3.5 px-7">
                        <p className="text-sm text-slate-600">{pp.tabulation_date}</p>
                      </td>
                      <td className="py-3.5 px-7">
                        <p className="text-sm text-slate-600">{pp.restaurant}</p>
                      </td>
                      <td className="py-3.5 px-7">
                        {(() => {
                          const key = pp.status as keyof typeof statusColor
                          return <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium font-display whitespace-nowrap ${statusColor[key]}`}>
                            {pp.status === 'Pending' && (!pp.source_file || pp.source_file.length === 0)
                              ? 'No Attendance Sheet'
                              : pp.status}
                          </span>
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col">
                {visiblePeriods.map(pp => (
                  <button key={pp.report_period_id} onClick={() => setSelectedPeriod(pp)} className="text-left p-3 border-b border-slate-50 hover:bg-slate-50 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-700">{pp.period_start} – {pp.period_end}</div>
                      <div className="text-xs text-slate-400">{pp.restaurant} • {pp.tabulation_date}</div>
                    </div>
                    <div className="text-sm text-emerald-700">
                      <div className="text-xs text-slate-400">{pp.status === 'Pending' && (!pp.source_file || pp.source_file.length === 0) ? 'No Attendance Sheet' : pp.status}</div>
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
                    {['Period Start', 'Period End', 'Tabulation Date', 'Restaurant', 'Status'].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {visiblePeriods.map(pp => (
                    <tr
                      key={pp.report_period_id}
                      className="hover:bg-slate-50 group cursor-pointer"
                      onClick={() => setSelectedPeriod(pp)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelectedPeriod(pp)
                        }
                      }}
                    >
                      <td className="py-3.5 px-4">
                        <p className="text-sm font-semibold text-slate-700 font-display">{pp.period_start}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="text-sm font-semibold text-slate-700 font-display">{pp.period_end}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="text-sm text-slate-600">{pp.tabulation_date}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="text-sm text-slate-600">{pp.restaurant}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        {(() => {
                          const key = pp.status as keyof typeof statusColor
                          return <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium font-display whitespace-nowrap ${statusColor[key]}`}>
                            {pp.status === 'Pending' && (!pp.source_file || pp.source_file.length === 0)
                              ? 'No Attendance Sheet'
                              : pp.status}
                          </span>
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col">
                {visiblePeriods.map(pp => (
                  <button key={pp.report_period_id} onClick={() => setSelectedPeriod(pp)} className="text-left p-3 border-b border-slate-50 hover:bg-slate-50 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-700">{pp.period_start} – {pp.period_end}</div>
                      <div className="text-xs text-slate-400">{pp.restaurant} • {pp.tabulation_date}</div>
                    </div>
                    <div className="text-sm text-emerald-700">
                      <div className="text-xs text-slate-400">{pp.status === 'Pending' && (!pp.source_file || pp.source_file.length === 0) ? 'No Attendance Sheet' : pp.status}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {selectedPeriod && (
            <Modal open={!!selectedPeriod} title={`Period: ${selectedPeriod.period_start} – ${selectedPeriod.period_end}`} onClose={() => setSelectedPeriod(null)}>
              <div className="p-3">
                <div className="space-y-3">
                  <div className="w-md grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-slate-400">Restaurant</p>
                      <p className="text-sm font-medium">{selectedPeriod.restaurant}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Status</p>
                      <p className="text-sm font-medium">{selectedPeriod.status}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Period Start</p>
                      <p className="text-sm font-medium">{selectedPeriod.period_start}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Period End</p>
                      <p className="text-sm font-medium">{selectedPeriod.period_end}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Tabulation Date</p>
                      <p className="text-sm font-medium">{selectedPeriod.tabulation_date}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Created</p>
                      <p className="text-sm font-medium">{selectedPeriod.created_at ? new Date(selectedPeriod.created_at).toLocaleDateString() : '—'}</p>
                    </div>
                  </div>
                </div>
            {(() => {
              const s = String(selectedPeriod.status || '').toLowerCase()
              if (s === 'under review') {
                return (
                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={() => {
                        setActivePayrollPeriod({
                          ...selectedPeriod,
                          id: selectedPeriod.report_period_id,
                          period_id: selectedPeriod.report_period_id,
                        })
                        navigate('process-payroll')
                      }}
                      className="flex items-center gap-1 text-xs p-2 rounded-xl font-medium bg-indigo-600 text-white hover:bg-indigo-700 font-display"
                    >
                      Continue <ArrowRight size={12} />
                    </button>
                  </div>
                )
              }
              if (s === 'released') {
                return (
                  <div className="mt-6 flex justify-end">
                    <button
                      className="flex items-center gap-1 text-xs p-2 rounded-xl font-medium bg-indigo-600 text-white hover:bg-indigo-700 font-display"
                      title="Download Report"
                      onClick={async () => {
                        try {
                          const resp = await fetch(`/api/report_periods/${selectedPeriod.report_period_id}/export`)
                          if (!resp.ok) {
                            showToast({ type: 'error', message: 'Export failed' })
                            return
                          }
                          const blob = await resp.blob()
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          const filename = `payroll-${selectedPeriod.report_period_id}.xlsx`
                          a.download = filename
                          document.body.appendChild(a)
                          a.click()
                          a.remove()
                          URL.revokeObjectURL(url)
                        } catch (err) {
                          console.error(err)
                          showToast({ type: 'error', message: 'Export failed' })
                        }
                      }}
                    >
                      <Download size={14} />
                      Download Payroll
                    </button>
                  </div>
                )
              }
              if (s === 'pending') {
                return (
                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={() => {
                        setEditingPeriod(selectedPeriod)
                        setShowCreate(true)
                        setSelectedPeriod(null)
                      }}
                      className="flex items-center gap-1 text-xs p-2 rounded-xl font-medium bg-indigo-600 text-white hover:bg-indigo-700 font-display"
                      title="Edit Payroll Period"
                    >
                      Edit
                    </button>
                  </div>
                )
              }
              return (
                <div className="mt-6 flex justify-end">
                  <button
                    className="flex items-center gap-1 text-xs p-2 rounded-xl font-medium bg-indigo-600 text-white hover:bg-indigo-700 font-display"
                    title="Download Report"
                  >
                    <Download size={14} />
                    Download Payroll
                  </button>
                </div>
              )
            })()}
          </div>
        </Modal>
      )}

      {showCreate && (
        <CreatePeriodModal
          onClose={() => { setShowCreate(false); setEditingPeriod(null) }}
          onSave={() => { setShowCreate(false); setEditingPeriod(null); loadPeriods() }}
          existingPeriods={periods ?? []}
          existingPeriod={editingPeriod}
        />
      )}
    </div>
  )
}
