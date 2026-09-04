import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const res = NextResponse.json({ ok: true })
    res.cookies.set('token', '', { httpOnly: true, path: '/', maxAge: 0 })
    return res
  } catch (err) {
    console.error('Logout error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function GET() {
  return POST()
}
