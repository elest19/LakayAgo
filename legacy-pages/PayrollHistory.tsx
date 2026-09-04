 'use client'
import { useState, useEffect } from 'react'
import { Download } from 'lucide-react'
import useIsMobile from '../hooks/isMobile'
import Modal from '../components/Modal'

const fmt = (n: number) =>
  n === 0 ? '—' : new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(n)

const statusColor: Record<string, string> = {
  'Attendance Pending': 'bg-slate-100 text-slate-500',
  'Under Review': 'bg-orange-100 text-orange-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Finalized: 'bg-emerald-100 text-emerald-700',
  released: 'bg-emerald-100 text-emerald-700',
  Released: 'bg-emerald-100 text-emerald-700',
}

export default function PayrollHistory() {
  const isMobile = useIsMobile()
  const [selectedPeriod, setSelectedPeriod] = useState<any | null>(null)
  const [periods, setPeriods] = useState<any[]>([])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/report_periods')
        if (!res.ok) return
        const body = await res.json()
        if (mounted) {
          console.debug('report_periods fetched', Array.isArray(body.periods) ? body.periods.length : typeof body.periods)
          setPeriods(body.periods || [])
        }
      } catch (err) {
        console.error('Failed to load report periods', err)
      }
    })()
    return () => { mounted = false }
  }, [])

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-display">Payroll History</h2>
          <p className="text-sm text-slate-500 mt-0.5">All processed payroll periods</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 flex flex-wrap gap-3 shadow-sm">
        <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white outline-none focus:border-indigo-400 font-display">
          <option>Date: All</option>
          <option>2026</option>
          <option>2025</option>
        </select>
        <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white outline-none focus:border-indigo-400 font-display">
          <option>Status: All</option>
          <option>Finalized</option>
          <option>Approved</option>
          <option>Under Review</option>
        </select>
        <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white outline-none focus:border-indigo-400 font-display">
          <option>Department: All</option>
          <option>IT</option>
          <option>Finance</option>
          <option>HR</option>
        </select>
      </div>

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
                {periods.filter((p:any) => String((p.status || '')).toLowerCase() !== 'pending').map(pp => (
                    <tr
                      key={pp.report_period_id ?? pp.id ?? `${pp.period_start}-${pp.period_end}`}
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
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium font-display ${statusColor[pp.status] || 'bg-slate-100 text-slate-500'}`}>{pp.status}</span>
                    </td>
                    <td className="py-3.5 px-4">{/* Actions moved into detail modal */}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col">
                {periods.filter((p:any) => String((p.status || '')).toLowerCase() !== 'pending').map(pp => (
                <button key={pp.report_period_id ?? pp.id ?? `${pp.period_start}-${pp.period_end}`} onClick={() => setSelectedPeriod(pp)} className="text-left p-3 border-b border-slate-50 hover:bg-slate-50 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-700">{pp.period_start} – {pp.period_end}</div>
                    <div className="text-xs text-slate-400">{pp.restaurant} • {pp.tabulation_date}</div>
                  </div>
                  <div className="text-sm font-mono text-emerald-700">{pp.status}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

{selectedPeriod && (
            <Modal open={!!selectedPeriod} title={`Period: ${selectedPeriod.period_start} – ${selectedPeriod.period_end}`} onClose={() => setSelectedPeriod(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
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
          <div className="flex justify-end gap-2 pt-4">
            <button onClick={() => setSelectedPeriod(null)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Close</button>
            {selectedPeriod.status === 'Finalized' && (
              <button onClick={() => { /* preserve download behavior */ }} className="px-3 py-2 text-sm text-slate-700 bg-slate-100 rounded-lg">Download</button>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
