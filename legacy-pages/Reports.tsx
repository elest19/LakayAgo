'use client'
import { useState } from 'react'
import { FileText, Download, Printer, BarChart3, Clock, UserCheck } from 'lucide-react'
import { useApp } from '../App'
import useIsMobile from '../hooks/isMobile'
import Modal from '../components/Modal'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(n)

const attendanceReportTypes = [
  'Daily Attendance', 'Monthly Attendance', 'Absence Report', 'Late Report',
  'Undertime Report', 'Overtime Report', 'Leave Report',
]
const payrollReportTypes = [
  'Payroll Summary', 'Payroll Register', 'Employee Payroll', 'Department Payroll',
  'Earnings Report', 'Deduction Report', 'Overtime Cost',
]

const mockReportData = [
  { dept: 'Cooks & Chef', employees: 3, grossPay: 130000, deductions: 18900, netPay: 111100 },
  { dept: 'Waiters', employees: 2, grossPay: 52000, deductions: 7540, netPay: 44460 },
  { dept: 'Cashiers', employees: 2, grossPay: 67000, deductions: 9715, netPay: 57285 },
  { dept: 'Management', employees: 4, grossPay: 95000, deductions: 13775, netPay: 81225 },
]

export default function Reports() {
  const { showToast } = useApp()
  const isMobile = useIsMobile()
  const [selectedDept, setSelectedDept] = useState<(typeof mockReportData)[number] | null>(null)
  const [reportType, setReportType] = useState('Department Payroll')
  const [category, setCategory] = useState<'attendance' | 'payroll'>('payroll')
  const [generated, setGenerated] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [useDate, setUseDate] = useState(false)

  const handleGenerate = () => {
    setGenerating(true)
    setTimeout(() => { setGenerating(false); setGenerated(true) }, 1500)
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 font-display">Reports</h2>
        <p className="text-sm text-slate-500 mt-0.5">Generate attendance and payroll reports</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report Config */}
        <div className="lg:col-span-1 space-y-5">
          {/* Category tabs */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 font-display">Report Category</p>
            <div className="flex gap-2 mb-4">
              {[
                { id: 'attendance', label: 'Attendance', icon: <UserCheck size={14} /> },
                { id: 'payroll', label: 'Payroll', icon: <BarChart3 size={14} /> },
              ].map(c => (
                <button
                  key={c.id}
                  onClick={() => { setCategory(c.id as any); setGenerated(false) }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium font-display flex-1 justify-center
                    ${category === c.id ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                >
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 font-display">Report Type</p>
            <div className="space-y-1">
              {(category === 'attendance' ? attendanceReportTypes : payrollReportTypes).map(rt => (
                <button
                  key={rt}
                  onClick={() => { setReportType(rt); setGenerated(false) }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-display
                    ${reportType === rt ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {rt}
                </button>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide font-display">Filters</p>
            {[
              { label: 'Payroll Period', opts: ['August 1–15, 2026', 'July 16–31, 2026', 'July 1–15, 2026'] },
              { label: 'Department', opts: ['All', 'Cooks & Chef', 'Waiters', 'Cashiers', 'Management'] },
              { label: 'Employee', opts: ['All Employees', 'Juan Dela Cruz', 'Maria Santos'] },
            ].map(f => (
              <div key={f.label}>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">{f.label}</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 font-display text-slate-600">
                  {f.opts.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            ))}
            <label className="flex items-center gap-2 text-sm text-slate-600 font-display">
              <input
                type="checkbox"
                checked={useDate}
                onChange={e => setUseDate(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Use Date
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Date From</label>
                <input
                  type="date"
                  defaultValue="2026-08-01"
                  disabled={!useDate}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-400 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Date To</label>
                <input
                  type="date"
                  defaultValue="2026-08-15"
                  disabled={!useDate}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-400 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
              </div>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded-lg font-display disabled:opacity-70"
            >
              {generating ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating...</> : <><FileText size={14} />Generate Report</>}
            </button>
          </div>
        </div>

        {/* Report Result */}
        <div className="lg:col-span-2">
          {!generated ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm h-full flex items-center justify-center py-24">
              <div className="text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <BarChart3 size={28} className="text-slate-300" />
                </div>
                <p className="text-slate-400 font-display text-sm">Select a report type and click</p>
                <p className="text-slate-400 font-display text-sm">"Generate Report" to view results</p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Report header */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 font-display">{reportType}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">August 1–15, 2026 · All Departments · Generated Aug 11, 2026</p>
                  </div>
                  {/* 
                  <div className="flex gap-2">
                    <button onClick={() => showToast({ type: 'success', message: 'Downloading Excel...', description: `${reportType}.xlsx` })} className="flex items-center gap-1.5 text-xs font-medium border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 font-display">
                      <Download size={13} /> Excel
                    </button>
                    <button onClick={() => showToast({ type: 'success', message: 'Downloading PDF...', description: `${reportType}.pdf` })} className="flex items-center gap-1.5 text-xs font-medium border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 font-display">
                      <Download size={13} /> PDF
                    </button>
                    <button className="flex items-center gap-1.5 text-xs font-medium border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 font-display">
                      <Printer size={13} /> Print
                    </button>
                  </div>
                  */}
                </div>

                {/* Chart */}
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={mockReportData} barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="dept" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `₱${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => fmt(v)} />
                    <Bar dataKey="netPay" name="Net Pay" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  {!isMobile ? (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          {['Department', 'Employees', 'Gross Pay', 'Deductions', 'Net Pay'].map(h => (
                            <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {mockReportData.map(r => (
                          <tr key={r.dept} className="hover:bg-slate-50">
                            <td className="py-3 px-4 text-sm font-medium text-slate-700 font-display">{r.dept}</td>
                            <td className="py-3 px-4 font-mono text-xs text-slate-600">{r.employees}</td>
                            <td className="py-3 px-4 font-mono text-xs text-slate-700">{fmt(r.grossPay)}</td>
                            <td className="py-3 px-4 font-mono text-xs text-red-600">{fmt(r.deductions)}</td>
                            <td className="py-3 px-4 font-mono text-xs font-semibold text-emerald-700">{fmt(r.netPay)}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50 border-t-2 border-slate-200">
                          <td className="py-3 px-4 text-sm font-bold text-slate-800 font-display">Total</td>
                          <td className="py-3 px-4 font-mono text-xs font-bold text-slate-700">15</td>
                          <td className="py-3 px-4 font-mono text-xs font-bold text-slate-700">{fmt(mockReportData.reduce((a, b) => a + b.grossPay, 0))}</td>
                          <td className="py-3 px-4 font-mono text-xs font-bold text-red-600">{fmt(mockReportData.reduce((a, b) => a + b.deductions, 0))}</td>
                          <td className="py-3 px-4 font-mono text-xs font-bold text-emerald-700">{fmt(mockReportData.reduce((a, b) => a + b.netPay, 0))}</td>
                        </tr>
                      </tbody>
                    </table>
                  ) : (
                    <div className="flex flex-col">
                      {mockReportData.map(r => (
                        <button key={r.dept} onClick={() => setSelectedDept(r)} className="text-left p-3 border-b border-slate-50 hover:bg-slate-50 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-700 font-display">{r.dept}</div>
                            <div className="text-xs text-slate-400">{r.employees} employees</div>
                          </div>
                          <div className="text-sm font-mono text-emerald-700">{fmt(r.netPay)}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedDept && (
        <Modal open={!!selectedDept} title={selectedDept.dept} onClose={() => setSelectedDept(null)}>
          <div className="p-6 w-full max-w-3xl max-h-[70vh] flex flex-col">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-400">Employees</p>
                  <p className="text-sm font-medium">{selectedDept.employees}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Gross Pay</p>
                  <p className="text-sm font-medium">{fmt(selectedDept.grossPay)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Deductions</p>
                  <p className="text-sm font-medium text-red-600">{fmt(selectedDept.deductions)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Net Pay</p>
                  <p className="text-sm font-medium text-emerald-700">{fmt(selectedDept.netPay)}</p>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
