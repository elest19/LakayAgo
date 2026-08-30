'use client'
import { useEffect, useMemo, useState, useRef } from 'react'
import { Upload, FileSpreadsheet, X, CheckCircle, AlertTriangle, ArrowRight, ChevronUp, ChevronDown, Edit2 } from 'lucide-react'
import { useApp } from '../App'
import { upsertAttendanceRecords } from '../data/mockData'
import useIsMobile from '../hooks/isMobile'
import Modal from '../components/Modal'
import WorkflowStepper from '../components/WorkflowStepper'
import { AnimatePresence, motion } from 'motion/react'
import { deriveAttendanceStatus, dispatchAttendanceReport, type FingerprintAttendanceSummary, type NormalizedAttendanceRecord } from '../utils/fingerprintAttendanceParser'
import type { AttendanceRecord } from '../types'

const buildAttendancePreview = (records: NormalizedAttendanceRecord[]): FingerprintAttendanceSummary => {
  const attendanceRecords: AttendanceRecord[] = records.map(record => {
    const normalizedStatus = deriveAttendanceStatus(record.check_in, record.check_out, record.is_weekend, record.check_in ?? '', record.check_out ?? '')

    return {
      id: `${record.employee_id}-${record.date}`,
      employeeId: record.employee_id,
      employeeName: record.employee_name,
      department: 'Unassigned',
      date: record.date,
      day: record.weekday,
      timeIn: record.check_in ?? '',
      timeOut: record.check_out ?? '',
      firstOnDuty: record.check_in ?? null,
      firstOffDuty: record.check_out ?? null,
      secondOnDuty: record.second_shift_check_in ?? null,
      secondOffDuty: record.second_shift_check_out ?? null,
      overtimeCheckIn: record.overtime_check_in ?? null,
      overtimeCheckOut: record.overtime_check_out ?? null,
      lateMinutes: 0,
      undertimeMinutes: 0,
      overtimeHours: record.is_weekend ? 1 : 0,
      // Treat weekend present records as Present (so counts reflect weekend attendance as present)
      status: normalizedStatus === 'present'
        ? 'Present'
        : normalizedStatus === 'absent'
          ? 'Absent'
          : normalizedStatus === 'incomplete'
            ? 'Incomplete'
            : record.is_weekend
              ? 'Rest Day'
              : 'Absent',
    }
  })

  const sortedDates = attendanceRecords.map(record => record.date).sort()
  const dateRange = sortedDates.length > 0
    ? { start: sortedDates[0], end: sortedDates[sortedDates.length - 1] }
    : null

  return {
    sheetsProcessed: 1,
    employeesFound: new Set(attendanceRecords.map(record => record.employeeId)).size,
    attendanceRecords: attendanceRecords.length,
    regularAttendance: attendanceRecords.filter(record => record.status === 'Present').length,
    // Count weekend attendance records that are present (previously labeled Overtime)
    weekendOvertime: attendanceRecords.filter(record => (record.day === 'SAT' || record.day === 'SUN') && record.status === 'Present').length,
    absent: attendanceRecords.filter(record => record.status === 'Absent').length,
    dateRange,
    warnings: [],
    duplicates: 0,
    records: attendanceRecords,
  }
}

type Stage = 'upload' | 'validate' | 'success'

const attendanceImportSteps = [
  { id: 'upload-file', label: 'Upload File', description: 'Select source file' },
  { id: 'attendance-validation', label: 'Attendance Validation', description: 'Check record quality' },
  { id: 'attendance-import', label: 'Attendance Import', description: 'Load validated data' },
]

function EditAttendanceRowModal({ record, onClose, onSave }: { record: AttendanceRecord; onClose: () => void; onSave: (nextRecord: AttendanceRecord) => void }) {
  const [draft, setDraft] = useState<AttendanceRecord>({ ...record })

  return (
    <Modal open={true} title="Edit Attendance" onClose={onClose}>
      <div className="space-y-4 py-2">
        <div className="w-md grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Employee</label>
            <input value={draft.employeeName} readOnly className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Date</label>
            <input value={draft.date} readOnly className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Time In</label>
            <input value={draft.timeIn} onChange={e => setDraft(prev => ({ ...prev, timeIn: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Time Out</label>
            <input value={draft.timeOut} onChange={e => setDraft(prev => ({ ...prev, timeOut: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Status</label>
            <select
              value={draft.status}
              onChange={e => setDraft(prev => ({ ...prev, status: e.target.value as AttendanceRecord['status'] }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 font-display"
            >
              {(['Present', 'Absent', 'Leave', 'Rest Day', 'Holiday', 'Incomplete', 'Overtime'] as AttendanceRecord['status'][]).map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
          <button type="button" onClick={() => onSave(draft)} className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display">Save Changes</button>
        </div>
      </div>
    </Modal>
  )
}

export default function ImportAttendance() {
  const { navigate, showToast, appMode } = useApp()
  const mapWeekendStatusDisplay = (status: AttendanceRecord['status'], day?: string) => {
    const isWeekend = day === 'SAT' || day === 'SUN'
    // Weekend present records are stored as 'Present' now; display them as 'Present (WE)'
    if (isWeekend && status === 'Present') return 'Present (WE)'
    // Fallback: if any genuine 'Overtime' exists, keep showing 'Overtime'
    return status
  }
  const isMobile = useIsMobile()
  const [showPreviewSection, setShowPreviewSection] = useState(true)
  const [showIncompleteSection, setShowIncompleteSection] = useState(true)
  const [selectedRow, setSelectedRow] = useState<{ employeeId: string; employeeName: string } | null>(null)
  const [selectedDetailRecord, setSelectedDetailRecord] = useState<AttendanceRecord | null>(null)
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null)
  const [stage, setStage] = useState<Stage>('upload')
  const [dragging, setDragging] = useState(false)
  const [fileSelected, setFileSelected] = useState(false)
  const [validating, setValidating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [fileName, setFileName] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [preview, setPreview] = useState<FingerprintAttendanceSummary | null>(null)
  const [sortColumn, setSortColumn] = useState<'id' | 'name' | 'days' | 'present' | 'absent' | 'overtime' | 'incomplete'>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const attendanceStepIndex = stage === 'upload' ? 0 : stage === 'validate' ? 1 : 2

  const prevAppModeRef = useRef(appMode)

  useEffect(() => {
    if (prevAppModeRef.current !== appMode) {
      // Only reset when switching modes while on the validation/preview step
      if (stage === 'validate') {
        setStage('upload')
        setFileName('')
        setFileSelected(false)
        setPreview(null)
        setErrorMessage('')
        showToast({
          type: 'info',
          message: 'Import reset',
          description: 'Switching between Aroo and Lakay Ago clears the current preview since they use different file formats.',
        })
      }
    }

    prevAppModeRef.current = appMode
    // Intentionally only watch appMode — we only react to mode switches
  }, [appMode])

  const employeeSummary = useMemo(() => {
    if (!preview?.records.length) return []

    const byEmployee = new Map<string, {
      employeeId: string
      employeeName: string
      count: number
      present: number
      absent: number
      overtime: number
      incompleteCount: number
    }>()

    for (const record of preview.records) {
      const entry = byEmployee.get(record.employeeId) ?? {
        employeeId: record.employeeId,
        employeeName: record.employeeName,
        count: 0,
        present: 0,
        absent: 0,
        overtime: 0,
        incompleteCount: 0,
      }

      entry.count += 1
      if (record.status === 'Present') entry.present += 1
      if (record.status === 'Absent') entry.absent += 1
      // Count weekend-present records as weekend attendance (previously counted as 'Overtime')
      if ((record.day === 'SAT' || record.day === 'SUN') && record.status === 'Present') entry.overtime += 1
      // Preserve counting of any genuine 'Overtime' status (if present)
      if (record.status === 'Overtime') entry.overtime += 1
      if (record.status === 'Incomplete') entry.incompleteCount += 1

      byEmployee.set(record.employeeId, entry)
    }

    return [...byEmployee.values()]
  }, [preview])

  const sortedEmployeeSummary = useMemo(() => {
    const rows = [...employeeSummary]

    rows.sort((a, b) => {
      let comparison = 0

      switch (sortColumn) {
        case 'id': {
          const idA = Number.parseFloat(String(a.employeeId))
          const idB = Number.parseFloat(String(b.employeeId))
          comparison = Number.isFinite(idA) && Number.isFinite(idB)
            ? idA - idB
            : String(a.employeeId).localeCompare(String(b.employeeId))
          break
        }
        case 'name':
          comparison = a.employeeName.localeCompare(b.employeeName, undefined, { sensitivity: 'base' })
          break
        case 'days':
          comparison = a.count - b.count
          break
        case 'present':
          comparison = a.present - b.present
          break
        case 'absent':
          comparison = a.absent - b.absent
          break
        case 'overtime':
          comparison = a.overtime - b.overtime
          break
        case 'incomplete':
          comparison = a.incompleteCount - b.incompleteCount
          break
        default:
          comparison = a.employeeName.localeCompare(b.employeeName, undefined, { sensitivity: 'base' })
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })

    return rows
  }, [employeeSummary, sortColumn, sortDirection])

  const incompleteEmployees = useMemo(
    () => sortedEmployeeSummary.filter(employee => employee.incompleteCount > 0),
    [sortedEmployeeSummary],
  )

  const completeEmployees = useMemo(
    () => sortedEmployeeSummary.filter(employee => employee.incompleteCount === 0),
    [sortedEmployeeSummary],
  )

  const selectedEmployeeRecords = useMemo(() => {
    if (!preview || !selectedRow) return []

    return [...preview.records]
      .filter(record => record.employeeId === selectedRow.employeeId)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [preview, selectedRow])

  const handleSaveEditedRecord = (nextRecord: AttendanceRecord) => {
    setPreview(current => {
      if (!current) return current

      return {
        ...current,
        records: current.records.map(record => record.id === nextRecord.id ? { ...record, ...nextRecord } : record),
      }
    })
    setEditingRecord(null)
  }

  const handleSort = (column: 'id' | 'name' | 'days' | 'present' | 'absent' | 'overtime' | 'incomplete') => {
    if (sortColumn === column) {
      setSortDirection(current => current === 'asc' ? 'desc' : 'asc')
      return
    }

    setSortColumn(column)
    setSortDirection('asc')
  }

  const getAriaSortState = (column: 'id' | 'name' | 'days' | 'present' | 'absent' | 'overtime' | 'incomplete') => {
    if (sortColumn !== column) return 'none'
    return sortDirection === 'asc' ? 'ascending' : 'descending'
  }

  const handleParseFile = async (file: File) => {
    setErrorMessage('')
    setFileName(file.name)
    setFileSelected(true)
    setSelectedRow(null)
    setSortColumn('name')
    setSortDirection('asc')

    try {
      const parsed = await dispatchAttendanceReport(file, appMode)
      if (!parsed.length) {
        setErrorMessage(appMode === 'aroo'
          ? 'No valid attendance records were found in the workbook. Ensure the Att.log report sheet is present.'
          : 'No valid attendance records were found in the numbered worksheets.')
        return
      }

      setPreview(buildAttendancePreview(parsed))
      setStage('validate')
    } catch (error) {
      console.error('Fingerprint attendance import failed', error)
      setErrorMessage('The workbook could not be parsed. Please upload a valid fingerprint attendance Excel file.')
    }
  }

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) {
      await handleParseFile(file)
    }
  }

  const handleFileInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      await handleParseFile(file)
    }
  }

  const handleValidate = () => {
    if (!fileName) {
      setErrorMessage('Please select an attendance file first.')
      return
    }

    setValidating(true)
    window.setTimeout(() => {
      setValidating(false)
      setStage('validate')
    }, 500)
  }

  const handleImport = () => {
    if (!preview?.records.length) {
      setErrorMessage('There are no records to import.')
      return
    }

    setImporting(true)
    window.setTimeout(() => {
      upsertAttendanceRecords(preview.records)
      setImporting(false)
      setStage('success')
      showToast({
        type: 'success',
        message: 'Attendance imported',
        description: `${preview.records.length} records were imported from ${fileName}.`,
      })
    }, 800)
  }

  if (stage === 'success') {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="text-emerald-600" size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-800 font-display mb-2">Attendance Imported Successfully</h3>
          <p className="text-sm text-slate-500 mb-6">{preview?.attendanceRecords ?? 0} attendance records imported.<br />{preview?.employeesFound ?? 0} employees affected.</p>
          <div className="bg-slate-50 rounded-xl p-4 text-left mb-6">
            <p className="text-xs text-slate-400 font-display mb-1">Date Range</p>
            <p className="text-sm font-semibold text-slate-700 font-display">
              {preview?.dateRange ? `${preview.dateRange.start} to ${preview.dateRange.end}` : 'Attendance import complete'}
            </p>
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
        <p className="text-sm text-slate-500 mt-0.5">Upload attendance records from a fingerprint Excel workbook</p>
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
          {!fileSelected ? (
            <div
              onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`bg-white rounded-2xl border-2 border-dashed p-16 text-center shadow-sm cursor-pointer transition-colors ${dragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'}`}
            >
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <FileSpreadsheet size={30} className="text-slate-400" />
              </div>
              <p className="text-lg font-bold text-slate-700 font-display mb-1">Drag & Drop Excel File Here</p>
              <p className="text-sm text-slate-400 mb-5">or</p>
              <label className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-6 py-2.5 rounded-lg font-display cursor-pointer">
                Select Excel File
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileInput} />
              </label>
              <p className="text-xs text-slate-400 mt-4">Supported formats: .xlsx, .xls</p>
            </div>
          ) : (
            <div className={`bg-white rounded-2xl border border-slate-200 p-2 shadow-sm ${isMobile ? 'p-2' : 'p-6'}`}>
              <div className="flex items-center gap-2">
                <div className={`bg-emerald-100 rounded-xl flex items-center justify-center shrink-0 ${isMobile ? 'w-8 h-8' : 'w-12 h-12'}`}>
                  <FileSpreadsheet size={isMobile ? 18 : 25} className="text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 font-display truncate">{fileName || 'Attendance workbook.xlsx'}</p>
                  <p className="text-sm text-emerald-600 font-medium">Ready for validation</p>
                </div>
                <button onClick={() => { setFileSelected(false); setFileName(''); setErrorMessage(''); setPreview(null) }} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMessage}</div>
          )}

          {fileSelected && (
            <div className="flex justify-end">
              <button onClick={handleValidate} disabled={validating} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-6 py-2.5 rounded-lg font-display disabled:opacity-70">
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

      {stage === 'validate' && preview && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800 font-display">Attendance Import Preview</h3>
          </div>

          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <AlertTriangle size={18} className="text-amber-600 shrink-0" />
            <p className="text-sm text-amber-700 font-medium">Review the workbook summary before importing. Weekend attendance is classified as overtime and should not be treated as second shift.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { label: 'Sheets', value: preview.sheetsProcessed },
              { label: 'Employees', value: preview.employeesFound },
              { label: 'Records', value: preview.attendanceRecords },
              { label: 'Regular', value: preview.regularAttendance },
              { label: 'Weekend OT', value: preview.weekendOvertime },
              { label: 'Absent', value: preview.absent },
            ].map(item => (
              <div key={item.label} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm text-center">
                <p className="text-xl font-bold font-display text-slate-800">{item.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>

          {preview.dateRange && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 font-display">Date Range</p>
              <p className="mt-2 text-lg font-bold text-slate-800 font-display">{preview.dateRange.start} to {preview.dateRange.end}</p>
            </div>
          )}

          {preview.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p className="font-semibold mb-2">Warnings</p>
              <ul className="list-disc ml-5 space-y-1">
                {preview.warnings.map((warning, index) => (
                  <li key={`${warning}-${index}`}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {incompleteEmployees.length > 0 && (
            <div className="mb-5 bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
              <div className="px-4 py-4 border-b border-red-100 bg-red-50 flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold text-red-700 font-display">
                  <AlertTriangle size={16} className="shrink-0" />
                  Incomplete Records
                </p>
                <button
                  type="button"
                  onClick={() => setShowIncompleteSection(s => !s)}
                  className="px-3 py-1.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display"
                >
                  {showIncompleteSection ? 'Hide' : 'Show'}
                </button>
              </div>

              <AnimatePresence initial={false}>
                {showIncompleteSection && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.28, ease: 'easeInOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    {isMobile ? (
                      <div className="p-3">
                        <div className="space-y-3">
                          {incompleteEmployees.map(employee => (
                            <button
                              key={employee.employeeId}
                              type="button"
                              onClick={() => setSelectedRow({ employeeId: employee.employeeId, employeeName: employee.employeeName })}
                              className="w-full rounded-xl border border-red-200 bg-red-50 p-3 text-left transition-colors hover:bg-red-100 active:bg-red-100"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-700 font-display">{employee.employeeName}</p>
                                <p className="mt-0.5 text-xs text-slate-500">ID: {employee.employeeId}</p>
                              </div>

                              <div className="mt-3 flex flex-wrap justify-end gap-2">
                                <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700">
                                  Present: {employee.present}
                                </span>
                                <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700">
                                  Weekend OT: {employee.overtime}
                                </span>
                                <span className="inline-flex items-center rounded-full border border-red-200 bg-red-100 px-2 py-1 text-[10px] font-medium text-red-700">
                                  Absent: {employee.absent}
                                </span>
                                <span className="inline-flex items-center rounded-full border border-red-200 bg-red-100 px-2 py-1 text-[10px] font-medium text-red-700">
                                  Incomplete: {employee.incompleteCount}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-red-100 bg-red-50">
                              {[
                                { key: 'id', label: 'ID' },
                                { key: 'name', label: 'Employee' },
                                { key: 'present', label: 'Present (Weekdays)' },
                                { key: 'overtime', label: 'Present (Weekends)' },
                                { key: 'absent', label: 'Absent' },
                                { key: 'incomplete', label: 'Incomplete' },
                              ].map(({ key, label }) => {
                                const isActive = sortColumn === key
                                const isAscending = isActive && sortDirection === 'asc'

                                return (
                                  <th
                                    key={key}
                                    role="button"
                                    tabIndex={0}
                                    aria-sort={getAriaSortState(key as 'id' | 'name' | 'days' | 'present' | 'absent' | 'overtime' | 'incomplete')}
                                    onClick={() => handleSort(key as 'id' | 'name' | 'days' | 'present' | 'absent' | 'overtime' | 'incomplete')}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault()
                                        handleSort(key as 'id' | 'name' | 'days' | 'present' | 'absent' | 'overtime' | 'incomplete')
                                      }
                                    }}
                                    className="cursor-pointer select-none text-left py-2.5 px-4 text-xs font-semibold text-red-700 uppercase tracking-wide font-display hover:bg-red-100"
                                  >
                                    <span className="inline-flex items-center gap-1.5">
                                      {label}
                                      {isActive && (isAscending ? <ChevronUp size={14} className="text-red-700" /> : <ChevronDown size={14} className="text-red-700" />)}
                                    </span>
                                  </th>
                                )
                              })}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-red-100">
                            {incompleteEmployees.map(employee => (
                              <tr key={employee.employeeId} className="bg-red-50 hover:bg-red-100 cursor-pointer" onClick={() => setSelectedRow({ employeeId: employee.employeeId, employeeName: employee.employeeName })}>
                                <td className="py-2.5 px-4 text-sm text-slate-700">{employee.employeeId}</td>
                                <td className="py-2.5 px-4 text-sm text-slate-700">{employee.employeeName}</td>
                                <td className="py-2.5 px-4 text-sm text-emerald-700">{employee.present}</td>
                                <td className="py-2.5 px-4 text-sm text-blue-700">{employee.overtime}</td>
                                <td className="py-2.5 px-4 text-sm text-red-700">{employee.absent}</td>
                                <td className="py-2.5 px-4 text-sm font-semibold text-red-700">{employee.incompleteCount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-4 border-b border-slate-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700 font-display">Previewed Attendance</p>
              <button
                type="button"
                onClick={() => setShowPreviewSection(s => !s)}
                className="px-3 py-1.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display"
              >
                {showPreviewSection ? 'Hide' : 'Show'}
              </button>
            </div>

            <AnimatePresence initial={false}>
              {showPreviewSection && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.28, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden' }}
                >
              {showPreviewSection && (isMobile ? (
              <div className="p-3">
                <div className="mb-3 flex items-center gap-2">
                  <select
                    value={sortColumn}
                    onChange={(event) => handleSort(event.target.value as 'id' | 'name' | 'days' | 'present' | 'absent' | 'overtime' | 'incomplete')}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 font-display"
                  >
                    <option value="id">ID</option>
                    <option value="name">Employee</option>
                    <option value="present">Present (Weekdays)</option>
                    <option value="overtime">Present (Weekends)</option>
                    <option value="absent">Absent</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setSortDirection(current => current === 'asc' ? 'desc' : 'asc')}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    aria-label={sortDirection === 'asc' ? 'Sort descending' : 'Sort ascending'}
                  >
                    {sortDirection === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>

                {completeEmployees.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">No attendance records found.</div>
                ) : (
                  <div className="space-y-3">
                    {completeEmployees.map(employee => (
                      <button
                        key={employee.employeeId}
                        type="button"
                        onClick={() => setSelectedRow({ employeeId: employee.employeeId, employeeName: employee.employeeName })}
                        className="w-full rounded-xl border border-slate-200 p-3 text-left transition-colors hover:bg-slate-50 active:bg-slate-100"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-700 font-display">{employee.employeeName}</p>
                          <p className="mt-0.5 text-xs text-slate-400">ID: {employee.employeeId}</p>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700">
                            Present: {employee.present}
                          </span>
                          <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700">
                            Weekend OT: {employee.overtime}
                          </span>
                          <span className="inline-flex items-center rounded-full border border-red-100 bg-red-50 px-2 py-1 text-[10px] font-medium text-red-700">
                            Absent: {employee.absent}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                {completeEmployees.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">No attendance records found.</div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        {[
                          { key: 'id', label: 'ID' },
                          { key: 'name', label: 'Employee' },
                          { key: 'present', label: 'Present (Weekdays)' },
                          { key: 'overtime', label: 'Present (Weekends)' },
                          { key: 'absent', label: 'Absent' },
                        ].map(({ key, label }) => {
                          const isActive = sortColumn === key
                          const isAscending = isActive && sortDirection === 'asc'

                          return (
                            <th
                              key={key}
                              role="button"
                              tabIndex={0}
                              aria-sort={getAriaSortState(key as 'id' | 'name' | 'days' | 'present' | 'absent' | 'overtime' | 'incomplete')}
                              onClick={() => handleSort(key as 'id' | 'name' | 'days' | 'present' | 'absent' | 'overtime' | 'incomplete')}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault()
                                  handleSort(key as 'id' | 'name' | 'days' | 'present' | 'absent' | 'overtime' | 'incomplete')
                                }
                              }}
                              className="cursor-pointer select-none text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display hover:bg-slate-100"
                            >
                              <span className="inline-flex items-center gap-1.5">
                                {label}
                                {isActive && (isAscending ? <ChevronUp size={14} className="text-slate-700" /> : <ChevronDown size={14} className="text-slate-700" />)}
                              </span>
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {completeEmployees.map(employee => (
                        <tr key={employee.employeeId} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedRow({ employeeId: employee.employeeId, employeeName: employee.employeeName })}>
                          <td className="py-2.5 px-4 text-sm text-slate-700">{employee.employeeId}</td>
                          <td className="py-2.5 px-4 text-sm text-slate-700">{employee.employeeName}</td>
                          <td className="py-2.5 px-4 text-sm text-emerald-700">{employee.present}</td>
                          <td className="py-2.5 px-4 text-sm text-blue-700">{employee.overtime}</td>
                          <td className="py-2.5 px-4 text-sm text-red-700">{employee.absent}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex justify-end items-center gap-3">
            {incompleteEmployees.length > 0 && (
              <p className="text-sm text-red-600 mr-2">Resolve incomplete records before importing</p>
              )}
            <button onClick={() => {
              setStage('upload')
              setPreview(null)
              setFileSelected(false)
              setSelectedRow(null)
              setSortColumn('name')
              setSortDirection('asc')
            }} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Back</button>
            <button onClick={handleImport} disabled={importing || incompleteEmployees.length > 0} title={incompleteEmployees.length > 0 ? 'Resolve incomplete records before importing' : undefined} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg font-display disabled:opacity-70">
              {importing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Importing...
                </>
              ) : (
                <>Import Attendance</>
              )}
            </button>
          </div>
        </div>
      )}

      {selectedRow && (
        <Modal open={!!selectedRow} title={`${selectedRow.employeeName} (ID: ${selectedRow.employeeId}) — Attendance Detail`} onClose={() => setSelectedRow(null)}>
          <div className={`${isMobile ? 'w-full' : 'w-[40vw] max-w-6xl'}`}>
            {selectedEmployeeRecords.length === 0 ? (
              <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-500">No attendance data for this employee.</div>
            ) : isMobile ? (
              <div className="space-y-3">
                {selectedEmployeeRecords.map(record => (
                  <button
                    key={`${record.employeeId}-${record.date}`}
                    type="button"
                    onClick={() => setSelectedDetailRecord(record)}
                    className="w-full rounded-xl border border-slate-200 p-3 text-left transition-colors hover:bg-slate-50 active:bg-slate-100"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-700 font-display">{record.date}</p>
                        <p className="text-xs text-slate-500">{record.day || '—'}</p>
                      </div>
                      {(() => {
                        const isWeekendPresent = (record.day === 'SAT' || record.day === 'SUN') && record.status === 'Present'
                        const cls = isWeekendPresent
                          ? 'bg-violet-100 text-violet-700'
                          : record.status === 'Overtime'
                            ? 'bg-blue-100 text-blue-700'
                            : record.status === 'Absent'
                              ? 'bg-red-100 text-red-700'
                              : record.status === 'Incomplete'
                                ? 'bg-amber-100 text-amber-700'
                                : record.status === 'Rest Day'
                                  ? 'bg-slate-100 text-slate-600'
                                  : 'bg-emerald-100 text-emerald-700'

                        return (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium font-display ${cls}`}>
                            {mapWeekendStatusDisplay(record.status, record.day)}
                          </span>
                        )
                      })()}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">Date</th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">Day</th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">Status</th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">Time In</th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">Time Out</th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {selectedEmployeeRecords.map(record => (
                      <tr key={`${record.employeeId}-${record.date}`} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-sm text-slate-600">{record.date}</td>
                        <td className="py-2.5 px-3 text-sm text-slate-600">{record.day || '—'}</td>
                        <td className="py-2.5 px-3">
                          {(() => {
                            const isWeekendPresent = (record.day === 'SAT' || record.day === 'SUN') && record.status === 'Present'
                            const cls = isWeekendPresent
                              ? 'bg-violet-100 text-violet-700'
                              : record.status === 'Overtime'
                                ? 'bg-blue-100 text-blue-700'
                                : record.status === 'Absent'
                                  ? 'bg-red-100 text-red-700'
                                  : record.status === 'Incomplete'
                                    ? 'bg-amber-100 text-amber-700'
                                    : record.status === 'Rest Day'
                                      ? 'bg-slate-100 text-slate-600'
                                      : 'bg-emerald-100 text-emerald-700'

                            return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium font-display ${cls}`}>{mapWeekendStatusDisplay(record.status, record.day)}</span>
                          })()}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs text-slate-600">{record.firstOnDuty ?? record.timeIn ?? '—'}</td>
                        <td className="py-2.5 px-3 font-mono text-xs text-slate-600">{record.firstOffDuty ?? record.timeOut ?? '—'}</td>
                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => setEditingRecord(record)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-green-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-600 font-display"
                          >
                            <Edit2 size={12} className="shrink-0" />
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Modal>
      )}

      {selectedDetailRecord && (
        <Modal open={!!selectedDetailRecord} title={`${selectedDetailRecord.employeeName} — Attendance Detail`} onClose={() => setSelectedDetailRecord(null)}>
          <div className="w-full max-w-md">
            <div className="space-y-0">
              <div className="border-b border-slate-100 pb-3">
                <p className="text-xs text-slate-400 font-display">Date</p>
                <p className="mt-1 text-sm font-medium text-slate-700">{selectedDetailRecord.date}</p>
              </div>
              <div className="border-b border-slate-100 py-3">
                <p className="text-xs text-slate-400 font-display">Day</p>
                <p className="mt-1 text-sm font-medium text-slate-700">{selectedDetailRecord.day || '—'}</p>
              </div>
              <div className="border-b border-slate-100 py-3">
                <p className="text-xs text-slate-400 font-display">Status</p>
                <div className="mt-1">
                  {(() => {
                    const isWeekendPresent = (selectedDetailRecord.day === 'SAT' || selectedDetailRecord.day === 'SUN') && selectedDetailRecord.status === 'Present'
                    const cls = isWeekendPresent
                      ? 'bg-violet-100 text-violet-700'
                      : selectedDetailRecord.status === 'Overtime'
                        ? 'bg-blue-100 text-blue-700'
                        : selectedDetailRecord.status === 'Absent'
                          ? 'bg-red-100 text-red-700'
                          : selectedDetailRecord.status === 'Incomplete'
                            ? 'bg-amber-100 text-amber-700'
                            : selectedDetailRecord.status === 'Rest Day'
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-emerald-100 text-emerald-700'

                    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium font-display ${cls}`}>{mapWeekendStatusDisplay(selectedDetailRecord.status, selectedDetailRecord.day)}</span>
                  })()}
                </div>
              </div>
              <div className="border-b border-slate-100 py-3">
                <p className="text-xs text-slate-400 font-display">Time In</p>
                <p className="mt-1 text-sm font-medium text-slate-700">{selectedDetailRecord.firstOnDuty ?? selectedDetailRecord.timeIn ?? '—'}</p>
              </div>
              <div className="py-3">
                <p className="text-xs text-slate-400 font-display">Time Out</p>
                <p className="mt-1 text-sm font-medium text-slate-700">{selectedDetailRecord.firstOffDuty ?? selectedDetailRecord.timeOut ?? '—'}</p>
              </div>
            </div>

            <div className="mt-5 flex justify-end border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedDetailRecord(null)
                  setEditingRecord(selectedDetailRecord)
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-green-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-600 font-display"
              >
                <Edit2 size={12} className="shrink-0" />
                Edit
              </button>
            </div>
          </div>
        </Modal>
      )}

      {editingRecord && (
        <EditAttendanceRowModal
          record={editingRecord}
          onClose={() => setEditingRecord(null)}
          onSave={(nextRecord) => handleSaveEditedRecord(nextRecord)}
        />
      )}
    </div>
  )
}
