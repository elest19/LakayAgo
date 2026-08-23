import * as XLSX from 'xlsx'
import type { AttendanceRecord } from '../types'

export interface FingerprintAttendanceSummary {
  sheetsProcessed: number
  employeesFound: number
  attendanceRecords: number
  regularAttendance: number
  weekendOvertime: number
  absent: number
  dateRange: { start: string; end: string } | null
  warnings: string[]
  duplicates: number
  records: AttendanceRecord[]
}

const normalizeCell = (value: unknown) => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return String(value)
  return String(value).replace(/ /g, ' ').trim()
}

export interface NormalizedAttendanceRecord {
  employee_id: string
  employee_name: string
  date: string
  weekday: string
  is_weekend: boolean
  check_in: string | null
  check_out: string | null
  source_column_group: 'regular' | 'overtime' | 'second_shift'
  status: 'present' | 'absent' | 'no_punch' | 'incomplete'
  second_shift_check_in: string | null
  second_shift_check_out: string | null
  overtime_check_in: string | null
  overtime_check_out: string | null
  source_sheet: string
  report_period: string
}

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const
const BLOCK_OFFSETS = [0, 15, 30]

const getCellValue = (rows: unknown[][], rowIndex: number, columnIndex: number) => {
  const row = rows[rowIndex]
  if (!row || columnIndex < 0 || columnIndex >= row.length) return ''
  return normalizeCell(row[columnIndex])
}

const getReportPeriod = (rows: unknown[][]) => {
  for (const row of rows) {
    const joined = row.map(normalizeCell).join(' ')
    const match = joined.match(/(\d{4}-\d{1,2}-\d{1,2})\s*(?:~|to|-|–|—)\s*(\d{4}-\d{1,2}-\d{1,2})/i)
    if (match) {
      return { start: match[1], end: match[2], text: `${match[1]} ~ ${match[2]}` }
    }
  }

  return null
}

const toIsoDate = (year: number, month: number, day: number) => {
  const date = new Date(Date.UTC(year, month - 1, day))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

const parseWeekDate = (value: string) => {
  const match = value.trim().match(/^(\d{1,2})\s*([A-Z]{3})$/i)
  if (!match) return null
  return {
    dayNumber: Number(match[1]),
    weekday: match[2].toUpperCase(),
  }
}

const isValidTime = (value: string | null | undefined) => {
  if (!value) return false
  const trimmed = value.trim()
  return /^\d{1,2}:\d{2}$/.test(trimmed)
}

const cleanTime = (value: string | null | undefined) => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.toUpperCase() === 'ABSENT') return null
  return /^\d{1,2}:\d{2}$/.test(trimmed) ? trimmed.padStart(5, '0') : null
}

export const deriveAttendanceStatus = (
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
  isWeekend: boolean,
  rawCheckIn?: string | null,
  rawCheckOut?: string | null,
): NormalizedAttendanceRecord['status'] => {
  const hasExplicitAbsentMarker = (rawCheckIn ?? '').trim().toUpperCase() === 'ABSENT'
    || (rawCheckOut ?? '').trim().toUpperCase() === 'ABSENT'

  if (!isWeekend && hasExplicitAbsentMarker) return 'absent'

  const hasValidCheckIn = isValidTime(checkIn)
  const hasValidCheckOut = isValidTime(checkOut)

  if (hasValidCheckIn && hasValidCheckOut) return 'present'
  if (hasValidCheckIn || hasValidCheckOut) return 'incomplete'

  return isWeekend ? 'no_punch' : 'absent'
}

const validateWeekDay = (date: Date, expected: string) => {
  const actual = DAY_NAMES[date.getUTCDay()]
  return actual === expected
}

export const parseAttendanceReport = async (filePath: string | File | Blob): Promise<NormalizedAttendanceRecord[]> => {
  const fileBuffer = typeof filePath === 'string'
    ? await (await import('node:fs/promises')).readFile(filePath)
    : new Uint8Array(await filePath.arrayBuffer())

  const workbook = XLSX.read(fileBuffer instanceof Uint8Array ? fileBuffer : new Uint8Array(fileBuffer), { type: 'array' })
  const records: NormalizedAttendanceRecord[] = []

  for (const sheetName of workbook.SheetNames) {
    if (!/^\d+(\.\d+){1,2}$/.test(sheetName.trim())) continue

    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) as unknown[][]
    const reportPeriod = getReportPeriod(rows)
    if (!reportPeriod) continue

    const periodStart = new Date(`${reportPeriod.start}T00:00:00`)
    const periodStartMonth = periodStart.getMonth() + 1
    const periodStartYear = periodStart.getFullYear()

    for (const base of BLOCK_OFFSETS) {
      const employeeName = getCellValue(rows, 2, base + 9)
      if (!employeeName) continue

      const employeeId = getCellValue(rows, 3, base + 9) || getCellValue(rows, 2, base + 9)

      for (let rowIndex = 11; rowIndex < rows.length; rowIndex += 1) {
        const weekDateValue = getCellValue(rows, rowIndex, base)
        if (!weekDateValue) continue

        const weekDate = parseWeekDate(weekDateValue)
        if (!weekDate) continue

        const date = new Date(Date.UTC(periodStartYear, periodStartMonth - 1, weekDate.dayNumber))
        const finalDate = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`

        const firstOnDuty = getCellValue(rows, rowIndex, base + 1)
        const firstOffDuty = getCellValue(rows, rowIndex, base + 3)
        const secondOnDuty = getCellValue(rows, rowIndex, base + 6)
        const secondOffDuty = getCellValue(rows, rowIndex, base + 8)
        const overtimeCheckIn = getCellValue(rows, rowIndex, base + 10)
        const overtimeCheckOut = getCellValue(rows, rowIndex, base + 12)
        const weekend = weekDate.weekday === 'SAT' || weekDate.weekday === 'SUN'

        const primaryCheckIn = weekend ? overtimeCheckIn : firstOnDuty
        const primaryCheckOut = weekend ? overtimeCheckOut : firstOffDuty
        const secondShiftCheckIn = cleanTime(secondOnDuty)
        const secondShiftCheckOut = cleanTime(secondOffDuty)
        const overtimeIn = cleanTime(overtimeCheckIn)
        const overtimeOut = cleanTime(overtimeCheckOut)

        if (!validateWeekDay(date, weekDate.weekday)) {
          continue
        }

        let status: NormalizedAttendanceRecord['status'] = 'no_punch'
        let sourceColumnGroup: NormalizedAttendanceRecord['source_column_group'] = 'regular'
        let checkIn: string | null = null
        let checkOut: string | null = null

        if (weekend) {
          sourceColumnGroup = 'overtime'
          checkIn = cleanTime(primaryCheckIn)
          checkOut = cleanTime(primaryCheckOut)
          status = deriveAttendanceStatus(checkIn, checkOut, true, primaryCheckIn, primaryCheckOut)
        } else {
          checkIn = cleanTime(primaryCheckIn)
          checkOut = cleanTime(primaryCheckOut)
          status = deriveAttendanceStatus(checkIn, checkOut, false, primaryCheckIn, primaryCheckOut)

          if ((secondOnDuty && secondOnDuty !== '') || (secondOffDuty && secondOffDuty !== '')) {
            sourceColumnGroup = 'second_shift'
          }
        }

        records.push({
          employee_id: String(employeeId || employeeName),
          employee_name: employeeName,
          date: finalDate,
          weekday: weekDate.weekday,
          is_weekend: weekend,
          check_in: checkIn,
          check_out: checkOut,
          source_column_group: sourceColumnGroup,
          status,
          second_shift_check_in: secondShiftCheckIn,
          second_shift_check_out: secondShiftCheckOut,
          overtime_check_in: overtimeIn,
          overtime_check_out: overtimeOut,
          source_sheet: sheetName,
          report_period: reportPeriod.text,
        })
      }
    }
  }

  return records
}

