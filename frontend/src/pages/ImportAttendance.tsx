import { useState } from 'react'
import { Upload, FileSpreadsheet, X, CheckCircle, AlertTriangle, Download, ArrowRight } from 'lucide-react'
import { useApp } from '../App'
import useIsMobile from '../hooks/isMobile'
import Modal from '../components/Modal'
import WorkflowStepper from '../components/WorkflowStepper'

type Stage = 'upload' | 'validate' | 'success'

const validationRows = [
  { row: 1, empId: 'EMP-001', name: 'Juan Dela Cruz', date: 'Aug 1, 2026', timeIn: '8:03 AM', timeOut: '5:00 PM', status: 'valid', error: '' },
  { row: 2, empId: 'EMP-002', name: 'Maria Santos', date: 'Aug 1, 2026', timeIn: '8:00 AM', timeOut: '6:00 PM', status: 'valid', error: '' },
  { row: 3, empId: 'EMP-XXX', name: '—', date: 'Aug 1, 2026', timeIn: '8:00 AM', timeOut: '5:00 PM', status: 'error', error: 'Employee ID not found' },
  { row: 4, empId: 'EMP-004', name: 'Ana Garcia', date: 'Aug 1, 2026', timeIn: '8:00 AM', timeOut: '', status: 'error', error: 'Missing Time Out' },
  { row: 5, empId: 'EMP-005', name: 'Carlo Mendoza', date: 'Aug 1, 2026', timeIn: '', timeOut: '', status: 'valid', error: '' },
  { row: 6, empId: 'EMP-006', name: 'Lorna Bautista', date: 'Aug/01/26', timeIn: '8:00 AM', timeOut: '5:00 PM', status: 'error', error: 'Invalid date format' },
  { row: 7, empId: 'EMP-007', name: 'Mark Villanueva', date: 'Aug 1, 2026', timeIn: '8:00 AM', timeOut: '5:00 PM', status: 'valid', error: '' },
  { row: 8, empId: 'EMP-008', name: 'Grace Torres', date: 'Aug 1, 2026', timeIn: '8:05 AM', timeOut: '4:45 PM', status: 'valid', error: '' },
]

const attendanceImportSteps = [
  { id: 'upload-file', label: 'Upload File', description: 'Select source file' },
  { id: 'attendance-validation', label: 'Attendance Validation', description: 'Check record quality' },
  { id: 'attendance-import', label: 'Attendance Import', description: 'Load validated data' },
]

export default function ImportAttendance() {
  const { navigate, showToast } = useApp()
  const isMobile = useIsMobile()
  const [selectedRow, setSelectedRow] = useState<typeof validationRows[number] | null>(null)
  const [stage, setStage] = useState<Stage>('upload')
  const [dragging, setDragging] = useState(false)
  const [fileSelected, setFileSelected] = useState(false)
  const [validating, setValidating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [filterErrors, setFilterErrors] = useState(false)

  const attendanceStepIndex = stage === 'upload' ? 0 : stage === 'validate' ? 1 : 2

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    setFileSelected(true)
  }

  const handleFileSelect = () => setFileSelected(true)

  const handleValidate = () => {
    setValidating(true)
    setTimeout(() => { setValidating(false); setStage('validate') }, 1800)
  }

  const handleImport = () => {
    setImporting(true)
    setTimeout(() => { setImporting(false); setStage('success') }, 2000)
  }

  const rows = filterErrors ? validationRows.filter(r => r.status === 'error') : validationRows

  if (stage === 'success') {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="text-emerald-600" size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-800 font-display mb-2">Attendance Imported Successfully</h3>
          <p className="text-sm text-slate-500 mb-6">245 attendance records imported.<br />45 employees affected.</p>
          <div className="bg-slate-50 rounded-xl p-4 text-left mb-6">
            <p className="text-xs text-slate-400 font-display mb-1">Payroll Period</p>
            <p className="text-sm font-semibold text-slate-700 font-display">August 1–15, 2026</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate('attendance-records')} className="flex-1 border border-slate-200 text-slate-700 text-sm font-semibold py-2.5 rounded-lg hover:bg-slate-50 font-display">
              View Attendance
            </button>
            <button onClick={() => navigate('process-payroll')} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded-lg font-display flex items-center justify-center gap-2">
              Go to Payroll <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 font-display">Import Attendance</h2>
        <p className="text-sm text-slate-500 mt-0.5">Upload attendance records from an Excel file</p>
      </div>

      <div className="mb-6">
        <WorkflowStepper
          steps={attendanceImportSteps}
          activeIndex={attendanceStepIndex}
          showNavigation={false}
          visibleCount={3}
        />
      </div>

      {stage === 'upload' && (
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Drop zone */}
          {!fileSelected ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`bg-white rounded-2xl border-2 border-dashed p-16 text-center shadow-sm cursor-pointer transition-colors
                ${dragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'}`}
              onClick={handleFileSelect}
            >
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <FileSpreadsheet size={30} className="text-slate-400" />
              </div>
              <p className="text-lg font-bold text-slate-700 font-display mb-1">Drag & Drop Excel File Here</p>
              <p className="text-sm text-slate-400 mb-5">or</p>
              <button className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-6 py-2.5 rounded-lg font-display" onClick={e => e.stopPropagation()}>
                Select Excel File
              </button>
              <p className="text-xs text-slate-400 mt-4">Supported formats: .xlsx, .xls</p>
            </div>
          ) : (
            <div className={`bg-white rounded-2xl border border-slate-200 p-2 shadow-sm ${isMobile ? 'p-2' : 'p-6'}`}>
              <div className="flex items-center gap-2">
                <div className={`bg-emerald-100 rounded-xl flex items-center justify-center shrink-0 ${isMobile ? 'w-8 h-8' : 'w-12 h-12'}`}>
                  <FileSpreadsheet size={ isMobile ? 18 : 25 } className="text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800 font-display">attendance_aug_1_15_2026.xlsx</p>
                    {isMobile ? (
                      <div>
                        <span className="block text-xs text-slate-500">Records: 245</span>
                        <span className="block text-xs text-slate-500">Size: 2.4 MB</span>
                        <span className="block text-xs text-emerald-600 font-medium">Ready for validation</span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-sm text-slate-500">Records: 245</span>
                        <span className="text-sm text-slate-500"> - </span>
                        <span className="text-sm text-slate-500">Size: 2.4 MB</span>
                        <span className="text-sm text-slate-500"> - </span>
                        <span className="text-sm text-emerald-600 font-medium">Ready for validation</span>
                      </div>
                    )}
                </div>
                <button onClick={() => setFileSelected(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
              </div>
            </div>
          )}

          {/* Template download 
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700 font-display">Need a template?</p>
              <p className="text-xs text-slate-400">Download the official attendance import template</p>
            </div>
            <button className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-semibold font-display">
              <Download size={14} /> Download Excel Template
            </button>
          </div>
          */}

          {fileSelected && (
            <div className="flex justify-end">
              <button
                onClick={handleValidate}
                disabled={validating}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-6 py-2.5 rounded-lg font-display disabled:opacity-70"
              >
                {validating ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>Validate File <ArrowRight size={14} /></>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {stage === 'validate' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800 font-display">Validate Attendance Import</h3>
          </div>

          {/* Warning */}
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <AlertTriangle size={18} className="text-amber-600 shrink-0" />
            <p className="text-sm text-amber-700 font-medium">Review all errors before importing attendance.</p>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { label: 'Total Records', value: '245', color: 'text-slate-800' },
              { label: 'Valid Records', value: '242', color: 'text-emerald-600' },
              { label: 'Errors', value: '3', color: 'text-red-600' },
              { label: 'Employees', value: '45', color: 'text-slate-800' },
              { label: 'Duplicates', value: '0', color: 'text-slate-800' },
              { label: 'Missing Att.', value: '2', color: 'text-amber-600' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm text-center">
                <p className={`text-xl font-bold font-display ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-700 font-display">Validation Results</p>
              <button
                onClick={() => setFilterErrors(!filterErrors)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg font-display
                  ${filterErrors ? 'bg-red-100 text-red-700' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                {filterErrors ? 'Show All' : 'View Errors (3)'}
              </button>
            </div>
            <div className="overflow-x-auto">
              {!isMobile ? (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      {['Row', 'Employee ID', 'Employee', 'Date', 'Time In', 'Time Out', 'Status'].map(h => (
                        <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rows.map(r => (
                      <tr key={r.row} className={r.status === 'error' ? 'bg-red-50' : 'hover:bg-slate-50'}>
                        <td className="py-2.5 px-4 font-mono text-xs text-slate-500">{r.row}</td>
                        <td className="py-2.5 px-4">
                          <span className={`font-mono text-xs px-2 py-0.5 rounded ${r.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>{r.empId}</span>
                        </td>
                        <td className="py-2.5 px-4 text-sm text-slate-600">{r.name}</td>
                        <td className="py-2.5 px-4 text-sm text-slate-600">{r.date}</td>
                        <td className="py-2.5 px-4 font-mono text-xs text-slate-600">{r.timeIn || '—'}</td>
                        <td className="py-2.5 px-4 font-mono text-xs text-slate-600">{r.timeOut || '—'}</td>
                        <td className="py-2.5 px-4">
                          {r.status === 'error' ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium font-display">{r.error}</span>
                            </div>
                          ) : (
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium font-display">Valid</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col">
                  {rows.map(r => (
                    <button key={r.row} onClick={() => setSelectedRow(r)} className="text-left p-3 border-b border-slate-50 hover:bg-slate-50 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-700">{r.name || r.empId}</div>
                        <div className="text-xs text-slate-400">{r.date} • {r.empId}</div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${r.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{r.status === 'error' ? 'Error' : 'Valid'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 justify-end">
            <div className="flex gap-2">
              <button onClick={() => setStage('upload')} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel Import</button>
            </div>
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-6 py-2.5 rounded-lg font-display disabled:opacity-70"
            >
              {importing ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Importing...</>
              ) : (
                <>Import Records <ArrowRight size={14} /></>
              )}
            </button>
          </div>
        </div>
      )}

      {selectedRow && (
        <Modal open={!!selectedRow} title={`Row ${selectedRow.row}`} onClose={() => setSelectedRow(null)}>
          <div className="w-md space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-400">Employee ID</p>
                <p className="text-sm font-medium">{selectedRow.empId}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Employee</p>
                <p className="text-sm font-medium">{selectedRow.name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Date</p>
                <p className="text-sm font-medium">{selectedRow.date}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Time In</p>
                <p className="text-sm font-medium">{selectedRow.timeIn || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Time Out</p>
                <p className="text-sm font-medium">{selectedRow.timeOut || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Status</p>
                <p className="text-sm font-medium">{selectedRow.status === 'error' ? 'Error' : 'Valid'}</p>
              </div>
            </div>
            {selectedRow.status === 'error' && (
              <div>
                <p className="text-xs text-slate-400">Error</p>
                <p className="text-sm text-red-700">{selectedRow.error}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
