import { useState } from 'react'
import { Search, Download, Printer, X, Building2 } from 'lucide-react'
import { employees } from '../data/mockData'
import { useApp } from '../App'
import useIsMobile from '../hooks/isMobile'
import Modal from '../components/Modal'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(n)

const payslipData = employees.slice(0, 12).map((emp, i) => ({
  emp,
  period: 'August 1–15, 2026',
  gross: emp.basicSalary / 2 + emp.allowance + [750, 0, 450, 0, 375, 0, 600, 225, 900, 0, 300, 0][i],
  deductions: Math.round((emp.basicSalary / 2) * 0.067 + 200 + 75),
  net: emp.basicSalary / 2 + emp.allowance + [750, 0, 450, 0, 375, 0, 600, 225, 900, 0, 300, 0][i] - Math.round((emp.basicSalary / 2) * 0.067 + 200 + 75),
  status: 'Released',
}))

function PayslipDetailModal({ item, onClose }: { item: typeof payslipData[0]; onClose: () => void }) {
  const { logoSrc } = useApp()

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
              { label: 'Employee', value: `${item.emp.firstName} ${item.emp.lastName}` },
              { label: 'Employee ID', value: item.emp.id },
              { label: 'Position', value: item.emp.position },
              { label: 'Department', value: item.emp.department },
              { label: 'Payroll Period', value: item.period },
              {/*{ label: 'Payment Method', value: item.emp.paymentMethod },*/}
            ].map(f => (
              <div key={f.label}>
                <p className="text-xs text-slate-400 font-display">{f.label}</p>
                <p className="text-sm font-medium text-slate-700">{f.value}</p>
              </div>
            ))}
          </div>

          {/* Earnings */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide font-display mb-3">Earnings</p>
            <div className="space-y-2">
              {[
                { label: 'Basic Salary', amount: item.emp.basicSalary / 2 },
                { label: 'Overtime', amount: item.gross - item.emp.basicSalary / 2 - item.emp.allowance },
                { label: 'Holiday Pay', amount: 800 },
                { label: 'Allowance', amount: item.emp.allowance },
              ].map(e => (
                <div key={e.label} className="flex justify-between text-sm">
                  <span className="text-slate-600">{e.label}</span>
                  <span className="font-mono text-slate-700">{fmt(e.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold border-t border-slate-100 pt-2">
                <span className="text-slate-700">Gross Pay</span>
                <span className="font-mono text-slate-800">{fmt(item.gross + 800)}</span>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide font-display mb-3">Deductions</p>
            <div className="space-y-2">
              {[
                { label: 'SSS', amount: Math.round((item.emp.basicSalary / 2) * 0.045) },
                { label: 'PhilHealth', amount: Math.round((item.emp.basicSalary / 2) * 0.02) },
                { label: 'Pag-IBIG', amount: 100 },
                { label: 'Withholding Tax', amount: Math.round((item.emp.basicSalary / 2) * 0.01) },
                { label: 'Late', amount: 75 },
              ].map(d => (
                <div key={d.label} className="flex justify-between text-sm">
                  <span className="text-slate-600">{d.label}</span>
                  <span className="font-mono text-red-600">{fmt(d.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold border-t border-slate-100 pt-2">
                <span className="text-slate-700">Total Deductions</span>
                <span className="font-mono text-red-600">{fmt(item.deductions)}</span>
              </div>
            </div>
          </div>

          {/* Net Pay */}
          <div className="bg-indigo-600 rounded-xl p-2 text-center">
            <p className="text-indigo-200 text-xs font-display uppercase tracking-widest mb-1">NET PAY</p>
            <p className="text-2xl font-bold text-white font-display">{fmt(item.net)}</p>
          </div>

          <div className="flex gap-3">
            <button className="flex-1 flex items-center justify-center gap-2 border border-slate-200 text-slate-700 text-sm font-semibold py-2.5 rounded-lg hover:bg-slate-50 font-display">
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
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState('August 1–15, 2026')
  const [dept, setDept] = useState('')
  const [viewing, setViewing] = useState<typeof payslipData[0] | null>(null)

  const filtered = payslipData.filter(p => {
    const q = search.toLowerCase()
    const matchQ = !q || `${p.emp.firstName} ${p.emp.lastName}`.toLowerCase().includes(q)
    const matchDept = !dept || p.emp.department === dept
    return matchQ && matchDept
  })

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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee..." className="bg-transparent text-sm outline-none text-slate-700 w-full placeholder:text-slate-400" />
        </div>
        <select value={period} onChange={e => setPeriod(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white outline-none focus:border-indigo-400 font-display">
          <option>August 1–15, 2026</option>
          <option>July 16–31, 2026</option>
          <option>July 1–15, 2026</option>
        </select>
        <select value={dept} onChange={e => setDept(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white outline-none focus:border-indigo-400 font-display">
          <option value="">Department: All</option>
          {['Cooks & Chefs', 'Waiters', 'Cashiers', 'Management'].map(d => <option key={d}>{d}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {!isMobile ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Employee', 'Payroll Period', 'Gross Pay', 'Deductions', 'Net Pay', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(p => (
                  <tr
                    key={p.emp.id}
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
                          <span className="text-indigo-700 text-[10px] font-bold font-display">{p.emp.firstName[0]}{p.emp.lastName[0]}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700 font-display whitespace-nowrap">{p.emp.firstName} {p.emp.lastName}</p>
                          <p className="text-xs text-slate-400">{p.emp.department}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap">{p.period}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700">{fmt(p.gross)}</td>
                    <td className="py-3 px-4 font-mono text-xs text-red-600">{fmt(p.deductions)}</td>
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-emerald-700">{fmt(p.net)}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium font-display">{p.status}</span>
                    </td>
                    <td className="py-3 px-4" />
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col">
              {filtered.map(p => (
                <button key={p.emp.id} onClick={() => setViewing(p)} className="text-left p-3 border-b border-slate-50 hover:bg-slate-50 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-700">{p.emp.firstName} {p.emp.lastName}</div>
                    <div className="text-xs text-slate-400">{p.period} • {p.emp.department}</div>
                  </div>
                  <div className="text-sm font-mono text-emerald-700">{fmt(p.net)}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {viewing && <PayslipDetailModal item={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}
