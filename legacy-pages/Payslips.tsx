'use client'
import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { useApp } from '../App'
import useIsMobile from '../hooks/isMobile'
import Modal from '../components/Modal'

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(n)

// Payslips are computed from `/api/payroll/calculate` for a selected period

// Note: component-scoped cache will be created with `useRef` below.

function PayslipDetailModal({ item, onClose }: { item: any; onClose: () => void }) {
  const { logoSrc } = useApp()
  const [empDetails, setEmpDetails] = useState<any | null>(null)
  const [periodLabel, setPeriodLabel] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const id = item?.emp?.id
    // fetch employee details as a fallback for values not stored on the payslip row
    if (id) {
      ;(async () => {
        try {
          const res = await fetch(`/api/employees/${id}`)
          if (!res.ok) return
          const body = await res.json()
          if (!mounted) return
          setEmpDetails(body.employee || null)
        } catch (err) {
          console.error('Failed to load employee details', err)
        }
      })()
    }

    // fetch report period label for the payslip's report_period_id
    const periodId = item?.raw?.report_period_id || item?.raw?.period_label || null
    if (periodId) {
      ;(async () => {
        try {
          const res = await fetch('/api/report_periods')
          if (!res.ok) return
          const body = await res.json()
          if (!mounted) return
          const found = (body.periods || []).find((p: any) => String(p.report_period_id ?? p.id) === String(periodId))
          if (found) setPeriodLabel(found.label || `${found.period_start} – ${found.period_end}`)
        } catch (err) {
          console.error('Failed to load report periods', err)
        }
      })()
    }
    return () => { mounted = false }
  }, [item])

  return (
    <Modal open={true} title={`Payslip — ${item.emp.firstName} ${item.emp.lastName}`} onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-h-[70vh] overflow-y-auto">
        {/* Payslip header */}
        <div className="flex items-center bg-indigo-600 rounded-t-2xl px-8 py-3 text-white"> 
          <img src={logoSrc} alt="Brand logo" className="w-12 h-12 mr-2 mb-1" />
          <p className="text-xl text-indigo-200 font-display uppercase tracking-widest">Employee Payslip</p>
        </div>

        <div className="px-4 py-2 space-y-5">
          {/* Employee info */}
          <div className="grid grid-cols-2 gap-3 tracking-wide bg-slate-50 rounded-xl">
            {[
                { id: 'employee', label: 'Employee', value: `${item.emp.firstName} ${item.emp.lastName}` },
                { id: 'department', label: 'Department', value: item.raw?.department || empDetails?.department || '' },
                { id: 'pay-per-day', label: 'Pay Per Day', value: formatCurrency(item.raw?.pay_per_day ?? empDetails?.pay_per_day ?? 0) },
                { id: 'restaurant', label: 'Restaurant', value: item.raw?.restaurant || empDetails?.restaurant || '' },
                { id: 'period', label: 'Payroll Period', value: periodLabel || item.period || '—' },
              ].map(f => (
                <div key={f.id} className={`${f.id === 'period' ? 'col-span-2' : ''}`}>
                  <p className="text-xs text-slate-400 font-display">{f.label}</p>
                  <p className="text-sm font-medium text-slate-700">{f.value}</p>
                </div>
              ))}
          </div>

          {/* Earnings (read directly from payslip row) */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide font-display mb-3">Earnings</p>
            <div className="space-y-2">
              {[
                { id: 'base', label: 'Base Pay', amount: Number(item.raw?.base_pay ?? 0) },
                { id: 'overtime', label: 'Overtime Pay', amount: Number(item.raw?.overtime_pay ?? 0) },
                { id: 'halfday', label: 'Halfday Pay', amount: Number(item.raw?.halfday_pay ?? 0) },
                { id: 'holiday', label: 'Holiday Pay', amount: Number(item.raw?.holiday_pay ?? 0) },
                { id: 'paid-leave', label: 'Paid Leave Pay', amount: Number(item.raw?.paid_leave_pay ?? 0) },
              ].map(e => (
                <div key={e.id} className="flex justify-between text-sm">
                  <span className="text-slate-600">{e.label}</span>
                  <span className="font-mono text-slate-700">{formatCurrency(e.amount)}</span>
                </div>
              ))}
                <div className="flex justify-between text-sm font-semibold border-t border-slate-100 pt-2">
                <span className="text-slate-700">Gross Pay</span>
                <span className="font-mono text-slate-800">{formatCurrency(Number(item.raw?.gross_pay ?? item.gross ?? 0))}</span>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide font-display mb-3">Deductions</p>
            <div className="space-y-2">
              {[
                { id: 'sss', label: 'SSS', amount: Number(item.raw?.sss_deduction ?? 0) },
                { id: 'philhealth', label: 'PhilHealth', amount: Number(item.raw?.philhealth_deduction ?? 0) },
                { id: 'pagibig', label: 'Pag-IBIG', amount: Number(item.raw?.pagibig_deduction ?? 0) },
                { id: 'undertime', label: 'Undertime Deductions', amount: Number(item.raw?.undertime_deduction ?? 0) },
                { id: 'late', label: 'Late Deductions', amount: Number(item.raw?.late_deduction ?? 0) },
                { id: 'cash-advance', label: 'Cash Advance', amount: Number(item.raw?.cash_advance_deduction ?? 0) },
              ].map(d => (
                <div key={d.id} className="flex justify-between text-sm">
                  <span className="text-slate-600">{d.label}</span>
                  <span className="font-mono text-red-600">{formatCurrency(d.amount)}</span>
                </div>
              ))}
                <div className="flex justify-between text-sm font-semibold border-t border-slate-100 pt-2">
                <span className="text-slate-700">Total Deductions</span>
                <span className="font-mono text-red-600">{formatCurrency(Number(item.raw?.total_deduction ?? item.deductions ?? 0))}</span>
              </div>
            </div>
          </div>

          {/* Net Pay */}
          <div className="bg-indigo-600 rounded-xl p-2 text-center">
            <p className="text-indigo-200 text-xs font-display uppercase tracking-widest mb-1">NET PAY</p>
            <p className="text-2xl font-bold text-white font-display">{formatCurrency(Number(item.raw?.net_pay ?? item.net ?? 0))}</p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => {
              const id = item.raw?.payslip_id ?? item.id
              if (!id) return
              window.location.href = `/api/payslips/${id}/download`
            }} className="flex-1 flex items-center justify-center gap-2 border border-slate-200 text-slate-700 text-sm font-semibold py-2.5 rounded-lg hover:bg-slate-50 font-display">
              <Download size={14} /> Download PDF
            </button>
            {/* 
            <button className="flex-1 flex items-center justify-center gap-2 border border-slate-200 text-slate-700 text-sm font-semibold py-2.5 rounded-lg hover:bg-slate-50 font-display">
              <Printer size={14} /> Print
            </button>
            */}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default function Payslips() {
  const isMobile = useIsMobile()
  // component-scoped in-memory cache mapping employee_id -> employee object
  const employeesRef = useRef<Map<string, any>>(new Map())
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState('')
  const [dept, setDept] = useState('')
  const [viewing, setViewing] = useState<any | null>(null)
  const [periods, setPeriods] = useState<any[]>([])
  const [payslips, setPayslips] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  // Helper: build display object from raw payslip row using cache when available
  const buildFromRaw = (r: any) => {
    const empId = String(r.employee_id || r.employee_number || '')
    const emp = employeesRef.current.get(empId)
    const fullName = emp?.name || r.employee_name || ''
    const [firstName = '', ...rest] = String(fullName).split(' ')
    const lastName = rest.join(' ')
    return {
      raw: r,
      id: r.payslip_id ?? `${r.employee_id ?? r.employee_number}-${r.report_period_id ?? r.period_label}`,
      emp: { firstName, lastName, department: emp?.department || r.department || '', restaurant: emp?.restaurant || r.restaurant || '', id: r.employee_id || r.employee_number },
      period: r.report_period_id ? String(r.report_period_id) : (r.period_label || '—'),
      gross: Number(r.gross_pay ?? r.base_pay ?? 0),
      deductions: Number(r.total_deduction ?? r.total_deductions ?? 0),
      net: Number(r.net_pay ?? 0),
      status: r.status || 'Released',
    }
  }

  // Fetch missing employee IDs (parallel) and populate employeesRef.
  const fetchMissingEmployees = async (ids: string[], mountedRef: { current: boolean }) => {
    if (!ids || ids.length === 0) return
    try {
      const fetches = ids.map(id => fetch(`/api/employees/${encodeURIComponent(id)}`).then(async res => {
        if (!res.ok) return null
        const body = await res.json()
        return body.employee || null
      }).catch(() => null))
      const results = await Promise.all(fetches)
      results.forEach((emp, i) => {
        const id = ids[i]
        if (emp) employeesRef.current.set(String(id), emp)
      })
      // after populating cache, remap payslips from raw rows
      if (!mountedRef.current) return
      setPayslips(prev => prev.map(p => buildFromRaw(p.raw)))
    } catch (err) {
      console.error('Failed to fetch employees', err)
    }
  }

  // Clear component-scoped cache and re-trigger lookups for visible payslips
  const clearEmployeesCache = () => {
    employeesRef.current.clear()
    // compute visible payslip employee ids from current payslips and filters
    const visible = payslips.filter(p => {
      const q = search.toLowerCase()
      const matchQ = !q || `${p.emp.firstName} ${p.emp.lastName}`.toLowerCase().includes(q)
      const matchRestaurant = !dept || p.emp.restaurant === dept
      return matchQ && matchRestaurant
    })
    const ids = Array.from(new Set(visible.map(p => String(p.emp.id))))
    const mountedRef = { current: true }
    fetchMissingEmployees(ids, mountedRef)
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/report_periods')
        if (!res.ok) return
        const body = await res.json()
        if (!mounted) return
        setPeriods(body.periods || [])
        if ((body.periods || []).length > 0) setPeriod(String((body.periods || [])[0].report_period_id ?? (body.periods || [])[0].id))
      } catch (err) {
        console.error('Failed to load report periods', err)
      }
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let mounted = true
    if (!period) return
    ;(async () => {
      try {
        // Fetch payslips first, then ensure employee info exists in the component cache.
        const psRes = await fetch(`/api/payslips?period_id=${period}`)
        if (!psRes.ok) return
        const psBody = await psRes.json()
        if (!mounted) return

        // initial mapping from raw rows; this uses any cached employee entries already present
        const raws: any[] = psBody.payslips || []
        setPayslips(raws.map(r => buildFromRaw(r)))

        // find missing employee ids to fetch
        const ids = Array.from(new Set(raws.map(r => String(r.employee_id || r.employee_number || '')))).filter(id => id && !employeesRef.current.has(id))
        if (ids.length > 0) await fetchMissingEmployees(ids, { current: mounted })
      } catch (err) {
        console.error('Failed to load payslips', err)
      }
    })()
    return () => { mounted = false }
  }, [period])

  const filtered = payslips.filter(p => {
    const q = search.toLowerCase()
    const matchQ = !q || `${p.emp.firstName} ${p.emp.lastName}`.toLowerCase().includes(q)
    const matchRestaurant = !dept || p.emp.restaurant === dept
    return matchQ && matchRestaurant
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    setPage(prev => Math.min(prev, totalPages))
  }, [totalPages])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 font-display">Payslips</h2>
        <p className="text-sm text-slate-500 mt-0.5">View and download employee payslips</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 flex flex-wrap gap-3 shadow-sm">
        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 flex-1 min-w-48 focus-within:border-indigo-400">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search employee..." className="bg-transparent text-sm outline-none text-slate-700 w-full placeholder:text-slate-400" />
        </div>
        <select value={period} onChange={e => { setPeriod(e.target.value); setPage(1) }} className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white outline-none focus:border-indigo-400 font-display">
          {periods.length === 0 ? (
            <option value="">Select payroll period</option>
          ) : (
            periods.map(p => <option key={p.report_period_id ?? p.id} value={String(p.report_period_id ?? p.id)}>{p.label || `${p.period_start} – ${p.period_end}`}</option>)
          )}
        </select>
        <select value={dept} onChange={e => { setDept(e.target.value); setPage(1) }} className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white outline-none focus:border-indigo-400 font-display">
          <option value="">Restaurant: All</option>
          {['Lakay Ago', 'Aroo'].map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {/* <button onClick={() => clearEmployeesCache()} className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white hover:bg-slate-50 font-display">Refresh Employee Data</button> */}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {!isMobile ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Employee', 'Restaurant', 'Gross Pay', 'Deductions', 'Net Pay', 'Status'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">No payslips available for this period.</td>
                  </tr>
                ) : (
                  pageData.map(p => (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50 group cursor-pointer"
                      onClick={() => setViewing(p)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setViewing(p)
                        }
                      }}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                            <span className="text-indigo-700 text-[10px] font-bold font-display">{(p.emp.firstName && p.emp.firstName.charAt(0)) || ''}{(p.emp.lastName && p.emp.lastName.charAt(0)) || ''}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-700 font-display whitespace-nowrap">{p.emp.firstName} {p.emp.lastName}</p>
                            <p className="text-xs text-slate-400">{p.emp.restaurant}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap">{p.emp.restaurant}</td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700">{formatCurrency(p.gross)}</td>
                      <td className="py-3 px-4 font-mono text-xs text-red-600">{formatCurrency(p.deductions)}</td>
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-emerald-700">{formatCurrency(p.net)}</td>
                      <td className="py-3 px-4">
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium font-display">{p.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col">
              {filtered.length === 0 ? (
                <div className="p-4 text-sm text-slate-500">No payslips available for this period.</div>
              ) : (
                pageData.map(p => (
                  <button key={p.id} onClick={() => setViewing(p)} className="text-left p-3 border-b border-slate-50 hover:bg-slate-50 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-700">{p.emp.firstName} {p.emp.lastName}</div>
                      <div className="text-xs text-slate-400">{p.period} • {p.emp.restaurant}</div>
                    </div>
                    <div className="text-sm font-mono text-emerald-700">{formatCurrency(p.net)}</div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-white rounded-b-xl">
        <p className="text-xs text-slate-500">Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} payslips</p>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40"><ChevronLeft size={16} /></button>
          {Array.from({ length: totalPages }, (_, i) => {
            const p = i + 1
            const show = p === 1 || p === totalPages || Math.abs(p - page) <= 2
            if (!show) {
              if (i === 1 || i === totalPages - 2) return <span key={p} className="px-1 text-slate-400">…</span>
              return null
            }
            return (
              <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 rounded-lg text-xs font-medium font-display ${page === p ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                {p}
              </button>
            )
          })}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40"><ChevronRight size={16} /></button>
        </div>
      </div>

      {viewing && <PayslipDetailModal item={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}
