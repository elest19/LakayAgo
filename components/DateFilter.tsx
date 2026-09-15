'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export type DateFilterMode =
  | 'all'
  | 'today'
  | 'week'
  | 'month'
  | 'year'
  | 'custom_date'
  | 'custom_month'
  | 'custom_year'

export interface DateFilterValue {
  mode: DateFilterMode
  /** YYYY-MM-DD used by the Custom Date picker */
  date: string
  /** YYYY-MM used by the Custom Month picker */
  month: string
  /** full year used by the Custom Year picker */
  year: number
}

export const defaultDateFilterValue = (): DateFilterValue => ({
  mode: 'all',
  date: '',
  month: '',
  year: new Date().getFullYear(),
})

const pad2 = (n: number) => String(n).padStart(2, '0')

// Local-time YYYY-MM-DD key for any date-ish value; null when missing or invalid.
export const toLocalDateKey = (value: string | Date | null | undefined): string | null => {
  if (value === null || value === undefined || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

// Inclusive [start, end] local date keys for the selected mode.
// null means no filtering (the "All" option).
export function resolveDateRange(filter: DateFilterValue): { start: string; end: string } | null {
  const todayKey = toLocalDateKey(new Date())
  if (!todayKey) return null
  const [yearStr, monthStr] = todayKey.split('-')
  const yearNum = Number(yearStr)
  const monthNum = Number(monthStr)

  switch (filter.mode) {
    case 'today':
      return { start: todayKey, end: todayKey }
    case 'week': {
      const now = new Date()
      const offsetToMonday = (now.getDay() + 6) % 7 // Monday-based week
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offsetToMonday)
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
      const startKey = toLocalDateKey(start)
      const endKey = toLocalDateKey(end)
      return startKey && endKey ? { start: startKey, end: endKey } : null
    }
    case 'month':
      return {
        start: `${yearStr}-${monthStr}-01`,
        end: `${yearStr}-${monthStr}-${pad2(new Date(yearNum, monthNum, 0).getDate())}`,
      }
    case 'year':
      return { start: `${yearStr}-01-01`, end: `${yearStr}-12-31` }
    case 'custom_date': {
      const key = toLocalDateKey(filter.date)
      return key ? { start: key, end: key } : null
    }
    case 'custom_month': {
      if (!/^\d{4}-\d{2}$/.test(filter.month)) return null
      const [y, m] = filter.month.split('-').map(Number)
      if (!y || !m) return null
      return {
        start: `${filter.month}-01`,
        end: `${filter.month}-${pad2(new Date(y, m, 0).getDate())}`,
      }
    }
    case 'custom_year': {
      if (!Number.isInteger(filter.year) || filter.year < 1900 || filter.year > 2999) return null
      return { start: `${filter.year}-01-01`, end: `${filter.year}-12-31` }
    }
    default:
      return null
  }
}

// True when the row's date falls inside the resolved range.
// Always true when range is null (the "All" option) so nothing is hidden.
export function dateInRange(value: string | Date | null | undefined, range: { start: string; end: string } | null): boolean {
  if (!range) return true
  const key = toLocalDateKey(value)
  if (!key) return false
  return key >= range.start && key <= range.end
}

// --- Shared: close a popover when clicking outside its container ---
function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, onOutside])
}

const ChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-slate-400 shrink-0">
    <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface MonthPickerProps {
  /** YYYY-MM */
  value: string
  onChange: (next: string) => void
  minYear?: number
  maxYear?: number
  className?: string
}

function MonthPicker({ value, onChange, minYear = 2000, maxYear, className = '' }: MonthPickerProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  useClickOutside(containerRef, () => setOpen(false))

  const [selYear, selMonth] = useMemo(() => {
    const match = /^(\d{4})-(\d{2})$/.exec(value)
    if (match) return [Number(match[1]), Number(match[2])]
    const now = new Date()
    return [now.getFullYear(), now.getMonth() + 1]
  }, [value])

  const [viewYear, setViewYear] = useState(selYear)
  useEffect(() => {
    if (open) setViewYear(selYear)
  }, [open, selYear])

  const label = `${MONTH_LABELS[selMonth - 1]} ${selYear}`
  const canGoPrevYear = maxYear === undefined || viewYear - 1 >= minYear
  const canGoNextYear = maxYear === undefined || viewYear + 1 <= maxYear

  const pick = (monthIndex: number) => {
    onChange(`${viewYear}-${pad2(monthIndex + 1)}`)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 font-display text-slate-600 flex items-center justify-between gap-2"
      >
        <span>{label}</span>
        <ChevronDown />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white shadow-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              disabled={!canGoPrevYear}
              onClick={() => setViewYear(y => y - 1)}
              className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              ‹
            </button>
            <span className="text-sm font-medium text-slate-700 font-display">{viewYear}</span>
            <button
              type="button"
              disabled={!canGoNextYear}
              onClick={() => setViewYear(y => y + 1)}
              className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTH_LABELS.map((m, i) => {
              const isSelected = viewYear === selYear && i + 1 === selMonth
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => pick(i)}
                  className={`text-xs rounded-md py-1.5 font-display transition-colors ${
                    isSelected ? 'bg-indigo-500 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {m}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

interface YearPickerProps {
  value: number
  onChange: (next: number) => void
  minYear?: number
  maxYear: number
  className?: string
}

function YearPicker({ value, onChange, minYear = 2000, maxYear, className = '' }: YearPickerProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  useClickOutside(containerRef, () => setOpen(false))

  const decadeStart = useMemo(() => Math.floor(value / 10) * 10, [value])
  const [viewDecadeStart, setViewDecadeStart] = useState(decadeStart)
  useEffect(() => {
    if (open) setViewDecadeStart(decadeStart)
  }, [open, decadeStart])

  // 12-cell grid: one year of padding on each side of the decade for context.
  const years = useMemo(() => Array.from({ length: 12 }, (_, i) => viewDecadeStart - 1 + i), [viewDecadeStart])

  const pick = (year: number) => {
    if (year < minYear || year > maxYear) return
    onChange(year)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 font-display text-slate-600 flex items-center justify-between gap-2"
      >
        <span>{value}</span>
        <ChevronDown />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-48 rounded-lg border border-slate-200 bg-white shadow-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setViewDecadeStart(y => y - 10)}
              className="p-1 rounded hover:bg-slate-100 text-slate-500"
            >
              ‹
            </button>
            <span className="text-sm font-medium text-slate-700 font-display">{viewDecadeStart}s</span>
            <button
              type="button"
              onClick={() => setViewDecadeStart(y => y + 10)}
              className="p-1 rounded hover:bg-slate-100 text-slate-500"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {years.map(y => {
              const disabled = y < minYear || y > maxYear
              const isSelected = y === value
              return (
                <button
                  key={y}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(y)}
                  className={`text-xs rounded-md py-1.5 font-display transition-colors ${
                    isSelected
                      ? 'bg-indigo-500 text-white'
                      : disabled
                        ? 'text-slate-300 cursor-not-allowed'
                        : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {y}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

interface DateFilterProps {
  value: DateFilterValue
  onChange: (next: DateFilterValue) => void
  /** Label for the "all data" option, e.g. "All Sales" */
  allLabel?: string
  className?: string
  /** Extra classes for the select/picker controls (e.g. "w-full" inside grids) */
  controlClassName?: string
}

export default function DateFilter({ value, onChange, allLabel = 'All', className = '', controlClassName = '' }: DateFilterProps) {
  const currentYear = new Date().getFullYear()

  const yearOptions = useMemo(() => {
    const years: number[] = []
    for (let y = currentYear + 1; y >= 2000; y--) years.push(y)
    return years
  }, [currentYear])

  const selectClasses = 'border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 font-display text-slate-600'

  const changeMode = (mode: DateFilterMode) => {
    const todayKey = toLocalDateKey(new Date()) ?? ''
    const next: DateFilterValue = { ...value, mode }
    // Prefill the pickers so a freshly selected custom mode is immediately meaningful.
    if (mode === 'custom_date' && !value.date) next.date = todayKey
    if (mode === 'custom_month' && !/^\d{4}-\d{2}$/.test(value.month)) next.month = todayKey.slice(0, 7)
    if (mode === 'custom_year' && !yearOptions.includes(value.year)) next.year = currentYear
    onChange(next)
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <select
        value={value.mode}
        onChange={e => changeMode(e.target.value as DateFilterMode)}
        className={`${selectClasses} ${controlClassName}`}
      >
        <option value="all">{allLabel}</option>
        <option value="today">Today</option>
        <option value="week">This Week</option>
        <option value="month">This Month</option>
        <option value="year">This Year</option>
        <option value="custom_date">Custom Date</option>
        <option value="custom_month">Custom Month</option>
        <option value="custom_year">Custom Year</option>
      </select>

      {value.mode === 'custom_date' && (
        <input
          type="date"
          value={value.date}
          onChange={event => onChange({ ...value, date: event.target.value })}
          className={`${selectClasses} ${controlClassName}`}
        />
      )}

      {value.mode === 'custom_month' && (
        <MonthPicker
          value={value.month}
          onChange={month => onChange({ ...value, month })}
          minYear={2000}
          maxYear={currentYear + 1}
          className={controlClassName}
        />
      )}

      {value.mode === 'custom_year' && (
        <YearPicker
          value={value.year}
          onChange={year => onChange({ ...value, year })}
          minYear={2000}
          maxYear={currentYear + 1}
          className={controlClassName}
        />
      )}
    </div>
  )
}