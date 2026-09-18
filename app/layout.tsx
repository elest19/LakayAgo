import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lakay Ago',
  description: 'Lakay Ago restaurant operations dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
