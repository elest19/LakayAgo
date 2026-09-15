import React from 'react'

interface Props {
  columns: number
  rows?: number
  message?: React.ReactNode
  messageClassName?: string
}

export default function CenteredEmptyRows({ columns, rows = 10, message = 'No records found.', messageClassName = 'text-sm text-slate-500' }: Props) {
  const mid = Math.floor(rows / 2)
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        i === mid ? (
          <tr key={`empty-msg-${i}`}>
            <td colSpan={columns} className={`py-12 text-center ${messageClassName}`}>
              {message}
            </td>
          </tr>
        ) : (
          <tr key={`empty-${i}`} className="invisible">
            {Array.from({ length: columns }).map((__, ci) => (
              <td key={ci} className="py-3 px-4">&nbsp;</td>
            ))}
          </tr>
        )
      ))}
    </>
  )
}
