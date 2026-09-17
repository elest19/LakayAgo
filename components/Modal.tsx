import React, { useEffect, useState, useRef, useCallback } from 'react'

interface ModalProps {
  open: boolean
  title?: React.ReactNode
  onClose: () => void
  children?: React.ReactNode
  className?: string
}

export default function Modal({
  open,
  title,
  onClose,
  children,
  className = '',
}: ModalProps) {
  const [mounted, setMounted] = useState(open)
  const [show, setShow] = useState(false)
  const [animateIn, setAnimateIn] = useState(false)
  const onCloseRef = useRef(onClose)
  const inTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const outTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCloseRef.current()
    }
  }, [])

  useEffect(() => {
    if (open) {
      setMounted(true)

      requestAnimationFrame(() => {
        setShow(true)
        setAnimateIn(true)
        if (inTimerRef.current) clearTimeout(inTimerRef.current)
        inTimerRef.current = setTimeout(() => setAnimateIn(false), 320)
      })

      window.addEventListener('keydown', handleKeyDown)
    } else {
      setShow(false)

      window.removeEventListener('keydown', handleKeyDown)

      if (inTimerRef.current) clearTimeout(inTimerRef.current)
      outTimerRef.current = setTimeout(() => {
        setMounted(false)
      }, 260)

      return () => {
        if (outTimerRef.current) clearTimeout(outTimerRef.current)
      }
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, handleKeyDown])

  if (!mounted) return null

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 modal-backdrop ${show ? 'show' : ''} ${animateIn ? 'animate-in' : ''}`}
      />

      {/* Modal */}
      <div
        className={`relative z-10 flex min-w-0 max-h-[90vh] flex-col overflow-hidden rounded-xl bg-white shadow-xl sm:max-w-2xl modal-content ${show ? 'show' : ''} ${animateIn ? 'animate-in' : ''} ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {title && (
          <div className="flex min-w-0 items-center justify-between gap-3 bg-indigo-600 border-b border-slate-100 px-3 pb-2 pt-3 sm:px-4 sm:pt-4">
            <div className="min-w-0 break-word whitespace-normal text-lg font-semibold text-white">
              {title}
            </div>

            <button
              type="button"
              aria-label="Close"
              onClick={() => onCloseRef.current()}
              className="shrink-0 text-slate-100 transition-colors hover:text-slate-300"
            >
              ✕
            </button>
          </div>
        )}

        {/* Content */}
        <div className="min-w-0 overflow-y-auto overscroll-contain px-3 pb-3 pt-1 sm:px-4">
          {children}
        </div>
      </div>
    </div>
  )
}