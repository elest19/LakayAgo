import React, { useEffect, useState } from 'react'

interface ModalProps {
  open: boolean
  title?: React.ReactNode
  onClose: () => void
  children?: React.ReactNode
  className?: string
}

export default function Modal({ open, title, onClose, children, className = '' }: ModalProps) {
  const [mounted, setMounted] = useState(open)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) {
      setMounted(true)
      // allow mount to render then trigger show for animation
      requestAnimationFrame(() => setShow(true))
      window.addEventListener('keydown', onKey)
    } else {
      // play exit animation then unmount
      setShow(false)
      window.removeEventListener('keydown', onKey)
      const t = setTimeout(() => setMounted(false), 260)
      return () => clearTimeout(t)
    }
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!mounted) return null

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className={`absolute inset-0 bg-black/50 modal-backdrop ${show ? 'show' : ''}`} />

      <div
        className={`relative z-10 w-full max-w-3xl bg-white rounded-xl shadow-xl m-4 p-3 modal-content ${show ? 'show' : ''} ${className}`}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between mb-3">
            <div className="text-lg font-semibold text-slate-800">{title}</div>
            <button aria-label="Close" onClick={onClose} className="text-slate-400 hover:text-slate-600">
              ✕
            </button>
          </div>
        )}

        <div>{children}</div>
      </div>
    </div>
  )
}
