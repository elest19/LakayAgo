import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ChevronDown } from "lucide-react"

export interface SearchableSelectOption {
  value: string
  label: string
}

type Props = {
  value: string
  options: SearchableSelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  /** classes for the wrapper (e.g. flex-1) */
  className?: string
  /** classes for the input itself (border, padding, colors) */
  inputClassName?: string
  emptyMessage?: string
  ariaLabel?: string
}

// Typeable select: focusing or clicking the field shows the full option list, and
// typing a letter filters it down to the labels containing that text. The option
// list is rendered in a portal so it is never clipped by a modal's scroll container.
export default function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = "Select an option",
  disabled = false,
  className = "",
  inputClassName = "",
  emptyMessage = "No matching options",
  ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })

  const selectedLabel = options.find(o => o.value === value)?.label || ""

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options // nothing typed -> show the full list
    return options.filter(o => o.label.toLowerCase().includes(q))
  }, [options, query])

  const reposition = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
  }, [])

  useLayoutEffect(() => { if (open) reposition() }, [open, reposition])

  // close when the field becomes disabled
  useEffect(() => { if (disabled && open) { setOpen(false); setQuery("") } }, [disabled, open])

  // reposition on scroll/resize while open, and close on an outside mousedown
  useEffect(() => {
    if (!open) return
    const update = () => reposition()
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (wrapRef.current?.contains(target)) return
      if (target.closest("[data-searchable-select-option]")) return
      setOpen(false)
      setQuery("")
    }
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    document.addEventListener("mousedown", onDocMouseDown)
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
      document.removeEventListener("mousedown", onDocMouseDown)
    }
  }, [open, reposition])

  // keep the keyboard cursor on the first match while the user types
  useEffect(() => { setHighlight(0) }, [query])

  const close = () => { setOpen(false); setQuery("") }

  const commit = (option?: SearchableSelectOption) => {
    if (!option) return
    onChange(option.value)
    close()
  }

  const handleKeyDown = (e: any) => {
    if (disabled) return
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      if (!open) { setOpen(true); return }
      if (filtered.length === 0) return
      const delta = e.key === "ArrowDown" ? 1 : -1
      setHighlight(prev => (prev + delta + filtered.length) % filtered.length)
      return
    }
    if (e.key === "Enter") {
      if (!open) return
      e.preventDefault()
      commit(filtered[highlight] || filtered[0])
      return
    }
    if (e.key === "Escape" || e.key === "Tab") close()
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-label={ariaLabel || placeholder}
        disabled={disabled}
        value={open ? query : selectedLabel}
        placeholder={open && selectedLabel ? selectedLabel : placeholder}
        onFocus={() => { if (!disabled) setOpen(true) }}
        onChange={e => { if (disabled) return; setOpen(true); setQuery(e.target.value) }}
        onKeyDown={handleKeyDown}
        className={`w-full pr-7 ${disabled ? "cursor-not-allowed" : ""} ${inputClassName}`}
      />
      <ChevronDown size={12} className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 ${disabled ? "text-slate-300" : "text-slate-400"}`} />

      {open && !disabled && createPortal(
        <div
          data-searchable-select-option
          style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="bg-white border border-slate-200 rounded-lg shadow-md max-h-48 overflow-y-auto"
        >
          <ul>
            {filtered.map(o => {
              const isHighlighted = filtered.indexOf(o) === highlight
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => commit(o)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${isHighlighted ? "bg-indigo-50 text-indigo-700" : "text-slate-700"} ${o.value === value ? "font-medium" : ""}`}
                  >{o.label}</button>
                </li>
              )
            })}
            {filtered.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">{emptyMessage}</li>}
          </ul>
        </div>,
        document.body
      )}
    </div>
  )
}