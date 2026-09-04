'use client'

import { useRef, useEffect, useState } from 'react'

interface TimePickerProps {
  value: string
  onChange: (value: string) => void
  label?: string
  disabled?: boolean
  placeholder?: string
}

export function TimePicker({ value, onChange, label, disabled, placeholder = 'HH:MM' }: TimePickerProps) {
  const [isOpen, setIsOpen] = useState<'hour' | 'minute' | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const [displayValue, setDisplayValue] = useState(value)

  useEffect(() => {
    setDisplayValue(value)
  }, [value])

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsOpen(null)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [isOpen])

  const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))
  const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'))

  const normalizeToHourMinute = (time: string | null | undefined) => {
    if (!time) return '08:00'
    const raw = String(time).trim()
    if (!raw) return '08:00'
    const [hourPart, minutePart] = raw.split(':')
    if (!hourPart || !minutePart) return '08:00'
    const hour = String(Number(hourPart)).padStart(2, '0')
    const minute = String(Number(minutePart)).padStart(2, '0')
    return `${hour}:${minute}`
  }

  const getParts = (time: string) => {
    if (!time) return { hour: '08', minute: '00' }
    // handle ISO datetime, AM/PM formats, or plain HH:MM
    let t = normalizeToHourMinute(time)
    if (t.includes('T')) {
      const part = t.split('T')[1]
      if (part) t = part
    }
    const [h, m] = t.split(':')
    return { hour: h?.padStart(2, '0') || '08', minute: (m || '00').padStart(2, '0') }
  }

  const parts = getParts(displayValue)

  const handleSelect = (part: 'hour' | 'minute', opt: string) => {
    const next = part === 'hour' ? `${opt}:${parts.minute}` : `${parts.hour}:${opt}`
    setDisplayValue(next)
    onChange(next)
    setIsOpen(null)
  }

  const renderColumn = (part: 'hour' | 'minute', options: string[], currentValue: string) => {
    const isColumnOpen = isOpen === part
    const current = part === 'hour' ? parts.hour : parts.minute

    return (
      <div className="relative flex-1">
        <div
          className={`border border-slate-200 bg-white rounded-lg px-3 py-2 text-sm text-slate-700 font-display cursor-pointer select-none text-center ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          onClick={e => {
            e.stopPropagation()
            if (!disabled) setIsOpen(isColumnOpen ? null : part)
          }}
        >
          {currentValue}
        </div>
        {isColumnOpen && (
          <div
            className="absolute z-50 mt-1 w-full border border-slate-200 bg-white rounded-lg shadow-lg overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="overflow-y-auto h-40">
              {options.map(opt => (
                <div
                  key={opt}
                  onClick={e => { e.stopPropagation(); handleSelect(part === 'hour' ? 'hour' : 'minute', opt) }}
                  className={`px-3 py-2 text-sm cursor-pointer font-display text-center ${opt === currentValue ? 'bg-indigo-100 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'}`}
                >
                  {opt}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`w-full ${disabled ? 'opacity-50' : ''}`} ref={pickerRef}>
      {label && <label className="block text-xs font-medium text-slate-600 mb-1 font-display">{label}</label>}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          {renderColumn('hour', HOUR_OPTIONS, parts.hour)}
        </div>
        <span className="text-slate-400 px-1">:</span>
        <div className="flex-1">
          {renderColumn('minute', MINUTE_OPTIONS, parts.minute)}
        </div>
      </div>
    </div>
  )
}