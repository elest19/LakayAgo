'use client'
import { useState, useEffect } from 'react'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import useIsMobile from '../hooks/isMobile'
import Modal from '../components/Modal'
import { formatActionLabel, actionBadgeClass } from '../lib/auditLogFormat'

// action badge classes are provided by `actionBadgeClass`

interface SkeletonBarProps {
  width?: string | number
  height?: string | number
  rounded?: string
  className?: string
}

function SkeletonBar({ width = '100%', height = '1rem', rounded = 'rounded-md', className = '' }: SkeletonBarProps) {
  return (
    <div
      className={`bg-slate-200 animate-pulse ${rounded} ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  )
}

interface SkeletonTableRowsProps {
  columns: number
  rows?: number
  columnConfig?: { width?: string; pill?: boolean }[]
}

function SkeletonTableRows({ columns, rows = 6, columnConfig }: SkeletonTableRowsProps) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIdx) => (
        <tr key={rowIdx} className="border-b border-slate-50">
          {Array.from({ length: columns }, (_, colIdx) => {
            const config = columnConfig?.[colIdx]
            return (
              <td key={colIdx} className="py-2 px-3">
                <SkeletonBar
                  width={config?.width ?? '80%'}
                  height={config?.pill ? '1.1rem' : '0.85rem'}
                  rounded={config?.pill ? 'rounded-full' : 'rounded-md'}
                />
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}

export default function AuditLogs() {
  const isMobile = useIsMobile()
  const [logs, setLogs] = useState<any[]>([])
  const [selectedLog, setSelectedLog] = useState<any | null>(null)
  const [search, setSearch] = useState('')
  const [logsLoading, setLogsLoading] = useState(true)
  const [action, setAction] = useState('')
  const [user, setUser] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const PAGE_SIZE = 10

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLogsLoading(true)
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('pageSize', String(PAGE_SIZE))
        // module filter removed
        if (action) params.set('action', action)
        if (user) params.set('user', user)
        const res = await fetch(`/api/audit-logs?${params.toString()}`)
        if (!res.ok) return
        const body = await res.json()
        if (mounted) {
          setLogs(body.logs || [])
          setTotal(body.total || 0)
        }
      } catch (err) {
        console.error('Failed to load audit logs', err)
      } finally {
        if (mounted) setLogsLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [page, action, user])

  const filtered = logs.filter((log: any) => {
    const q = search.toLowerCase()
    return !q || (log.description || '').toLowerCase().includes(q) || (log.user || '').toLowerCase().includes(q)
  })

  const uniqueActions = [...new Set(logs.map(l => l.action))]
  const uniqueUsers = [...new Set(logs.map(l => l.user))]

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
          {/* module filter removed */}
          <select value={action} onChange={e => { setAction(e.target.value); setPage(1) }} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white outline-none focus:border-indigo-400 font-display">
            <option value="">Action: All</option>
            {uniqueActions.map(a => <option key={a}>{a}</option>)}
          </select>
          <select value={user} onChange={e => { setUser(e.target.value); setPage(1) }} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white outline-none focus:border-indigo-400 font-display">
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
          {/* module filter removed */}
          <select value={action} onChange={e => { setAction(e.target.value); setPage(1) }} className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white outline-none focus:border-indigo-400 font-display">
            <option value="">Action: All</option>
            {uniqueActions.map(a => <option key={a}>{a}</option>)}
          </select>
          <select value={user} onChange={e => { setUser(e.target.value); setPage(1) }} className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white outline-none focus:border-indigo-400 font-display">
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
                  {['Date & Time', 'User', 'Action', 'Description'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {logsLoading ? (
                  <SkeletonTableRows
                    columns={4}
                    rows={6}
                    columnConfig={[
                      { width: '18%' },
                      { width: '22%' },
                      { width: '18%', pill: true },
                      { width: '42%' },
                    ]}
                  />
                ) : (
                  filtered.map((log, index) => (
                    <tr key={log.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-100'} hover:bg-slate-50 group cursor-pointer`} role="button" tabIndex={0} onClick={() => setSelectedLog(log)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedLog(log) } }}>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <p className="text-xs font-mono text-slate-600">{log.dateTime}</p>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                            <span className="text-indigo-700 text-[9px] font-bold font-display">{log.user.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</span>
                          </div>
                          <span className="text-sm text-slate-600 font-display whitespace-nowrap">{log.user}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium font-display whitespace-nowrap ${actionBadgeClass(log.action)}`}>
                          {formatActionLabel(log.action)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600 max-w-sm">{log.description}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col">
              {filtered.map((log, index) => (
                <button key={log.id} onClick={() => setSelectedLog(log)} className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-100'} text-left p-3 border-b border-slate-50 hover:bg-slate-50 flex items-center justify-between gap-3`}>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-700">{formatActionLabel(log.action)}</div>
                    <div className="text-xs text-slate-400">{log.user} • {log.dateTime}</div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${actionBadgeClass(log.action)}`}>{formatActionLabel(log.action)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {filtered.length === 0 && !logsLoading && (
          <div className="py-12 text-center">
            <p className="text-sm text-slate-400 font-display">No audit logs match your filters.</p>
          </div>
        )}
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">Showing {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} entries</p>
          {total > PAGE_SIZE && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.ceil(total / PAGE_SIZE) }, (_, i) => {
                const p = i + 1
                const show = p === 1 || p === Math.ceil(total / PAGE_SIZE) || Math.abs(p - page) <= 2
                if (!show) {
                  if (i === 1 || i === Math.ceil(total / PAGE_SIZE) - 2) return <span key={p} className="px-1 text-slate-400">…</span>
                  return null
                }
                return (
                  <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 rounded-lg text-xs font-medium font-display ${page === p ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                    {p}
                  </button>
                )
              })}
              <button
                onClick={() => setPage(p => Math.min(Math.ceil(total / PAGE_SIZE), p + 1))}
                disabled={page === Math.ceil(total / PAGE_SIZE)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
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
