import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const DEFAULT_PAGE_SIZE = 10

type Props = {
  items: any[]
  page: number
  setPage: (value: number | ((prev: number) => number)) => void
  pageSize?: number
}

export default function PaginationFooter({ items, page, setPage, pageSize = DEFAULT_PAGE_SIZE }: Props) {
  const totalPages = Math.max(1, Math.ceil((items?.length || 0) / pageSize))
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-white rounded-b-xl">
      <p className="text-xs text-slate-500">Showing {items.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, items.length)} of {items.length} items</p>
      <div className="flex items-center gap-1">
        <button onClick={() => setPage((p: number) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40"><ChevronLeft size={16} /></button>
        {Array.from({ length: totalPages }, (_, i) => {
          const p = i + 1
          const show = p === 1 || p === totalPages || Math.abs(p - page) <= 2
          if (!show) {
            if (i === 1 || i === totalPages - 2) return <span key={p} className="px-1 text-slate-400">…</span>
            return null
          }
          return (
            <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 rounded-lg text-xs font-medium font-display ${page === p ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
              {p}
            </button>
          )
        })}
        <button onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40"><ChevronRight size={16} /></button>
      </div>
    </div>
  )
}
