import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lakay Ago',
  description: 'Lakay Ago restaurant operations dashboard',
  icons: {
    icon: '/logo.jpg',
    shortcut: '/logo.jpg',
    apple: '/logo.jpg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/logo.jpg" type="image/jpeg" />
        <link rel="apple-touch-icon" href="/logo.jpg" />
      </head>
      <body>{children}</body>
    </html>
  )
}
