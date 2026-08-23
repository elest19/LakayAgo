import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { deriveAttendanceStatus, parseAttendanceReport } from '../src/utils/fingerprintAttendanceParser.ts'

const cases = [
  {
    label: 'weekday both valid',
    checkIn: '08:00',
    checkOut: '17:00',
    isWeekend: false,
    rawCheckIn: '08:00',
    rawCheckOut: '17:00',
    expected: 'present',
  },
  {
    label: 'weekday check-in only',
    checkIn: '08:00',
    checkOut: null,
    isWeekend: false,
    rawCheckIn: '08:00',
    rawCheckOut: '',
    expected: 'incomplete',
  },
  {
    label: 'weekday check-out only',
    checkIn: null,
    checkOut: '17:00',
    isWeekend: false,
    rawCheckIn: '',
    rawCheckOut: '17:00',
    expected: 'incomplete',
  },
  {
    label: 'weekday both missing',
    checkIn: null,
    checkOut: null,
    isWeekend: false,
    rawCheckIn: '',
    rawCheckOut: '',
    expected: 'absent',
  },
  {
    label: 'weekday explicit Absent',
    checkIn: null,
    checkOut: null,
    isWeekend: false,
    rawCheckIn: 'Absent',
    rawCheckOut: '',
    expected: 'absent',
  },
  {
    label: 'weekend both valid',
    checkIn: '08:00',
    checkOut: '12:00',
    isWeekend: true,
    rawCheckIn: '08:00',
    rawCheckOut: '12:00',
    expected: 'present',
  },
  {
    label: 'weekend check-in only',
    checkIn: '08:00',
    checkOut: null,
    isWeekend: true,
    rawCheckIn: '08:00',
    rawCheckOut: '',
    expected: 'incomplete',
  },
  {
    label: 'weekend check-out only',
    checkIn: null,
    checkOut: '12:00',
    isWeekend: true,
    rawCheckIn: '',
    rawCheckOut: '12:00',
    expected: 'incomplete',
  },
  {
    label: 'weekend both missing',
    checkIn: null,
    checkOut: null,
    isWeekend: true,
    rawCheckIn: '',
    rawCheckOut: '',
    expected: 'no_punch',
  },
  {
    label: 'weekend explicit Absent',
    checkIn: null,
    checkOut: null,
    isWeekend: true,
    rawCheckIn: 'Absent',
    rawCheckOut: '',
    expected: 'no_punch',
  },
] as const

for (const testCase of cases) {
  const actual = deriveAttendanceStatus(
    testCase.checkIn,
    testCase.checkOut,
    testCase.isWeekend,
    testCase.rawCheckIn,
    testCase.rawCheckOut,
  )

  assert.equal(actual, testCase.expected, `${testCase.label}: expected ${testCase.expected}, got ${actual}`)
  console.log(`${testCase.label}: check_in=${String(testCase.checkIn ?? 'null')} | check_out=${String(testCase.checkOut ?? 'null')} | status=${actual}`)
}

const workbook = XLSX.utils.book_new()
const sheet = XLSX.utils.aoa_to_sheet([
  ['Payroll Report', '2025-01-01 ~ 2025-01-31'],
  ['', '', '', '', '', '', '', '', '', 'EMP TEST', '', '', ''],
  ['', '', '', '', '', '', '', '', '', '1001', '', '', ''],
  ['', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['4 SAT', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['5 SUN', '', '', '', '', '', '', '', '', '', '08:00', '', ''],
])

XLSX.utils.book_append_sheet(workbook, sheet, '1.1')
const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
const records = await parseAttendanceReport(blob)

for (const record of records) {
  console.log(`parser output: ${record.date} ${record.weekday} | check_in=${record.check_in ?? 'null'} | check_out=${record.check_out ?? 'null'} | status=${record.status}`)
}

assert.ok(records.some(record => record.status === 'no_punch'))
assert.ok(records.some(record => record.status === 'incomplete'))

console.log('attendance status truth table test passed')
