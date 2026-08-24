import { useState } from 'react'
import { Lock, Mail } from 'lucide-react'
import { useApp } from '../App'

export default function LoginPage() {
  const { showToast, navigate, logoSrc } = useApp()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault()
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      showToast({ type: 'success', message: 'Logged in', description: `Welcome back, ${email.split('@')[0] || 'user'}` })
      navigate('dashboard')
    }, 700)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-slate-800">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl shadow-lg p-6">
        <div className="flex flex-col items-center text-center mb-6">
          <img src={logoSrc} alt="Brand logo" className="w-16 h-16 object-contain rounded-lg mb-3" />
          <h2 className="text-lg font-semibold text-slate-800">Sign in to your account</h2>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <div className="text-xs text-slate-500 mb-1">Email</div>
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
              <Mail size={14} className="text-slate-400" />
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.ph" className="flex-1 outline-none text-sm" />
            </div>
          </label>

          <label className="block">
            <div className="text-xs text-slate-500 mb-1">Password</div>
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
              <Lock size={14} className="text-slate-400" />
              <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password" className="flex-1 outline-none text-sm" />
            </div>
          </label>

          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-500 flex items-center gap-2">
              <input type="checkbox" className="w-3 h-3" />
              Remember me
            </label>
          </div>

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
