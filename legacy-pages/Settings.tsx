'use client'
import { useState } from 'react'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { useApp } from '../App'
import useIsMobile from '../hooks/isMobile'
import Modal from '../components/Modal'

type Tab = 'payroll' | 'attendance' | 'holidays' | 'users'

const tabLabels: { id: Tab; label: string }[] = [
  { id: 'payroll', label: 'Payroll' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'holidays', label: 'Holidays' },
  { id: 'users', label: 'Users & Roles' },
]

const earningsTypes = ['Basic Salary', 'Overtime', 'Holiday Pay', 'Night Differential', 'Allowance', 'Bonus', 'Commission']
const deductionTypes = ['SSS', 'PhilHealth', 'Pag-IBIG', 'Withholding Tax', 'Late', 'Undertime', 'Absence', 'Other']

const holidays = [
  { date: 'Aug 26, 2026', holiday: "National Heroes' Day", type: 'Regular Holiday', status: 'Active' },
  { date: 'Sep 1, 2026', holiday: 'Company Foundation Day', type: 'Company Holiday', status: 'Active' },
  { date: 'Nov 1, 2026', holiday: "All Saints' Day", type: 'Regular Holiday', status: 'Active' },
  { date: 'Nov 2, 2026', label: "All Souls' Day", holiday: "All Souls' Day", type: 'Special Non-Working Holiday', status: 'Active' },
  { date: 'Dec 25, 2026', holiday: 'Christmas Day', type: 'Regular Holiday', status: 'Active' },
  { date: 'Dec 30, 2026', holiday: "Rizal Day", type: 'Regular Holiday', status: 'Active' },
]

const users = [
  { name: 'Eduardo Mendoza', email: 'eduardo.mendoza@company.ph', role: 'Super Admin', status: 'Active' },
  { name: 'Lorna Bautista', email: 'lorna.bautista@company.ph', role: 'Admin', status: 'Active' },
  { name: 'Maria Santos', email: 'maria.santos@company.ph', role: 'Staff', status: 'Active' },
  { name: 'Roberto Reyes', email: 'roberto.reyes@company.ph', role: 'Admin', status: 'Active' },
  { name: 'Ana Garcia', email: 'ana.garcia@company.ph', role: 'Admin', status: 'Active' },
  { name: 'Diana Ramos', email: 'diana.ramos@company.ph', role: 'Staff', status: 'Active' },
]

const roleColor: Record<string, string> = {
  'Super Admin': 'bg-indigo-300 text-indigo-700',
  'Admin': 'bg-blue-300 text-blue-700',
  'Staff': 'bg-violet-300 text-violet-700',
}

const holidayTypeColor: Record<string, string> = {
  'Regular Holiday': 'bg-red-100 text-red-700',
  'Special Non-Working Holiday': 'bg-amber-100 text-amber-700',
  'Company Holiday': 'bg-blue-100 text-blue-700',
}

export default function SettingsPage() {
  const { showToast } = useApp()
  const isMobile = useIsMobile()
  const [holidayList, setHolidayList] = useState(holidays)
  const [userList, setUserList] = useState(users)
  const [earningsTypesList, setEarningsTypesList] = useState(earningsTypes)
  const [deductionTypesList, setDeductionTypesList] = useState(deductionTypes)
  const [selectedHoliday, setSelectedHoliday] = useState<(typeof holidays)[number] | null>(null)
  const [selectedUser, setSelectedUser] = useState<(typeof users)[number] | null>(null)
  const [editingHoliday, setEditingHoliday] = useState<{ index: number; item: (typeof holidays)[number] } | null>(null)
  const [editingUser, setEditingUser] = useState<{ index: number; item: (typeof users)[number] } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'holiday' | 'user'; index: number; item: (typeof holidays)[number] | (typeof users)[number] } | null>(null)
  const [deleteSalaryTarget, setDeleteSalaryTarget] = useState<{ kind: 'earning' | 'deduction'; key: string } | null>(null)
  const [tab, setTab] = useState<Tab>('payroll')
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false)

  const defaultPayrollSettings = {
    payrollFrequency: 'Semi-Monthly',
    salaryCalculation: 'Based on worked days',
    overtimeRegular: '1.25x',
    overtimeRest: '1.3x',
    workingHours: '8',
    lateGracePeriod: '5',
  }

  const defaultAttendanceSettings = {
    gracePeriod: '5',
    requiredDailyHours: '8',
    breakDuration: '60',
    overtimeThreshold: '8',
  }

  const [payrollSettings, setPayrollSettings] = useState(defaultPayrollSettings)
  const [attendanceSettings, setAttendanceSettings] = useState(defaultAttendanceSettings)

  const defaultEarningsAmounts: Record<string, number> = {
    'Basic Salary': 15000,
    'Overtime': 1000,
    'Holiday Pay': 3500,
    'Night Differential': 500,
    'Allowance': 2000,
    'Bonus': 0,
    'Commission': 0,
  }

  const [earningsAmounts, setEarningsAmounts] = useState<Record<string, number>>(defaultEarningsAmounts)

  const defaultDeductionAmounts: Record<string, number> = {
    SSS: 500,
    PhilHealth: 150,
    'Pag-IBIG': 100,
    'Withholding Tax': 1200,
    Late: 0,
    Undertime: 0,
    Absence: 0,
    Loan: 0,
    Other: 0,
  }

  const [deductionAmounts, setDeductionAmounts] = useState<Record<string, number>>(defaultDeductionAmounts)

  const [editingAmount, setEditingAmount] = useState<{ kind: 'earning' | 'deduction'; key: string; value: number } | null>(null)

  const formatCurrency = (n: number) => `Php ${Math.round(n).toLocaleString()}`

  const handleSave = () => setSaveConfirmOpen(true)

  const saveSummary: Record<Tab, string[]> = {
    payroll: ['Payroll frequency', 'Salary calculation', 'Overtime multipliers', 'Working hours & grace period'],
    attendance: ['Grace period', 'Required daily hours', 'Break duration', 'Overtime threshold'],
    holidays: ['Holiday calendar', 'Holiday types', 'Holiday status settings'],
    users: ['User access', 'Role assignments', 'Account status settings'],
  }

  const tabChanges = {
    payroll: [
      {
        label: 'Payroll Frequency',
        from: defaultPayrollSettings.payrollFrequency,
        to: payrollSettings.payrollFrequency,
      },
      {
        label: 'Salary Calculation',
        from: defaultPayrollSettings.salaryCalculation,
        to: payrollSettings.salaryCalculation,
      },
      {
        label: 'Overtime Multiplier (Regular Day)',
        from: defaultPayrollSettings.overtimeRegular,
        to: payrollSettings.overtimeRegular,
      },
      {
        label: 'Overtime Multiplier (Rest Day)',
        from: defaultPayrollSettings.overtimeRest,
        to: payrollSettings.overtimeRest,
      },
      {
        label: 'Working Hours Per Day',
        from: defaultPayrollSettings.workingHours,
        to: payrollSettings.workingHours,
      },
      {
        label: 'Late Grace Period (minutes)',
        from: defaultPayrollSettings.lateGracePeriod,
        to: payrollSettings.lateGracePeriod,
      },
    ].filter(change => change.from !== change.to),

    attendance: [
      {
        label: 'Grace Period (minutes)',
        from: defaultAttendanceSettings.gracePeriod,
        to: attendanceSettings.gracePeriod,
      },
      {
        label: 'Required Daily Hours',
        from: defaultAttendanceSettings.requiredDailyHours,
        to: attendanceSettings.requiredDailyHours,
      },
      {
        label: 'Break Duration (minutes)',
        from: defaultAttendanceSettings.breakDuration,
        to: attendanceSettings.breakDuration,
      },
      {
        label: 'Overtime Threshold (hours)',
        from: defaultAttendanceSettings.overtimeThreshold,
        to: attendanceSettings.overtimeThreshold,
      },
    ].filter(change => change.from !== change.to),

    holidays: [],
    users: [],
  } as const

  const confirmSave = () => {
    setSaveConfirmOpen(false)
    showToast({
      type: 'success',
      message: 'Settings saved',
      description: `Changes to ${tabLabels.find(t => t.id === tab)?.label ?? 'this settings section'} were saved successfully.`,
    })
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 font-display">Settings</h2>
        <p className="text-sm text-slate-500 mt-0.5">Configure system and payroll settings</p>
      </div>

      {isMobile ? (
        <div className="border-slate-100 flex flex-wrap gap-1">
          <select
            value={tab}
            onChange={(e) => setTab(e.target.value as Tab)}
            className="w-md px-2 py-2.5 mb-5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-display cursor-pointer"
          >
            {tabLabels.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
      ) : (
        <div className="flex gap-1 mb-6 flex-wrap">
          {tabLabels.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium rounded-lg font-display
                ${tab === t.id ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'payroll' && (
        <div className="bg-white rounded-t rounded-xl border border-slate-200 p-6 shadow-sm max-w-xl">
          <p className="text-sm font-semibold text-slate-700 font-display mb-5">Payroll Settings</p>
          <div className="space-y-4">
            {[
              { label: 'Payroll Frequency', key: 'payrollFrequency', opts: ['Semi-Monthly', 'Monthly', 'Bi-Weekly', 'Weekly'] },
              { label: 'Salary Calculation', key: 'salaryCalculation', opts: ['Based on worked days', 'Fixed monthly'] },
              { label: 'Overtime Multiplier (Regular Day)', key: 'overtimeRegular', opts: ['1.25x', '1.5x', '2.0x'] },
              { label: 'Overtime Multiplier (Rest Day)', key: 'overtimeRest', opts: ['1.3x', '1.5x', '2.0x'] },
            ].map(f => (
              <div key={f.label}>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">{f.label}</label>
                <select
                  value={payrollSettings[f.key as keyof typeof payrollSettings]}
                  onChange={e => setPayrollSettings(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 font-display text-slate-700"
                >
                  {f.opts.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            ))}
            {[
              { label: 'Working Hours Per Day', key: 'workingHours' },
              { label: 'Late Grace Period (minutes)', key: 'lateGracePeriod' },
            ].map(f => (
              <div key={f.label}>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">{f.label}</label>
                <input
                  value={payrollSettings[f.key as keyof typeof payrollSettings]}
                  onChange={e => setPayrollSettings(prev => ({ ...prev, [f.key]: e.target.value }))}
                  type="number"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-end">
            <button onClick={handleSave} className="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display">Save Changes</button>
          </div>
        </div>
      )}

      {tab === 'attendance' && (
        <div className="bg-white rounded-t rounded-xl border border-slate-200 p-6 shadow-sm max-w-xl">
          <p className="text-sm font-semibold text-slate-700 font-display mb-5">Attendance Settings</p>
          <div className="space-y-4">
            {[
              { label: 'Grace Period (minutes)', key: 'gracePeriod' },
              { label: 'Required Daily Hours', key: 'requiredDailyHours' },
              { label: 'Break Duration (minutes)', key: 'breakDuration' },
              { label: 'Overtime Threshold (hours)', key: 'overtimeThreshold' },
            ].map(f => (
              <div key={f.label}>
                <label className="block text-xs font-medium text-slate-600 mb-1 font-display">{f.label}</label>
                <input
                  value={attendanceSettings[f.key as keyof typeof attendanceSettings]}
                  onChange={e => setAttendanceSettings(prev => ({ ...prev, [f.key]: e.target.value }))}
                  type="number"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-end">
            <button onClick={handleSave} className="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display">Save Changes</button>
          </div>
        </div>
      )}

      {tab === 'holidays' && (
        <div className="bg-white rounded-t rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-700 font-display">Holidays</p>
            <button className="flex items-center gap-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-display">
              <Plus size={14} /> Add Holiday
            </button>
          </div>
          {!isMobile ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Date', 'Holiday', 'Type', 'Status'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {holidayList.map((h, i) => (
                  <tr
                    key={`${h.date}-${h.holiday}`}
                    className="hover:bg-slate-50 group cursor-pointer"
                    onClick={() => setSelectedHoliday(h)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedHoliday(h)
                      }
                    }}
                  >
                    <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap">{h.date}</td>
                    <td className="py-3 px-4 text-sm font-medium text-slate-700 font-display">{h.holiday}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium font-display ${holidayTypeColor[h.type]}`}>{h.type}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium font-display">{h.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col">
              {holidayList.map((h, i) => (
                <div key={`${h.date}-${h.holiday}`} className="p-3 border-b border-slate-50 flex items-center justify-between gap-3">
                  <button onClick={() => setSelectedHoliday(h)} className="text-left flex-1 min-w-0 hover:bg-slate-50">
                    <div className="text-sm font-medium text-slate-700">{h.holiday}</div>
                    <div className="text-xs text-slate-400">{h.date} • {h.type}</div>
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* Holidays do not use the global Save Changes button here; actions are per-item in the modal */}
        </div>
      )}

      {tab === 'users' && (
        <div className="bg-white rounded-t rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-700 font-display">Users & Roles</p>
            <button className="flex items-center gap-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-display">
              <Plus size={14} /> Invite User
            </button>
          </div>
          {!isMobile ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['User', 'Email', 'Role', 'Status'].map(h => (
                        <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">{h}</th>
                      ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {userList.map((u, i) => (
                  <tr
                    key={`${u.email}-${u.name}`}
                    className="hover:bg-slate-50 group cursor-pointer"
                    onClick={() => setSelectedUser(u)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedUser(u)
                      }
                    }}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                          <span className="text-indigo-700 text-xs font-bold font-display">{u.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</span>
                        </div>
                        <span className="text-sm font-medium text-slate-700 font-display">{u.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-500">{u.email}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium font-display ${roleColor[u.role] || 'bg-slate-100 text-slate-500'}`}>{u.role}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium font-display">{u.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col">
              {userList.map((u, i) => (
                <div key={`${u.email}-${u.name}`} className="p-3 border-b border-slate-50 flex items-center justify-between gap-3">
                  <button
                    onClick={() => setSelectedUser(u)}
                    className="flex flex-col items-start text-left min-w-0 hover:bg-slate-50"
                  >
                    <span className="text-sm font-medium text-slate-700">{u.name}</span>
                    <span className="text-xs text-slate-400">{u.role}</span>
                    <span className="text-xs text-slate-400">{u.email}</span>
                  </button>

                  <div className="flex gap-1">
                    <button onClick={() => setEditingUser({ index: i, item: u })} className="p-1.5 text-slate-400 hover:text-slate-700">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => setDeleteTarget({ kind: 'user', index: i, item: u })} className="p-1.5 text-slate-400 hover:text-red-600">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {saveConfirmOpen && (
        <Modal open={saveConfirmOpen} title="Save changes?" onClose={() => setSaveConfirmOpen(false)}>
          <div className="w-full p-2">
            <p className="text-sm font-semibold text-slate-700 mb-3">{tabLabels.find(t => t.id === tab)?.label ?? 'This section'}</p>
            <p className="text-sm text-slate-600 mb-4">You are about to save the following changes:</p>
            {tabChanges[tab].length > 0 ? (
              <ul className="mb-5 text-sm text-slate-600 space-y-3">
                {tabChanges[tab].map(change => (
                  <li key={change.label} className="flex flex-col border border-slate-200 rounded-lg bg-slate-50 p-3">
                    <div className="text-sm font-medium text-slate-700">{change.label}</div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                      <span className="text-slate-500">{change.from}</span>
                      <span className="text-slate-400">→</span>
                      <span className="font-medium text-indigo-600">{change.to}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="space-y-2 mb-5 text-sm text-slate-600">
                {saveSummary[tab].map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setSaveConfirmOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
              <button onClick={confirmSave} className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display">Confirm Save</button>
            </div>
          </div>
        </Modal>
      )}

      {editingAmount && (
        <Modal open={!!editingAmount} title={`Edit ${editingAmount.key}`} onClose={() => setEditingAmount(null)}>
          <div className="w-full p-2">
            <p className="text-sm text-slate-600 mb-4">Adjust amount for <span className="font-medium text-slate-700">{editingAmount.key}</span></p>
            <div className="mb-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Current amount</div>
              <div className="text-sm font-medium text-slate-700 mt-1">{formatCurrency(editingAmount.value)}</div>
            </div>
            <div className="mb-4">
              <label className="block text-xs text-slate-500 mb-1">New amount (PHP)</label>
              <input
                type="number"
                value={editingAmount.value}
                onChange={e => setEditingAmount(prev => prev ? { ...prev, value: Number(e.target.value) } : prev)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setEditingAmount(null)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
              <button
                onClick={() => {
                  if (!editingAmount) return
                  if (editingAmount.kind === 'earning') {
                    setEarningsAmounts(prev => ({ ...prev, [editingAmount.key]: editingAmount.value }))
                  } else {
                    setDeductionAmounts(prev => ({ ...prev, [editingAmount.key]: editingAmount.value }))
                  }
                  setEditingAmount(null)
                  showToast({ type: 'success', message: 'Amount updated', description: `${editingAmount.key} updated to ${formatCurrency(editingAmount.value)}` })
                }}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display"
              >
                Save
              </button>
            </div>
          </div>
        </Modal>
      )}

      {editingHoliday && (
        <Modal open={!!editingHoliday} title="Edit Holiday" onClose={() => setEditingHoliday(null)}>
          <div className="w-full p-2">
            <div className="w-md space-y-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Holiday Name</label>
                <input
                  value={editingHoliday.item.holiday}
                  onChange={e => setEditingHoliday(prev => prev ? { ...prev, item: { ...prev.item, holiday: e.target.value } } : prev)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Date</label>
                <input
                  value={editingHoliday.item.date}
                  onChange={e => setEditingHoliday(prev => prev ? { ...prev, item: { ...prev.item, date: e.target.value } } : prev)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Type</label>
                <select
                  value={editingHoliday.item.type}
                  onChange={e => setEditingHoliday(prev => prev ? { ...prev, item: { ...prev.item, type: e.target.value } } : prev)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  {Object.keys(holidayTypeColor).map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Status</label>
                <select
                  value={editingHoliday.item.status}
                  onChange={e => setEditingHoliday(prev => prev ? { ...prev, item: { ...prev.item, status: e.target.value } } : prev)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex gap-3 justify-end">
              <button onClick={() => setEditingHoliday(null)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
              <button
                onClick={() => {
                  if (!editingHoliday) return
                  setHolidayList(prev => prev.map((item, idx) => idx === editingHoliday.index ? editingHoliday.item : item))
                  setEditingHoliday(null)
                  showToast({ type: 'success', message: 'Holiday updated', description: `${editingHoliday.item.holiday} was updated successfully.` })
                }}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display"
              >
                Save Changes
              </button>
            </div>
          </div>
        </Modal>
      )}

      {editingUser && (
        <Modal open={!!editingUser} title="Edit User" onClose={() => setEditingUser(null)}>
          <div className="w-full p-2">
            <div className="w-md space-y-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Full Name</label>
                <input
                  value={editingUser.item.name}
                  onChange={e => setEditingUser(prev => prev ? { ...prev, item: { ...prev.item, name: e.target.value } } : prev)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Email</label>
                <input
                  value={editingUser.item.email}
                  onChange={e => setEditingUser(prev => prev ? { ...prev, item: { ...prev.item, email: e.target.value } } : prev)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Role</label>
                <select
                  value={editingUser.item.role}
                  onChange={e => setEditingUser(prev => prev ? { ...prev, item: { ...prev.item, role: e.target.value } } : prev)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  {Object.keys(roleColor).map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Status</label>
                <select
                  value={editingUser.item.status}
                  onChange={e => setEditingUser(prev => prev ? { ...prev, item: { ...prev.item, status: e.target.value } } : prev)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex gap-3 justify-end">
              <button onClick={() => setEditingUser(null)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
              <button
                onClick={() => {
                  if (!editingUser) return
                  setUserList(prev => prev.map((item, idx) => idx === editingUser.index ? editingUser.item : item))
                  setEditingUser(null)
                  showToast({ type: 'success', message: 'User updated', description: `${editingUser.item.name} was updated successfully.` })
                }}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display"
              >
                Save Changes
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal open={!!deleteTarget} title="Confirm deletion" onClose={() => setDeleteTarget(null)}>
          <div className="w-full p-2">
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to delete <span className="font-semibold text-slate-700">{deleteTarget.kind === 'holiday' ? (deleteTarget.item as (typeof holidays)[number]).holiday : (deleteTarget.item as (typeof users)[number]).name}</span>?
            </p>
            <p className="text-xs text-slate-500 mb-5">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
              <button
                onClick={() => {
                  if (!deleteTarget) return
                  if (deleteTarget.kind === 'holiday') {
                    setHolidayList(prev => prev.filter((_, idx) => idx !== deleteTarget.index))
                    showToast({ type: 'success', message: 'Holiday deleted', description: `${(deleteTarget.item as (typeof holidays)[number]).holiday} was removed.` })
                  } else {
                    setUserList(prev => prev.filter((_, idx) => idx !== deleteTarget.index))
                    showToast({ type: 'success', message: 'User deleted', description: `${(deleteTarget.item as (typeof users)[number]).name} was removed.` })
                  }
                  setDeleteTarget(null)
                }}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg font-display"
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteSalaryTarget && (
        <Modal open={!!deleteSalaryTarget} title="Confirm deletion" onClose={() => setDeleteSalaryTarget(null)}>
          <div className="w-full p-2">
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to delete <span className="font-semibold text-slate-700">{deleteSalaryTarget.key}</span>?
            </p>
            <p className="text-xs text-slate-500 mb-5">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteSalaryTarget(null)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
              <button
                onClick={() => {
                  if (!deleteSalaryTarget) return
                  if (deleteSalaryTarget.kind === 'earning') {
                    setEarningsTypesList(prev => prev.filter(type => type !== deleteSalaryTarget.key))
                    setEarningsAmounts(prev => {
                      const next = { ...prev }
                      delete next[deleteSalaryTarget.key]
                      return next
                    })
                    showToast({ type: 'success', message: 'Earning type deleted', description: `${deleteSalaryTarget.key} was removed from earnings.` })
                  } else {
                    setDeductionTypesList(prev => prev.filter(type => type !== deleteSalaryTarget.key))
                    setDeductionAmounts(prev => {
                      const next = { ...prev }
                      delete next[deleteSalaryTarget.key]
                      return next
                    })
                    showToast({ type: 'success', message: 'Deduction type deleted', description: `${deleteSalaryTarget.key} was removed from deductions.` })
                  }
                  setDeleteSalaryTarget(null)
                }}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg font-display"
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}

      {selectedHoliday && (
        <Modal open={!!selectedHoliday} title={selectedHoliday.holiday || selectedHoliday.label || 'Holiday'} onClose={() => setSelectedHoliday(null)}>
          <div className="space-y-3">
            <div className="w-md grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-400">Date</p>
                <p className="text-sm font-medium">{selectedHoliday.date}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Type</p>
                <p className="text-sm font-medium">{selectedHoliday.type}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400">Status</p>
              <p className="text-sm font-medium">{selectedHoliday.status}</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button onClick={() => setSelectedHoliday(null)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Close</button>
            <button onClick={() => { setSelectedHoliday(null); setEditingHoliday({ index: holidayList.findIndex(it => it.holiday === selectedHoliday.holiday && it.date === selectedHoliday.date), item: selectedHoliday }) }} className="px-3 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">Edit</button>
            <button onClick={() => { setSelectedHoliday(null); setDeleteTarget({ kind: 'holiday', index: holidayList.findIndex(it => it.holiday === selectedHoliday.holiday && it.date === selectedHoliday.date), item: selectedHoliday }) }} className="px-3 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg">Delete</button>
          </div>
        </Modal>
      )}

      {selectedUser && (
        <Modal open={!!selectedUser} title={selectedUser.name} onClose={() => setSelectedUser(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-400">Email</p>
                <p className="text-sm font-medium">{selectedUser.email}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Role</p>
                <p className="text-sm font-medium">{selectedUser.role}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400">Status</p>
              <p className="text-sm font-medium">{selectedUser.status}</p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button onClick={() => setSelectedUser(null)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Close</button>
              <button onClick={() => { setSelectedUser(null); setEditingUser({ index: userList.findIndex(it => it.email === selectedUser.email), item: selectedUser }) }} className="px-3 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">Edit</button>
              <button onClick={() => { setSelectedUser(null); setDeleteTarget({ kind: 'user', index: userList.findIndex(it => it.email === selectedUser.email), item: selectedUser }) }} className="px-3 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg">Delete</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
