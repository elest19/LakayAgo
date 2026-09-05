import { NextResponse } from 'next/server'
import getSessionFromRequest from '../../../lib/session'
import { logAudit } from '../../../lib/audit'
import { query, getClient } from '../../../lib/db'

type IncomingRecord = {
  employeeId: string
  employeeName: string
  date: string
  timeIn?: string | null
  timeOut?: string | null
  firstOnDuty?: string | null
  firstOffDuty?: string | null
  secondOnDuty?: string | null
  secondOffDuty?: string | null
  lateMinutes?: number
  undertimeMinutes?: number
  overtimeHours?: number
  status?: string
  period_id?: string | number | null
  late_minutes?: number
  leave_early_minutes?: number
  overtime_minutes?: number
  is_halfday?: boolean
  is_absent?: boolean
  on_leave?: boolean
}

export async function GET(req: Request) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const qEmployee = url.searchParams.get('employee_id')
    const qFrom = url.searchParams.get('from')
    const qTo = url.searchParams.get('to')

    const params: any[] = []
    let where: string[] = []
    if (session.role !== 'SuperAdmin') {
      params.push(session.restaurant)
      where.push(`restaurant = $${params.length}`)
    } else {
      const qRestaurant = url.searchParams.get('restaurant')
      if (qRestaurant) {
        params.push(qRestaurant)
        where.push(`restaurant = $${params.length}`)
      }
    }

    if (qEmployee) { params.push(Number(qEmployee)); where.push(`employee_id = $${params.length}`) }
    if (qFrom) { params.push(qFrom); where.push(`work_date >= $${params.length}`) }
    if (qTo) { params.push(qTo); where.push(`work_date <= $${params.length}`) }

    const text = `select * from attendance ${where.length ? 'where ' + where.join(' and ') : ''} order by work_date desc`
    const { rows } = await query(text, params)
    const attendance = rows.map((row: any) => ({
      ...row,
      work_date: normalizeDateOnly(row.work_date),
    }))
    return NextResponse.json({ attendance })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

function emptyToNull(v: unknown): string | null {
    if (v === null || v === undefined) return null
    const s = String(v).trim()
    return s === '' ? null : s
  }

  function normalizeDateOnly(value: unknown): string {
    if (value === null || value === undefined) return ''
    if (value instanceof Date) {
      const year = value.getFullYear()
      const month = String(value.getMonth() + 1).padStart(2, '0')
      const day = String(value.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    const raw = String(value).trim()
    if (!raw) return ''

    const base = raw.split(/[T\s]/)[0]
    const match = base.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    if (match) {
      return `${match[1]}-${String(Number(match[2])).padStart(2, '0')}-${String(Number(match[3])).padStart(2, '0')}`
    }

    const fallback = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (fallback) {
      return `${fallback[1]}-${String(Number(fallback[2])).padStart(2, '0')}-${String(Number(fallback[3])).padStart(2, '0')}`
    }

    throw new Error(`Invalid date value: ${value}`)
  }
  const BATCH_SIZE = 300

export async function POST(req: Request) {
  try {
    const session = getSessionFromRequest(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 
    const body = await req.json()
    const records: IncomingRecord[] = body.records
    if (!records || !Array.isArray(records)) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    const periodId: string | null = body.periodId ? String(body.periodId) : null

    
 
    let restaurantValue: string | null = body.restaurant ? String(body.restaurant) : null
    if (!restaurantValue) {
      restaurantValue = session.restaurant && session.restaurant !== 'Both' ? session.restaurant : null
    }
    if (!restaurantValue) {
      return NextResponse.json({ error: 'Restaurant context required' }, { status: 403 })
}
  
    const client = await getClient()
    try {
      await client.query('begin')
 
      // ---- 1. Load all employees for this restaurant ONCE ----
      const empRes = restaurantValue === 'Both'
        ? await client.query('select * from employees')
        : await client.query('select * from employees where restaurant = $1', [restaurantValue])


      const employeeBySourceId = new Map<string, any>()
      for (const emp of empRes.rows) {
        const status = String(emp.status ?? '').trim().toLowerCase()
        if (status !== 'active') continue
        employeeBySourceId.set(String(emp.source_employee_id), emp)
      }
 
      // ---- 2. Load all report periods for this restaurant ONCE ----
      const rpRes = restaurantValue === 'Both'
        ? await client.query('select * from report_periods')
        : await client.query('select * from report_periods where restaurant = $1', [restaurantValue])
      const periods = rpRes.rows as { report_period_id: any; period_start: string; period_end: string }[]
      const findPeriodId = (date: string) => {
        const p = periods.find(p => p.period_start <= date && p.period_end >= date)
        return p ? p.report_period_id : null
      }
 
      // ---- 3. Validate every employee id, and that every employee already exists ----
      const notFound: { employeeId: string; employeeName?: string }[] = []
      for (const r of records) {
        const srcIdNum = Number(r.employeeId)
        if (!Number.isFinite(srcIdNum)) {
          await client.query('rollback')
          return NextResponse.json({ error: `Invalid employee id: ${r.employeeId}` }, { status: 400 })
        }
        if (!employeeBySourceId.has(String(srcIdNum))) {
          notFound.push({ employeeId: r.employeeId, employeeName: r.employeeName })
        }
      }
 
      if (notFound.length > 0) {
        await client.query('rollback')
        // de-duplicate by employeeId in case the same missing employee appears on multiple rows
        const uniqueMissing = [...new Map(notFound.map(e => [e.employeeId, e])).values()]
        return NextResponse.json(
          {
            error: 'Some employees in the file were not found in the database',
            missingEmployees: uniqueMissing,
          },
          { status: 400 }
        )
      }
 
      // ---- 4. Build all attendance rows in memory ----
      type Row = { values: any[]; key: string }
      const rows: Row[] = []
      const seenRowKeys = new Map<string, { employeeId: string; date: string }>()
 
      for (const r of records) {
        const srcIdNum = Number(r.employeeId)
        const employee = employeeBySourceId.get(String(srcIdNum))
        const workDate = normalizeDateOnly(r.date)
        // employee is guaranteed to exist here — step 3 already validated this
 
        let totalMinutes = 0
        if (r.firstOnDuty && r.firstOffDuty) {
          const [h1, m1] = String(r.firstOnDuty).split(':').map(Number)
          const [h2, m2] = String(r.firstOffDuty).split(':').map(Number)
          if (Number.isFinite(h1) && Number.isFinite(h2)) {
            totalMinutes = (h2 * 60 + (m2 || 0)) - (h1 * 60 + (m1 || 0))
            if (totalMinutes < 0) totalMinutes += 24 * 60 // overnight shift
          }
        }
 
        const key = `${employee.employee_id}|${workDate}`
        if (seenRowKeys.has(key)) {
          await client.query('rollback')
          return NextResponse.json({
            error: `Duplicate attendance row detected for employee ${employee.employee_id} on ${workDate}. Each employee/date must appear only once before import.`,
          }, { status: 409 })
        }
        seenRowKeys.set(key, { employeeId: employee.employee_id, date: workDate })
 
        // The grace period has already been applied on the frontend, so this
        // only floors at 0 / rounds. (Removed the server-side grace subtraction to avoid double-applying.)
        const lateMinutesToStore = Math.max(0, Math.round(Number(r.late_minutes ?? r.lateMinutes ?? 0) || 0))
        // period_id comes pre-computed from the selected payroll period; fall back to per-date lookup
        const periodId = r.period_id ?? findPeriodId(r.date)
        const leaveEarlyMinutes = Math.max(0, Math.round(Number(r.leave_early_minutes ?? r.undertimeMinutes ?? 0) || 0))
        const overtimeMinutes = Math.max(0, Math.round(Number(r.overtime_minutes ?? 0) || 0))
        const isHalfday = r.is_halfday === true
        const isOnLeave = typeof r.on_leave === 'boolean' ? r.on_leave : false
        const isAbsent = (typeof r.is_absent === 'boolean' ? r.is_absent : (r.status ?? '').toLowerCase() === 'absent') && !isOnLeave

        rows.push({
          key,
          values: [
            restaurantValue,
            employee.employee_id,
            periodId,
            workDate,
            emptyToNull(r.firstOnDuty ?? r.timeIn),
            emptyToNull(r.firstOffDuty ?? r.timeOut),
            emptyToNull(r.secondOnDuty),
            emptyToNull(r.secondOffDuty),
            lateMinutesToStore,
            leaveEarlyMinutes,
            totalMinutes,
            isAbsent,
            isOnLeave,
            overtimeMinutes,
            isHalfday,
          ],
        })
      }
 
      // ---- 5. Bulk upsert in chunks ----
      const insertedRows: any[] = []
      
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const chunk = rows.slice(i, i + BATCH_SIZE)
        if (chunk.length === 0) continue
 
        const params: any[] = []
        const valueRows = chunk.map(row => {
          const placeholders = row.values.map(v => {
            params.push(v)
            return `$${params.length}`
          })
          return `(${placeholders.join(', ')}, now(), now())`
        })
 
        const upsertSql = `
          insert into attendance(
            restaurant, employee_id, period_id, work_date,
            first_on_duty, first_off_duty, second_on_duty, second_off_duty,
            late_minutes, leave_early_minutes, total_minutes, is_absent, on_leave, overtime_minutes, is_halfday,
            created_at, updated_at
          )
          values ${valueRows.join(', ')}
          on conflict (employee_id, work_date) do update set
            first_on_duty = excluded.first_on_duty,
            first_off_duty = excluded.first_off_duty,
            second_on_duty = excluded.second_on_duty,
            second_off_duty = excluded.second_off_duty,
            late_minutes = excluded.late_minutes,
            leave_early_minutes = excluded.leave_early_minutes,
            total_minutes = excluded.total_minutes,
            is_absent = excluded.is_absent,
            on_leave = excluded.on_leave,
            overtime_minutes = excluded.overtime_minutes,
            is_halfday = excluded.is_halfday,
            updated_at = now()
          returning *
        `
        const res = await client.query(upsertSql, params)
        insertedRows.push(...res.rows)
      }

      

      if (rows.length > 0) {
        const expectedAbsentByKey = new Map<string, boolean>()
        for (const row of rows) {
          const [employeeId, workDate] = row.key.split('|')
          expectedAbsentByKey.set(`${employeeId}|${workDate}`, Boolean(row.values[11]))
        }

        const keys = [...expectedAbsentByKey.keys()]
        const verifyParams: any[] = []
        const verifyPlaceholders = keys.map((key) => {
          const [employeeId, workDate] = key.split('|')
          const pairStartIndex = verifyParams.length + 1
          verifyParams.push(Number(employeeId), workDate)
          return `(${Array.from({ length: 2 }, (_, index) => `$${pairStartIndex + index}`).join(', ')})`
        })

        const verifySql = `
          select employee_id, to_char(work_date, 'YYYY-MM-DD') as work_date, is_absent
          from attendance
          where (employee_id, work_date) in (${verifyPlaceholders.join(', ')})
        `

        const verifyRes = await client.query(verifySql, verifyParams)
        const mismatches = verifyRes.rows.filter((row: any) => {
          const savedWorkDate = normalizeDateOnly(row.work_date)
          const expected = expectedAbsentByKey.get(`${row.employee_id}|${savedWorkDate}`)
          return expected !== Boolean(row.is_absent)
        })

        if (mismatches.length > 0) {
          console.error('Attendance import mismatch: validated is_absent != saved is_absent', mismatches.map((row: any) => ({
            employee_id: row.employee_id,
            work_date: normalizeDateOnly(row.work_date),
            is_absent: Boolean(row.is_absent),
            expected: expectedAbsentByKey.get(`${row.employee_id}|${normalizeDateOnly(row.work_date)}`),
          })))
          await client.query('rollback')
          return NextResponse.json({
            error: 'Attendance import validation mismatch detected.',
            mismatches: mismatches.map((row: any) => ({
              employee_id: row.employee_id,
              work_date: normalizeDateOnly(row.work_date),
              expected: expectedAbsentByKey.get(`${row.employee_id}|${normalizeDateOnly(row.work_date)}`),
              saved: Boolean(row.is_absent),
            })),
          }, { status: 500 })
        }
      }

      // ---- 6. Update the selected report period's source_file ----
      if (periodId) {
        const rp = await client.query('select * from report_periods where report_period_id = $1', [periodId])
        const period = rp.rows[0]
        if (period) {
          const fmtDate = (d: any) => {
            if (!d) return ''
            if (d instanceof Date) {
              const y = d.getFullYear()
              const m = String(d.getMonth() + 1).padStart(2, '0')
              const day = String(d.getDate()).padStart(2, '0')
              return `${y}-${m}-${day}`
            }
            const s = String(d)
            const m = s.match(/^\d{4}-\d{2}-\d{2}/)
            return m ? m[0] : s
          }
          const sourceFile = `${fmtDate(period.period_start)}-to-${fmtDate(period.period_end)}_Attendance_${restaurantValue}`
          await client.query('update report_periods set source_file = $1 where report_period_id = $2', [sourceFile, periodId])
          if (period.status === 'Pending') {
            await client.query('update report_periods set status = $1 where report_period_id = $2', ['Under Review', periodId])
          }
        }
      }

      await client.query('commit')
 
      logAudit({
        user_id: session.user_id,
        restaurant: restaurantValue,
        action: 'import_attendance',
        table_name: 'attendance',
        new_data: { count: insertedRows.length },
      })
 
      return NextResponse.json({ inserted: insertedRows })
    } catch (err) {
      await client.query('rollback')
      console.error('Attendance import error', err)
      return NextResponse.json({ error: 'Server error' }, { status: 500 })
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('Attendance import outer error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
