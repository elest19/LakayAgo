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
  is_ambiguous_single_punch?: boolean
  extra_punch_count?: number
  source_sheet: string
  report_period: string
}

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const

const discoverEmployeeBases = (rows: unknown[][]) => {
  const maxColumns = Math.max(0, ...rows.map(row => row.length))
  const bases: number[] = []

  for (let columnIndex = 9; columnIndex < maxColumns; columnIndex += 15) {
    const employeeName = getCellValue(rows, 2, columnIndex)
    if (employeeName) {
      bases.push(columnIndex - 9)
    }
  }

  return bases.length ? bases : [0, 15, 30]
}

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

const createUtcDateFromYmd = (value: string | null | undefined) => {
  if (!value) return null
  const trimmed = String(value).trim()
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  return new Date(Date.UTC(year, month - 1, day))
}

const normalizeDateOnly = (value: string | null | undefined) => {
  if (!value) return null
  const trimmed = String(value).trim()
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null
  return `${match[1]}-${match[2]}-${match[3]}`
}

const parseWeekDate = (value: string) => {
  const compact = value.trim()
  const withWeekday = compact.match(/^(\d{1,2})\s*([A-Z]{3})$/i)
  if (withWeekday) {
    return {
      dayNumber: Number(withWeekday[1]),
      weekday: withWeekday[2].toUpperCase(),
    }
  }

  const plainDay = compact.match(/^(\d{1,2})$/)
  if (plainDay) {
    return {
      dayNumber: Number(plainDay[1]),
      weekday: null,
    }
  }

  return null
}

const isValidTime = (value: string | null | undefined) => {
  if (!value) return false
  const trimmed = value.trim()
  return /^\d{1,2}:\d{2}$/.test(trimmed)
}

const canonicalizeTime = (value: string | null | undefined): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.toUpperCase() === 'ABSENT') return null

  const digitsOnly = trimmed.replace(/[^0-9]/g, '')
  if (digitsOnly.length === 3) {
    const hour = Number(digitsOnly.slice(0, 1))
    const minute = Number(digitsOnly.slice(1))
    if (Number.isNaN(hour) || Number.isNaN(minute) || hour > 23 || minute > 59) return null
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  }

  if (digitsOnly.length === 4) {
    const hour = Number(digitsOnly.slice(0, 2))
    const minute = Number(digitsOnly.slice(2, 4))
    if (Number.isNaN(hour) || Number.isNaN(minute) || hour > 23 || minute > 59) return null
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  }

  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [hourText, minuteText] = trimmed.split(':')
    const hour = Number(hourText)
    const minute = Number(minuteText)
    if (Number.isNaN(hour) || Number.isNaN(minute) || hour > 23 || minute > 59) return null
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  }

  return null
}

const extractPunchTimes = (value: string | null | undefined) => {
  if (!value) return { times: [], isAmbiguousSinglePunch: false, extraPunchCount: 0 }

  const trimmed = value.trim()
  if (!trimmed || trimmed.toUpperCase() === 'ABSENT') return { times: [], isAmbiguousSinglePunch: false, extraPunchCount: 0 }

  const matches = trimmed.match(/\d{1,2}:\d{2}|\d{4}/g) ?? []
  const times = matches
    .map(token => canonicalizeTime(token))
    .filter((token): token is string => Boolean(token))

  if (times.length === 0) return { times: [], isAmbiguousSinglePunch: false, extraPunchCount: 0 }

  return {
    times,
    isAmbiguousSinglePunch: times.length === 1,
    extraPunchCount: Math.max(0, times.length - 2),
  }
}

const cleanTime = (value: string | null | undefined) => {
  if (!value) return null
  const { times } = extractPunchTimes(value)
  if (times.length === 0) return null
  if (times.length === 1) return times[0]
  return times[0]
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

  const firstPunchResult = extractPunchTimes(rawCheckIn ?? checkIn)
  const secondPunchResult = extractPunchTimes(rawCheckOut ?? checkOut)
  const hasValidCheckIn = isValidTime(checkIn)
  const hasValidCheckOut = isValidTime(checkOut)
  const isSinglePunch = (firstPunchResult.times.length === 1 && secondPunchResult.times.length === 0)
    || (firstPunchResult.times.length === 0 && secondPunchResult.times.length === 1)

  if (hasValidCheckIn && hasValidCheckOut) return 'present'
  if (isSinglePunch) return 'incomplete'
  if (hasValidCheckIn || hasValidCheckOut) return 'incomplete'

  return isWeekend ? 'no_punch' : 'absent'
}

const validateWeekDay = (date: Date, expected?: string | null) => {
  if (!expected) return true
  const actual = DAY_NAMES[date.getUTCDay()]
  return actual === expected
}

export type AttendanceParseMode = 'aroo' | 'lakayAgo'

export const dispatchAttendanceReport = async (
  filePath: string | File | Blob,
  appMode: AttendanceParseMode = 'lakayAgo',
): Promise<NormalizedAttendanceRecord[]> => {
  if (appMode === 'aroo') {
    return await parseArooAttendanceReport(filePath)
  }

  const records = await parseAttendanceReport(filePath, appMode)
  return records
}

export const parseAttendanceReport = async (
  filePath: string | File | Blob,
  _appMode: AttendanceParseMode = 'lakayAgo',
): Promise<NormalizedAttendanceRecord[]> => {
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

    const periodStart = createUtcDateFromYmd(reportPeriod.start) ?? new Date(`${reportPeriod.start}T00:00:00Z`)
    const periodStartMonth = periodStart.getUTCMonth() + 1
    const periodStartYear = periodStart.getUTCFullYear()

    const employeeBases = discoverEmployeeBases(rows)

    for (const base of employeeBases) {
      const employeeName = getCellValue(rows, 2, base + 9)
      if (!employeeName) continue

      const employeeId = getCellValue(rows, 3, base + 9) || getCellValue(rows, 2, base + 9)

      for (let rowIndex = 11; rowIndex < rows.length; rowIndex += 1) {
        const weekDateValue = getCellValue(rows, rowIndex, base)
        if (!weekDateValue) continue

        const weekDate = parseWeekDate(weekDateValue)
        if (!weekDate) continue

        const startDate = createUtcDateFromYmd(reportPeriod.start) ?? new Date(`${reportPeriod.start}T00:00:00Z`)
        const monthOffset = weekDate.dayNumber < startDate.getUTCDate() ? 1 : 0
        const date = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + monthOffset, weekDate.dayNumber))
        const finalDate = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`

        const firstOnDuty = getCellValue(rows, rowIndex, base + 1)
        const firstOffDuty = getCellValue(rows, rowIndex, base + 3)
        const secondOnDuty = getCellValue(rows, rowIndex, base + 6)
        const secondOffDuty = getCellValue(rows, rowIndex, base + 8)
        const overtimeCheckIn = getCellValue(rows, rowIndex, base + 10)
        const overtimeCheckOut = getCellValue(rows, rowIndex, base + 12)
        const weekend = weekDate.weekday ? (weekDate.weekday === 'SAT' || weekDate.weekday === 'SUN') : false

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
        let isAmbiguousSinglePunch = false
        let extraPunchCount = 0

        if (weekend) {
          sourceColumnGroup = 'overtime'
          const primaryResult = extractPunchTimes(primaryCheckIn)
          const secondaryResult = extractPunchTimes(primaryCheckOut)
          checkIn = primaryResult.times[0] ?? null
          checkOut = secondaryResult.times[secondaryResult.times.length - 1] ?? null
          isAmbiguousSinglePunch = primaryResult.isAmbiguousSinglePunch || secondaryResult.isAmbiguousSinglePunch
          extraPunchCount = Math.max(primaryResult.extraPunchCount, secondaryResult.extraPunchCount)
          status = deriveAttendanceStatus(checkIn, checkOut, true, primaryCheckIn, primaryCheckOut)
        } else {
          const primaryResult = extractPunchTimes(primaryCheckIn)
          const secondaryResult = extractPunchTimes(primaryCheckOut)
          checkIn = primaryResult.times[0] ?? null
          checkOut = secondaryResult.times[secondaryResult.times.length - 1] ?? null
          isAmbiguousSinglePunch = primaryResult.isAmbiguousSinglePunch || secondaryResult.isAmbiguousSinglePunch
          extraPunchCount = Math.max(primaryResult.extraPunchCount, secondaryResult.extraPunchCount)
          status = deriveAttendanceStatus(checkIn, checkOut, false, primaryCheckIn, primaryCheckOut)

          if ((secondOnDuty && secondOnDuty !== '') || (secondOffDuty && secondOffDuty !== '')) {
            sourceColumnGroup = 'second_shift'
          }
        }

        records.push({
          employee_id: String(employeeId || employeeName),
          employee_name: employeeName,
          date: finalDate,
          weekday: weekDate.weekday ?? DAY_NAMES[date.getUTCDay()],
          is_weekend: weekend,
          check_in: checkIn,
          check_out: checkOut,
          source_column_group: sourceColumnGroup,
          status,
          second_shift_check_in: secondShiftCheckIn,
          second_shift_check_out: secondShiftCheckOut,
          overtime_check_in: overtimeIn,
          overtime_check_out: overtimeOut,
          is_ambiguous_single_punch: isAmbiguousSinglePunch,
          extra_punch_count: extraPunchCount,
          source_sheet: sheetName,
          report_period: reportPeriod.text,
        })
      }
    }
  }

  return records
}

const guessRowToDate = (raw: string) => {
  if (!raw) return null
  const trimmed = raw.trim()

  // Try ISO-like first
  const isoMatch = trimmed.match(/(\d{4}-\d{1,2}-\d{1,2})[ T](\d{1,2}:\d{2}(?::\d{2})?)/)
  if (isoMatch) return { date: isoMatch[1], time: isoMatch[2].slice(0,5) }

  // Try dd/mm/yyyy or dd-mm-yyyy
  const dmy = trimmed.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})[ T]?(\d{1,2}:\d{2})?/) 
  if (dmy) {
    const year = Number(dmy[3])
    const month = Number(dmy[2])
    const day = Number(dmy[1])
    const date = new Date(Date.UTC(year, month - 1, day))
    return { date: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`, time: dmy[4] ? dmy[4].slice(0,5) : null }
  }

  // Try yyyy/mm/dd
  const ymd = trimmed.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})[ T]?(\d{1,2}:\d{2})?/) 
  if (ymd) {
    const year = Number(ymd[1])
    const month = Number(ymd[2])
    const day = Number(ymd[3])
    const date = new Date(Date.UTC(year, month - 1, day))
    return { date: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`, time: ymd[4] ? ymd[4].slice(0,5) : null }
  }

  // Fallback if only time present
  const timeOnly = trimmed.match(/^(\d{1,2}:\d{2})(:\d{2})?$/)
  if (timeOnly) return { date: null, time: timeOnly[1] }

  return null
}

const parseArooAttendanceReport = async (filePath: string | File | Blob): Promise<NormalizedAttendanceRecord[]> => {
  const fileBuffer = typeof filePath === 'string'
    ? await (await import('node:fs/promises')).readFile(filePath)
    : new Uint8Array(await filePath.arrayBuffer())

  const workbook = XLSX.read(fileBuffer instanceof Uint8Array ? fileBuffer : new Uint8Array(fileBuffer), { type: 'array' })
  const records: NormalizedAttendanceRecord[] = []

  const sheetName = workbook.SheetNames.find(name => /att\.?log/i.test(name)) ?? workbook.SheetNames[0]
  if (!sheetName) return records

  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) as unknown[][]

  const reportPeriod = getReportPeriod(rows)
  if (!reportPeriod) return records

  const periodStartDate = new Date(`${reportPeriod.start}T00:00:00Z`)
  const periodStartDay = periodStartDate.getUTCDate()
  const periodStartMonth = periodStartDate.getUTCMonth() + 1
  const periodStartYear = periodStartDate.getUTCFullYear()

  // locate the day-number row: look for the row with many numeric day values
  let dayRowIndex = -1
  let dayColumns: number[] = []
  for (let i = 0; i < Math.min(8, rows.length); i++) {
    const row = rows[i].map(normalizeCell)
    let count = 0
    const cols: number[] = []
    for (let c = 0; c < row.length; c++) {
      const v = row[c]
      if (/^\d{1,2}$/.test(String(v))) {
        count++
        cols.push(c)
      }
    }
    if (count >= 5) { // heuristic: at least 5 day columns
      dayRowIndex = i
      dayColumns = cols
      break
    }
  }

  if (dayRowIndex === -1) return records

  const dayNumbers = dayColumns.map(c => parseInt(String(normalizeCell(rows[dayRowIndex][c]) || ''), 10))

  // helper to compute ISO date from day number with month-rollover using periodStart
  const computeDateFromDayNumber = (dayNum: number) => {
    if (!Number.isFinite(dayNum) || dayNum <= 0) return null
    const monthOffset = dayNum < periodStartDay ? 1 : 0
    const month = periodStartMonth + monthOffset
    const year = periodStartYear + Math.floor((month - 1) / 12)
    const monthIndex = ((month - 1) % 12)
    const date = new Date(Date.UTC(year, monthIndex, dayNum))
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
  }

  // Employee rows: ID row then data row pairs starting after dayRowIndex
  for (let r = dayRowIndex + 1; r < rows.length - 1; r += 2) {
    const idRow = rows[r].map(normalizeCell)
    const dataRow = rows[r + 1] ? rows[r + 1].map(normalizeCell) : []

    // The ID/label row layout (confirmed):
    // col 0 = "ID:" (label), col 2 = actual employee ID
    // col 8 = "Name:" (label), col 10 = actual employee name
    // col 18 = "Dept.:" (label), col 20 = actual department
    const rawIdCell = idRow[2] ?? idRow[idRow.findIndex(cell => String(cell).trim() !== '')]
    const rawNameCell = idRow[10] ?? idRow[idRow.findIndex((_, idx) => idx > 2 && String(idRow[idx]).trim() !== '') + 2]
    const rawDeptCell = idRow[20] ?? ''

    const rawId = String(rawIdCell ?? '').trim()
    const idMatch = rawId.match(/(\d+)/)
    const employeeId = idMatch ? idMatch[1] : rawId || `unknown-${r}`

    const employeeName = String(rawNameCell ?? '').trim() || String(employeeId)
    const department = String(rawDeptCell ?? '').trim() || ''

    let recordsForEmployee = 0

    for (let i = 0; i < dayColumns.length; i++) {
      const col = dayColumns[i]
      const dayNum = dayNumbers[i]
      const isoDate = computeDateFromDayNumber(dayNum)
      if (!isoDate) continue

      const cellRaw = normalizeCell(dataRow[col])
      if (!cellRaw) {
        // push absent/no_punch record
        const dateObj = new Date(`${isoDate}T00:00:00Z`)
        const weekday = DAY_NAMES[dateObj.getUTCDay()]
        const isWeekend = weekday === 'SAT' || weekday === 'SUN'
        records.push({
          employee_id: String(employeeId),
          employee_name: employeeName,
          date: isoDate,
          weekday,
          is_weekend: isWeekend,
          check_in: null,
          check_out: null,
          source_column_group: 'regular',
          status: deriveAttendanceStatus(null, null, isWeekend, '', ''),
          second_shift_check_in: null,
          second_shift_check_out: null,
          overtime_check_in: null,
          overtime_check_out: null,
          is_ambiguous_single_punch: false,
          extra_punch_count: 0,
          source_sheet: sheetName,
          report_period: reportPeriod.text,
        })
        continue
      }

      const punches = extractPunchTimes(cellRaw)
      const checkInRaw = punches.times[0] ?? null
      const checkOutRaw = punches.times[punches.times.length - 1] ?? null
      const checkIn = canonicalizeTime(checkInRaw)
      const checkOut = canonicalizeTime(checkOutRaw)

      const dateObj = new Date(`${isoDate}T00:00:00Z`)
      const weekday = DAY_NAMES[dateObj.getUTCDay()]
      const isWeekend = weekday === 'SAT' || weekday === 'SUN'

      records.push({
        employee_id: String(employeeId),
        employee_name: employeeName,
        date: isoDate,
        weekday,
        is_weekend: isWeekend,
        check_in: checkIn,
        check_out: checkOut,
        source_column_group: 'regular',
        status: deriveAttendanceStatus(checkIn, checkOut, isWeekend, checkInRaw, checkOutRaw),
        second_shift_check_in: null,
        second_shift_check_out: null,
        overtime_check_in: null,
        overtime_check_out: null,
        is_ambiguous_single_punch: punches.isAmbiguousSinglePunch,
        extra_punch_count: punches.extraPunchCount,
        source_sheet: sheetName,
        report_period: reportPeriod.text,
      })

      recordsForEmployee++
    }

    // optional: skip if no recordsForEmployee
  }

  return records
}

