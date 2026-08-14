import { useApp } from '../App'
import {
  Users, UserCheck, AlertTriangle, Clock, TrendingUp, TrendingDown,
  ArrowRight, CheckCircle2, Circle, FileText, Activity
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
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
    <p className="text-2xl font-bold text-slate-800 font-display">{value}</p>
    <p className="text-sm text-slate-500 mt-0.5">{label}</p>
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

export default function Dashboard() {
  const { navigate } = useApp()

  return (
    <div className="p-6 space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Employees" value="45" icon={<Users size={18} className="text-indigo-600" />} color="bg-indigo-50" trend={{ dir: 'up', text: '+2 this month' }} />
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
            Payroll Calculation
          </span>
          <p className="text-xs text-slate-400 mt-2">August 1–15, 2026</p>
        </div>
      </div>

      {/* Middle row */}
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

      {/* Bottom row */}
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
    </div>
  )
}
