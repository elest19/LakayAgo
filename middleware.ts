import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Allow configuring a comma-separated list of allowed origins via
// NEXT_PUBLIC_ALLOWED_ORIGINS. Example:
// NEXT_PUBLIC_ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
const allowedOrigins = (process.env.NEXT_PUBLIC_ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

export function middleware(req: NextRequest) {
  const { nextUrl, headers, method } = req
  const origin = headers.get('origin') || ''

  // Only apply CORS headers to auth endpoints (adjust path as needed)
  if (nextUrl.pathname.startsWith('/api/auth')) {
    const isAllowed = allowedOrigins.length === 0 ? false : allowedOrigins.includes(origin)

    // Preflight
    if (method === 'OPTIONS') {
      const res = NextResponse.json(null, { status: 204 })
      if (isAllowed) {
        res.headers.set('Access-Control-Allow-Origin', origin)
        res.headers.set('Vary', 'Origin')
      }
      res.headers.set('Access-Control-Allow-Credentials', 'true')
      res.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
      res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      return res
    }

    // For non-OPTIONS requests, pass through but attach CORS headers
    const res = NextResponse.next()
    if (isAllowed) {
      res.headers.set('Access-Control-Allow-Origin', origin)
      res.headers.set('Vary', 'Origin')
    }
    res.headers.set('Access-Control-Allow-Credentials', 'true')
    return res
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/auth/:path*'],
}
