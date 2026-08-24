import React, { useEffect, useState } from 'react'

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (open) {
      setMounted(true)

      // Allow the modal to mount before triggering the animation
      requestAnimationFrame(() => {
        setShow(true)
      })

      window.addEventListener('keydown', onKey)
    } else {
      // Play exit animation before unmounting
      setShow(false)

      window.removeEventListener('keydown', onKey)

      const t = setTimeout(() => {
        setMounted(false)
      }, 260)

      return () => clearTimeout(t)
    }

    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!mounted) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 modal-backdrop ${
          show ? 'show' : ''
        }`}
      />

      {/* Modal */}
      <div
        className={`relative z-10 flex min-w-0 max-h-[90vh] flex-col overflow-hidden rounded-xl bg-white shadow-xl sm:max-w-2xl modal-content ${show ? 'show' : ''} *:${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {title && (
          <div className="flex min-w-0 items-center justify-between gap-3 border-b border-slate-100 px-3 pb-2 pt-3 sm:px-4 sm:pt-4">
            <div className="min-w-0 break-words whitespace-normal text-lg font-semibold text-slate-800">
              {title}
            </div>

            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="shrink-0 text-slate-400 transition-colors hover:text-slate-600"
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