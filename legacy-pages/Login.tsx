'use client'
import { useState } from 'react'
import { Lock, User, Eye, EyeOff } from 'lucide-react'
import { useApp } from '../App'
import { authClient } from '../lib/auth-client'

export default function LoginPage() {
  const { showToast, navigate, logoSrc, setUser } = useApp()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setLoading(true)

    try {
      const result = await authClient.signIn.username({
        username,
        password,
      })

      if (result?.error) {
        throw new Error(result.error.message || 'Login failed')
      }

      const sessionUser = result?.data?.user ?? null
      const appUser = sessionUser ? { ...sessionUser, user_id: sessionUser.id, id: sessionUser.id } : null

      showToast({ type: 'success', message: 'Logged in', description: `Welcome back, ${appUser?.name || username || 'user'}` })
      try {
        if (setUser) setUser(appUser)
        ;(window as any).__app_set_user?.(appUser)
        ;(window as any).__app_show_mode_confirmation?.()
      } catch {}

      try {
        const params = new URLSearchParams(window.location.search)
        const redirect = params.get('redirect')
        const allowed = ['/','/dashboard','/employees','/attendance/records','/attendance/import','/attendance/import-history','/payroll/periods','/payroll/history','/payroll/process','/payroll/payslips','/leave-management','/sales-summary','/sales','/inventory/catalog','/inventory/production','/inventory/kitchen','/expenses','/reports','/settings','/audit-logs']
        if (redirect && allowed.includes(redirect)) {
          window.history.pushState({}, '', redirect)
          const page = (window as any).routePageMap?.[redirect] ?? 'dashboard'
          navigate(page)
          return
        }
      } catch (err) {}

      navigate('dashboard')
    } catch (err: any) {
      showToast({ type: 'error', message: err?.message || 'Login failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-slate-800">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl shadow-lg p-6">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex items-center gap-3 mb-3">
            <img src="/logo.jpg" alt="Lakay Ago logo" className="w-16 h-16 object-contain rounded-lg" />
            <img src="/Aroo_Logo.jpg" alt="Aroo logo" className="w-16 h-16 object-contain rounded-lg" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800">Sign in to your account</h2>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <div className="text-xs text-slate-500 mb-1">Username</div>
              <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
                <User size={14} className="text-slate-400" />
                <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" className="flex-1 outline-none text-sm" />
            </div>
          </label>

          <label className="block">
            <div className="text-xs text-slate-500 mb-1">Password</div>
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
              <Lock size={14} className="text-slate-400" />
              <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type={showPassword ? 'text' : 'password'} className="flex-1 outline-none text-sm" />
              <button type="button" onClick={() => setShowPassword(s => !s)} className="text-slate-400 hover:text-slate-600">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          {/* 
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-500 flex items-center gap-2">
              <input type="checkbox" className="w-3 h-3" />
              Remember me
            </label>
          </div>
          */}

          <div>
            <button type="submit" disabled={loading} className="w-full px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium">
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
