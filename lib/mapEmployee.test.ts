import test from 'node:test'
import assert from 'node:assert/strict'

import { mapEmployee } from './mapEmployee.ts'

test('mapEmployee keeps start and 13th month dates from snake_case fields', () => {
  const employee = mapEmployee({
    employee_id: 1,
    source_employee_id: 'E-001',
    name: 'Jane Doe',
    department: 'Production',
    restaurant: 'Lakay Ago',
    pay_per_day: '500',
    status: 'active',
    contact_number: '09123456789',
    address: 'Main St',
    sss: '100',
    philhealth: '50',
    pagibig: '20',
    month_pay_13th: '2000',
    start_date: '2023-01-15',
    special_month_pay: '2024-01-15',
  })

  assert.equal(employee.start_date, '2023-01-15')
  assert.equal(employee.special_month_pay, '2024-01-15')
})

test('mapEmployee falls back to camelCase values and ignores blank strings', () => {
  const employee = mapEmployee({
    employee_id: 2,
    source_employee_id: 'E-002',
    name: 'John Smith',
    department: 'Kitchen',
    restaurant: 'Aroo',
    pay_per_day: '450',
    status: 'active',
    contact_number: '09987654321',
    address: 'Street 2',
    sss: '90',
    philhealth: '45',
    pagibig: '15',
    monthPay13th: '1800',
    start_date: '',
    special_month_pay: '',
    startDate: '2022-05-10',
    specialMonthPay: '2023-05-10',
  })

  assert.equal(employee.start_date, '2022-05-10')
  assert.equal(employee.special_month_pay, '2023-05-10')
})
