import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, AlertTriangle, ChevronRight, X, Search } from 'lucide-react'
import { employees } from '../data/mockData'
import { useApp } from '../App'
import useIsMobile from '../hooks/isMobile'
import Modal from '../components/Modal'
import WorkflowStepper from '../components/WorkflowStepper'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(n)

type Step = 'attendance' | 'calculation' | 'review' | 'approved'

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

const payrollRows = employees.slice(0, 10).map((emp, i) => ({
  emp,
  basicPay: emp.basicSalary / 2,
  overtime: [750, 0, 450, 0, 375, 0, 600, 225, 900, 0][i] || 0,
  allowances: emp.allowance,
  deductions: Math.round((emp.basicSalary / 2) * 0.067 + 200 + 75),
  netPay: (emp.basicSalary / 2) + ([750, 0, 450, 0, 375, 0, 600, 225, 900, 0][i] || 0) + emp.allowance - Math.round((emp.basicSalary / 2) * 0.067 + 200 + 75),
}))

function PayrollBreakdownModal({ row, onClose }: { row: typeof payrollRows[0]; onClose: () => void }) {
  const { openEmployee } = useApp()

  return (
    <Modal open={true} title={`${row.emp.firstName} ${row.emp.lastName}`} onClose={onClose}>
      <div className=" w-full max-h-[70vh] overflow-y-auto">
        <div className="w-md px-3 py-2 space-y-5">
          {/* Attendance summary */}
          <div className="bg-slate-50 rounded-xl p-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 font-display">Attendance Summary</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Regular Hours', value: '80 hrs' },
                { label: 'Overtime', value: `${(row.overtime / 150).toFixed(1)} hrs` },
                { label: 'Late', value: '30 min' },
                { label: 'Undertime', value: '0 hrs' },
                { label: 'Absence', value: '0 days' },
              ].map(f => (
                <div key={f.label}>
                  <p className="text-xs text-slate-400 font-display">{f.label}</p>
                  <p className="text-sm font-semibold text-slate-700 font-mono">{f.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Earnings */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 font-display">Earnings</p>
            <div className="space-y-2">
              {[
                { label: 'Basic Salary', amount: row.basicPay },
                { label: 'Overtime Pay', amount: row.overtime },
                { label: 'Holiday Pay', amount: 800 },
                { label: 'Allowances', amount: row.allowances },
              ].map(e => (
                <div key={e.label} className="flex justify-between text-sm">
                  <span className="text-slate-600">{e.label}</span>
                  <span className="font-mono text-slate-700">{fmt(e.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold border-t border-slate-100 pt-2 mt-1">
                <span className="text-slate-700">Gross Pay</span>
                <span className="font-mono text-slate-800">{fmt(row.basicPay + row.overtime + 800 + row.allowances)}</span>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 font-display">Deductions</p>
            <div className="space-y-2">
              {[
                { label: 'SSS', amount: Math.round(row.basicPay * 0.045) },
                { label: 'PhilHealth', amount: Math.round(row.basicPay * 0.02) },
                { label: 'Pag-IBIG', amount: 100 },
                { label: 'Withholding Tax', amount: Math.round(row.basicPay * 0.01) },
                { label: 'Late Deduction', amount: 75 },
              ].map(d => (
                <div key={d.label} className="flex justify-between text-sm">
                  <span className="text-slate-600">{d.label}</span>
                  <span className="font-mono text-red-600">{fmt(d.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold border-t border-slate-100 pt-2 mt-1">
                <span className="text-slate-700">Total Deductions</span>
                <span className="font-mono text-red-600">{fmt(row.deductions)}</span>
              </div>
            </div>
          </div>

          {/* Net Pay */}
          <div className="bg-indigo-600 rounded-xl p-4 text-center">
            <p className="text-indigo-200 text-xs mb-1 font-display">NET PAY</p>
            <p className="text-3xl font-bold text-white font-display">{fmt(row.netPay)}</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => openEmployee?.(row.emp.id)}
              className="flex-1 text-sm font-medium border border-slate-200 rounded-lg py-2 hover:bg-slate-50 font-display text-slate-600"
            >
              View Attendance
            </button>
            {/*}
            <button className="flex-1 text-sm font-medium border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-lg py-2 hover:bg-indigo-100 font-display">
              View Calculation Details
            </button>
            */}
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
  const [viewRow, setViewRow] = useState<typeof payrollRows[0] | null>(null)
  const [approveConfirm, setApproveConfirm] = useState(false)

  const [carouselIndex, setCarouselIndex] = useState(0)

  const activePayrollIndex = stepToIndex[step]
  const maxCarouselIndex = Math.max(0, payrollWorkflowSteps.length - 3)

  useEffect(() => {
    const desired = Math.min(Math.max(activePayrollIndex - 1, 0), maxCarouselIndex)
    setCarouselIndex(desired)
  }, [activePayrollIndex, maxCarouselIndex])

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

  const filteredRows = payrollRows.filter(r => {
    const q = search.toLowerCase()
    return !q || `${r.emp.firstName} ${r.emp.lastName}`.toLowerCase().includes(q)
  })

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
        <p className="text-sm text-slate-500 mt-0.5">August 1–15, 2026</p>
      </div>

      <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800 font-display">
        Processing: {activePayrollPeriod.label} · {activePayrollPeriod.payrollType}
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
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { label: 'Employees', value: '45', color: 'text-slate-800' },
              { label: 'Gross Pay', value: '₱512,350', color: 'text-slate-800' },
              { label: 'Total Earnings', value: '₱32,400', color: 'text-blue-600' },
              { label: 'Total Deductions', value: '₱74,820', color: 'text-red-600' },
              { label: 'Net Payroll', value: '₱437,530', color: 'text-emerald-600' },
              { label: 'Overtime', value: '₱18,450', color: 'text-indigo-600' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm text-center">
                <p className={`font-bold font-display ${s.color} ${isMobile ? 'text-sm' : 'text-lg'}`}>{s.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5 flex-1 max-w-xs focus-within:border-indigo-400">
                <Search size={13} className="text-slate-400 shrink-0" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee..." className="bg-transparent text-sm outline-none text-slate-700 w-full placeholder:text-slate-400" />
              </div>
            </div>
            <div className="overflow-x-auto">
              {!isMobile ? (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      {['Employee', 'Basic Pay', 'Overtime', 'Allowances', 'Deductions', 'Net Pay', 'Status', ''].map(h => (
                        <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredRows.map(r => (
                      <tr
                        key={r.emp.id}
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
                              <span className="text-indigo-700 text-[10px] font-bold font-display">{r.emp.firstName[0]}{r.emp.lastName[0]}</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-700 font-display whitespace-nowrap">{r.emp.firstName} {r.emp.lastName}</p>
                              <p className="text-xs text-slate-400">{r.emp.department}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-700">{fmt(r.basicPay)}</td>
                        <td className="py-3 px-4 font-mono text-xs text-blue-600">{r.overtime > 0 ? fmt(r.overtime) : '—'}</td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-600">{fmt(r.allowances)}</td>
                        <td className="py-3 px-4 font-mono text-xs text-red-600">{fmt(r.deductions)}</td>
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-emerald-700">{fmt(r.netPay)}</td>
                        <td className="py-3 px-4">
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium font-display">Calculated</span>
                        </td>
                        <td className="py-3 px-4" />
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col">
                  {filteredRows.map(r => (
                    <button key={r.emp.id} onClick={() => setViewRow(r)} className="text-left p-3 border-b border-slate-50 hover:bg-slate-50 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-700">{r.emp.firstName} {r.emp.lastName}</div>
                        <div className="text-xs text-slate-400">{r.emp.department}</div>
                      </div>
                      <div className="text-sm font-mono text-emerald-700">{fmt(r.netPay)}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => setStep('attendance')} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Back</button>
            <button onClick={() => setStep('review')} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg font-display">
              Proceed to Review <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-5">
          {/* Summary */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { label: 'Total Employees', value: '45' },
              { label: 'Gross Payroll', value: '₱512,350' },
              { label: 'Total Deductions', value: '₱74,820' },
              { label: 'Net Payroll', value: '₱437,530' },
              { label: 'Overtime Cost', value: '₱18,450' },
              { label: 'Late Deductions', value: '₱2,350' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm text-center">
                <p className={`font-bold font-display ${isMobile ? 'text-sm' : 'text-lg'}`}>{s.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Warnings */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={16} className="text-amber-500" />
              <p className="text-sm font-semibold text-slate-700 font-display">Items Requiring Attention</p>
            </div>
            <div className="space-y-2">
              {[
                { msg: '2 employees have missing attendance records', action: 'Review' },
                { msg: '1 employee has very high overtime (>20 hrs)', action: 'Review' },
                { msg: '3 employees have late deductions applied', action: 'View' },
              ].map((w, i) => (
                <div key={i} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle size={13} className="text-amber-500 shrink-0" />
                    <span className="text-sm text-amber-800">{w.msg}</span>
                  </div>
                  <button className="text-xs text-amber-700 font-semibold hover:underline font-display shrink-0 ml-4">{w.action}</button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setStep('calculation')} className="px-2 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Back to Calculation</button>
            <div className="flex gap-3">
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
            <p className="text-sm text-slate-500 mb-6">August 1–15, 2026 payroll has been approved and finalized.<br />Payslips are ready for distribution.</p>
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
            <h3 className="text-lg font-bold text-slate-800 font-display mb-2">Approve Payroll?</h3>
            <p className="text-sm text-slate-600 mb-2">
              Once approved, payroll will be marked as finalized.
            </p>
            <div className="bg-slate-50 rounded-xl p-3 mb-5">
              <p className="text-sm font-medium text-slate-700 font-display">August 1–15, 2026</p>
              <p className="text-xs text-slate-400 mt-0.5">Net Payroll: ₱437,530.00 · 45 employees</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setApproveConfirm(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
              <button
                onClick={() => {
                  setApproveConfirm(false)
                  setStep('approved')
                  showToast({ type: 'success', message: 'Payroll approved!', description: 'August 1–15, 2026 payroll has been finalized.' })
                }}
                className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-display"
              >
                Approve Payroll
              </button>
            </div>
          </div>
        </Modal>
      )}

      {viewRow && <PayrollBreakdownModal row={viewRow} onClose={() => setViewRow(null)} />}
    </div>
  )
}
