'use client'
import { useState } from 'react'
import { Search } from 'lucide-react'
import { auditLogs } from '../data/mockData'
import useIsMobile from '../hooks/isMobile'
import Modal from '../components/Modal'

const moduleColor: Record<string, string> = {
  Attendance: 'bg-blue-100 text-blue-700',
  Payroll: 'bg-indigo-100 text-indigo-700',
  Employees: 'bg-teal-100 text-teal-700',
  Leave: 'bg-violet-100 text-violet-700',
  Settings: 'bg-slate-100 text-slate-600',
}

const actionColor: Record<string, string> = {
  'Import Attendance': 'bg-blue-50 text-blue-600',
  'Validate Attendance': 'bg-cyan-50 text-cyan-600',
  'Update Employee': 'bg-amber-50 text-amber-600',
  'Approve Leave': 'bg-emerald-50 text-emerald-600',
  'Create Employee': 'bg-teal-50 text-teal-600',
  'Approve Payroll': 'bg-indigo-50 text-indigo-600',
  'Calculate Payroll': 'bg-violet-50 text-violet-600',
  'Edit Attendance': 'bg-orange-50 text-orange-600',
  'Finalize Payroll': 'bg-emerald-50 text-emerald-600',
}

export default function AuditLogs() {
  const isMobile = useIsMobile()
  const [selectedLog, setSelectedLog] = useState<(typeof auditLogs)[number] | null>(null)
  const [search, setSearch] = useState('')
  const [module, setModule] = useState('')
  const [action, setAction] = useState('')
  const [user, setUser] = useState('')

  const filtered = auditLogs.filter(log => {
    const q = search.toLowerCase()
    const matchQ = !q || log.description.toLowerCase().includes(q) || log.user.toLowerCase().includes(q)
    const matchModule = !module || log.module === module
    const matchAction = !action || log.action === action
    const matchUser = !user || log.user === user
    return matchQ && matchModule && matchAction && matchUser
  })

  const uniqueModules = [...new Set(auditLogs.map(l => l.module))]
  const uniqueActions = [...new Set(auditLogs.map(l => l.action))]
  const uniqueUsers = [...new Set(auditLogs.map(l => l.user))]

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 font-display">Audit Logs</h2>
        <p className="text-sm text-slate-500 mt-0.5">Track all system actions and changes</p>
      </div>

      {/* Filters */}
      {isMobile ? (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 flex flex-col gap-3 shadow-sm">
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 w-full focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search logs..." className="bg-transparent text-sm outline-none text-slate-700 w-full placeholder:text-slate-400" />
          </div>
          <select value={module} onChange={e => setModule(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white outline-none focus:border-indigo-400 font-display">
            <option value="">Module: All</option>
            {uniqueModules.map(m => <option key={m}>{m}</option>)}
          </select>
          <select value={action} onChange={e => setAction(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white outline-none focus:border-indigo-400 font-display">
            <option value="">Action: All</option>
            {uniqueActions.map(a => <option key={a}>{a}</option>)}
          </select>
          <select value={user} onChange={e => setUser(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white outline-none focus:border-indigo-400 font-display">
            <option value="">User: All</option>
            {uniqueUsers.map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
      ):(

        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 flex flex-wrap gap-3 shadow-sm">
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 flex-1 min-w-48 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search logs..." className="bg-transparent text-sm outline-none text-slate-700 w-full placeholder:text-slate-400" />
          </div>
          <select value={module} onChange={e => setModule(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white outline-none focus:border-indigo-400 font-display">
            <option value="">Module: All</option>
            {uniqueModules.map(m => <option key={m}>{m}</option>)}
          </select>
          <select value={action} onChange={e => setAction(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white outline-none focus:border-indigo-400 font-display">
            <option value="">Action: All</option>
            {uniqueActions.map(a => <option key={a}>{a}</option>)}
          </select>
          <select value={user} onChange={e => setUser(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white outline-none focus:border-indigo-400 font-display">
            <option value="">User: All</option>
            {uniqueUsers.map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {!isMobile ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Date & Time', 'User', 'Action', 'Module', 'Description'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 group cursor-pointer" role="button" tabIndex={0} onClick={() => setSelectedLog(log)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedLog(log) } }}>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <p className="text-xs font-mono text-slate-600">{log.dateTime}</p>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                          <span className="text-indigo-700 text-[9px] font-bold font-display">{log.user.split(' ').map(n => n[0]).join('').slice(0, 2)}</span>
                        </div>
                        <span className="text-sm text-slate-600 font-display whitespace-nowrap">{log.user}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium font-display whitespace-nowrap ${actionColor[log.action] || 'bg-slate-100 text-slate-600'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium font-display ${moduleColor[log.module] || 'bg-slate-100 text-slate-500'}`}>
                        {log.module}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600 max-w-sm">{log.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col">
              {filtered.map(log => (
                <button key={log.id} onClick={() => setSelectedLog(log)} className="text-left p-3 border-b border-slate-50 hover:bg-slate-50 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-700">{log.action}</div>
                    <div className="text-xs text-slate-400">{log.user} • {log.dateTime}</div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${moduleColor[log.module] || 'bg-slate-100 text-slate-500'}`}>{log.module}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm text-slate-400 font-display">No audit logs match your filters.</p>
          </div>
        )}
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">Showing {filtered.length} of {auditLogs.length} entries</p>
        </div>
      </div>

      {selectedLog && (
        <Modal open={!!selectedLog} title={selectedLog.action} onClose={() => setSelectedLog(null)}>
          <div className="w-full p-3">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-400">User</p>
                  <p className="text-sm font-medium">{selectedLog.user}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Module</p>
                  <p className="text-sm font-medium">{selectedLog.module}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-slate-400">Date & Time</p>
                  <p className="text-sm font-medium">{selectedLog.dateTime}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-400">Description</p>
                <p className="text-sm text-slate-600">{selectedLog.description}</p>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
