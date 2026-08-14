import { useState } from 'react'
import { Eye, RotateCcw, FileText, X } from 'lucide-react'
import { importHistory } from '../data/mockData'
import type { ImportRecord } from '../types'
import { useApp } from '../App'
import useIsMobile from '../hooks/isMobile'
import Modal from '../components/Modal'

const statusColor: Record<ImportRecord['status'], string> = {
  Successful: 'bg-emerald-100 text-emerald-700',
  'Partially Imported': 'bg-amber-100 text-amber-700',
  Failed: 'bg-red-100 text-red-700',
  Reverted: 'bg-slate-100 text-slate-500',
}


export default function ImportHistory() {
  const { showToast } = useApp()
  const isMobile = useIsMobile()
  const [selectedImport, setSelectedImport] = useState<ImportRecord | null>(null)
  const [undoTarget, setUndoTarget] = useState<ImportRecord | null>(null)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 font-display">Attendance Import History</h2>
        <p className="text-sm text-slate-500 mt-0.5">View all attendance file imports</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {!isMobile ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Date Imported', 'File Name', 'Records', 'Employees', 'Imported By', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {importHistory.map(imp => (
                  <tr key={imp.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 text-sm text-slate-600">{imp.dateImported}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-emerald-500 shrink-0" />
                        <span className="text-sm font-medium text-slate-700 font-display">{imp.fileName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600">{imp.records.toLocaleString()}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600">{imp.employees}</td>
                    <td className="py-3 px-4 text-sm text-slate-600">{imp.importedBy}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium font-display ${statusColor[imp.status]}`}>{imp.status}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setSelectedImport(imp)} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 text-xs flex items-center gap-1 font-display" title="View Import">
                          <Eye size={14} />
                        </button>
                        {imp.status === 'Successful' && (
                          <button
                            onClick={() => setUndoTarget(imp)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                            title="Undo Import"
                          >
                            <RotateCcw size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col">
              {importHistory.map(imp => (
                <button key={imp.id} onClick={() => setSelectedImport(imp)} className="text-left p-3 border-b border-slate-50 hover:bg-slate-50 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-700">{imp.fileName}</div>
                    <div className="text-xs text-slate-400">{imp.dateImported} • {imp.importedBy}</div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor[imp.status]}`}>{imp.status}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedImport && (
        <Modal open={!!selectedImport} title={selectedImport.fileName} onClose={() => setSelectedImport(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full p-6">
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-400">Date Imported</p>
                  <p className="text-sm font-medium">{selectedImport.dateImported}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Status</p>
                  <p className="text-sm font-medium">{selectedImport.status}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Records</p>
                  <p className="text-sm font-medium">{selectedImport.records}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Employees</p>
                  <p className="text-sm font-medium">{selectedImport.employees}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-400">Imported By</p>
                <p className="text-sm font-medium">{selectedImport.importedBy}</p>
              </div>

              {selectedImport.entries && selectedImport.entries.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
                    Record Entries
                  </p>

                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {selectedImport.entries.map((entry, index) => (
                      <div
                        key={`${entry.employeeId}-${entry.date}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-700">{entry.employeeName}</p>
                          <p className="text-xs text-slate-500">
                            {entry.employeeId} • {entry.date}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-xs font-mono text-slate-600">
                            {entry.timeIn || '—'} — {entry.timeOut || '—'}
                          </p>
                          <p className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            {entry.status}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {undoTarget && (
        <Modal open={true} title="Undo Import?" onClose={() => setUndoTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full p-6">
            <div className="bg-slate-50 rounded-xl p-3 mb-5">
              <p className="text-sm font-medium text-slate-700 font-display">{undoTarget.fileName}</p>
              <p className="text-xs text-slate-400 mt-0.5">{undoTarget.records} records · {undoTarget.dateImported}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
              <p className="text-xs text-red-700 font-medium">
                ⚠ This will remove all {undoTarget.records} attendance records from this import. This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setUndoTarget(null)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
              <button
                onClick={() => {
                  setUndoTarget(null)
                  showToast({ type: 'success', message: 'Import reverted', description: `${undoTarget.records} attendance records have been removed.` })
                }}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg font-display"
              >
                Undo Import
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
