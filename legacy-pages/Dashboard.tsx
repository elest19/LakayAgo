'use client'
import { useMemo } from 'react'
import { useApp } from '../App'
import useIsMobile from '../hooks/isMobile'
import {
  Users, UserCheck, AlertTriangle, Clock, TrendingUp, TrendingDown,
  ArrowRight, CheckCircle2, Circle, FileText, Activity, DollarSign, ReceiptText
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { monthlyPayrollData, deptPayrollData, overtimeData } from '../data/mockData'

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(n)

const StatCard = ({
  label, value, sub, icon, color, trend
}: {
  label: string; value: string; sub?: string; icon: React.ReactNode
  color: string; trend?: { dir: 'up' | 'down'; text: string }
}) => (
  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between mb-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        {icon}
      </div>
      {trend && (
        <span className={`flex items-center gap-1 text-xs font-medium ${trend.dir === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>
          {trend.dir === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {trend.text}
        </span>
      )}
    </div>
    <p className="text-xl font-bold text-slate-800 font-display">{value}</p>
    <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
  </div>
)

const steps = [
  { label: 'Attendance Imported', done: true },
  { label: 'Attendance Validated', done: true },
  { label: 'Payroll Calculation', active: true },
  { label: 'Payroll Review', done: false },
  { label: 'Payroll Approval', done: false },
  { label: 'Payslips', done: false },
]

const recentActivity = [
  { icon: <FileText size={14} />, msg: 'Attendance file imported', sub: 'attendance_aug_1_15_2026.xlsx — 245 records', time: '10 min ago', color: 'bg-indigo-100 text-indigo-600' },
  { icon: <CheckCircle2 size={14} />, msg: 'Payroll calculation completed', sub: 'July 16–31, 2026 — ₱435,260.00 net', time: '1 hr ago', color: 'bg-emerald-100 text-emerald-600' },
  { icon: <Users size={14} />, msg: 'Employee salary updated', sub: 'Juan Dela Cruz — ₱20,000 → ₱25,000', time: '1 day ago', color: 'bg-blue-100 text-blue-600' },
  { icon: <UserCheck size={14} />, msg: 'Leave request approved', sub: 'Mark Villanueva — Sick Leave, Aug 1–5', time: '1 day ago', color: 'bg-violet-100 text-violet-600' },
  { icon: <Activity size={14} />, msg: 'Payroll period created', sub: 'August 16–31, 2026', time: '2 days ago', color: 'bg-amber-100 text-amber-600' },
]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-1 font-display">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="flex gap-1">
          <span className="capitalize">{p.name}:</span>
          <span className="font-medium">
            {typeof p.value === 'number' && p.value > 1000 ? fmt(p.value) : p.value}
          </span>
        </p>
      ))}
    </div>
  )
}

// --- date helpers (current month window, used for the Sales & Expense summary) ---
const toStartOfDay = (date: Date) => {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

const toEndOfDay = (date: Date) => {
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next
}

const isWithinRange = (value: string, start: Date, end: Date) => {
  const parsed = new Date(value)
  return parsed >= start && parsed <= end
}

const EXPENSE_COLORS = ['#14b8a6', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981']

export default function Dashboard() {
  const { navigate, inventoryItems, salesRecords, expenses } = useApp()
  const isMobile = useIsMobile()

  const monthStart = useMemo(() => toStartOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), [])
  const monthEnd = useMemo(() => toEndOfDay(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)), [])

  const filteredSales = useMemo(
    () => salesRecords.filter(sale => isWithinRange(sale.createdAt, monthStart, monthEnd)),
    [salesRecords, monthStart, monthEnd],
  )

  const filteredExpenses = useMemo(
    () => expenses.filter(expense => isWithinRange(expense.createdAt, monthStart, monthEnd)),
    [expenses, monthStart, monthEnd],
  )

  const itemSummary = useMemo(() => {
    return inventoryItems.map(item => {
      const matches = filteredSales.filter(sale => sale.item === item.item)
      const grandTotalSale = matches.reduce((sum, sale) => sum + sale.cost * sale.numberOfSales, 0)
      const orderDiscount = matches.reduce((sum, sale) => sum + sale.discount, 0)
      const netSale = Math.max(grandTotalSale - orderDiscount, 0)

      return { item: item.item, grandTotalSale, netSale, orderDiscount }
    })
  }, [filteredSales, inventoryItems])

  const totalGrandSales = useMemo(
    () => itemSummary.reduce((sum, item) => sum + item.grandTotalSale, 0),
    [itemSummary],
  )

  const totalNetSales = useMemo(
    () => itemSummary.reduce((sum, item) => sum + item.netSale, 0),
    [itemSummary],
  )

  const totalOrderDiscount = useMemo(
    () => itemSummary.reduce((sum, item) => sum + item.orderDiscount, 0),
    [itemSummary],
  )

  const totalExpenses = useMemo(
    () => filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    [filteredExpenses],
  )

  const salesChartData = useMemo(
    () => itemSummary.map(item => ({ name: item.item, grandTotalSale: item.grandTotalSale, netSale: item.netSale, orderDiscount: item.orderDiscount })),
    [itemSummary],
  )

  const expenseBreakdown = useMemo(() => {
    const grouped = filteredExpenses.reduce<Record<string, number>>((acc, expense) => {
      acc[expense.expense] = (acc[expense.expense] ?? 0) + expense.amount
      return acc
    }, {})

    return Object.entries(grouped)
      .map(([expense, amount]) => ({ name: expense, amount }))
      .sort((a, b) => b.amount - a.amount)
  }, [filteredExpenses])

  const summaryCards = [
    { label: 'Grand Total Sale', value: fmt(totalGrandSales), icon: <DollarSign size={18} className="text-indigo-600" />, color: 'bg-indigo-50' },
    { label: 'Net Sale', value: fmt(totalNetSales), icon: <TrendingUp size={18} className="text-emerald-600" />, color: 'bg-emerald-50' },
    { label: 'Order Discount', value: fmt(totalOrderDiscount), icon: <ReceiptText size={18} className="text-amber-600" />, color: 'bg-amber-50' },
    { label: 'Expense Total', value: fmt(totalExpenses), icon: <TrendingDown size={18} className="text-red-500" />, color: 'bg-red-50' },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Employees" value="45" icon={<Users size={18} className="text-indigo-600" />} color="bg-indigo-50" />
        <StatCard label="Present Today" value="42" sub="93.3% attendance rate" icon={<UserCheck size={18} className="text-emerald-600" />} color="bg-emerald-50" />
        <StatCard label="Missing Attendance" value="2" icon={<AlertTriangle size={18} className="text-amber-600" />} color="bg-amber-50" />
        <StatCard label="Pending Leave Requests" value="4" icon={<Clock size={18} className="text-violet-600" />} color="bg-violet-50" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Gross Payroll" value="₱512,350" sub="August 1–15, 2026" icon={<TrendingUp size={18} className="text-blue-600" />} color="bg-blue-50" trend={{ dir: 'up', text: '+0.7%' }} />
        <StatCard label="Total Deductions" value="₱74,820" icon={<TrendingDown size={18} className="text-red-500" />} color="bg-red-50" />
        <StatCard label="Net Payroll" value="₱437,530" icon={<CheckCircle2 size={18} className="text-emerald-600" />} color="bg-emerald-50" />
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Payroll Status</p>
          <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 text-sm font-medium px-3 py-1 rounded-full font-display">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Calculation
          </span>
          <p className="text-sm text-slate-400 mt-2">Aug 1-15, 2026</p>
        </div>
      </div>

      {/* Sales & Expense Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payroll Period Progress */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Current Payroll Period</p>
              <p className="text-lg font-bold text-slate-800 mt-0.5 font-display">August 1–15, 2026</p>
              <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full mt-1">
                Attendance Imported
              </span>
            </div>
          </div>
          <div className="space-y-2.5">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-2.5">
                {step.done ? (
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                ) : step.active ? (
                  <div className="w-4 h-4 rounded-full border-2 border-indigo-600 flex items-center justify-center shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                  </div>
                ) : (
                  <Circle size={16} className="text-slate-300 shrink-0" />
                )}
                <span className={`text-sm font-display ${step.done ? 'text-slate-600' : step.active ? 'text-indigo-600 font-semibold' : 'text-slate-400'}`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate('process-payroll')}
            className="mt-5 w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded-lg font-display flex items-center justify-center gap-2"
          >
            Continue Payroll <ArrowRight size={14} />
          </button>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm lg:col-span-2">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-800 font-display">Recent Activity</p>
          </div>
          <div className="divide-y divide-slate-50">
            {recentActivity.map((item, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50 cursor-pointer">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${item.color}`}>
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0 lg:col-span-2">
                  <p className="text-sm font-medium text-slate-700 font-display">{item.msg}</p>
                  <p className="text-xs text-slate-400 truncate">{item.sub}</p>
                </div>
                <span className="text-xs text-slate-400 shrink-0">{item.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Monthly Payroll Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-slate-800 font-display">Monthly Payroll Expenses</p>
                <p className="text-xs text-slate-400">Last 6 periods</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" />Gross</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" />Net</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthlyPayrollData} barSize={14} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `₱${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="gross" name="gross" fill="#6366f1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="net" name="net" fill="#34d399" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

        {/* Overtime Hours */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-800 font-display mb-1">Overtime Hours</p>
          <p className="text-xs text-slate-400 mb-3">Monthly trend</p>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={overtimeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="hours" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-500 mt-2">Aug: <span className="font-semibold text-amber-600 font-display">164 hrs</span> — highest this year</p>
        </div>
      </div>  
      

      {/* Bottom row */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-800 font-display">Sales &amp; Expense Summary</h3>
          <p className="text-xs text-slate-400 mt-0.5">Current month overview</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {summaryCards.map(card => (
            <StatCard key={card.label} label={card.label} value={card.value} icon={card.icon} color={card.color} />
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 font-display">Grand Total Sales by Item</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesChartData} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={52} hide={isMobile} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={value => `₱${(value / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => [`${Number(value).toLocaleString()} sales`, 'Sales']} labelFormatter={(label) => `${label}`} />
                  <Bar dataKey="grandTotalSale" name="Sales" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 font-display">Net Sales by Item</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesChartData} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={52} hide={isMobile} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={value => `₱${(value / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => [`${Number(value).toLocaleString()} sales`, 'Sales']} labelFormatter={(label) => `Item: ${label}`} />
                  <Bar dataKey="netSale" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 font-display">Order Discount by Item</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesChartData} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={52} hide={isMobile} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={value => `₱${(value / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => fmt(Number(Array.isArray(value) ? value[0] : value))} />
                  <Bar dataKey="orderDiscount" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 font-display">Expense Distribution</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseBreakdown}
                    dataKey="amount"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={68}
                    paddingAngle={2}
                  >
                    {expenseBreakdown.map((entry, index) => (
                      <Cell
                        key={`${entry.name}-${index}`}
                        fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => fmt(Number(Array.isArray(value) ? value[0] : value))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value) => <span className="text-xs text-slate-600">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}