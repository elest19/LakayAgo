import { createClient } from '@supabase/supabase-js'

let _supabase: any = null
export function getSupabaseServer() {
  if (_supabase) return _supabase
  const url = process.env.SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRole) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
  _supabase = createClient(url, serviceRole, { auth: { persistSession: false } })
  return _supabase
}

// Provide a lazy proxy as the default export so existing code can call
// `supabaseServer.from(...)` without triggering a missing-env throw at module init.
const supabaseServer: any = new Proxy(() => getSupabaseServer(), {
  get(_target, prop) {
    try {
      const client = getSupabaseServer()
      return (client as any)[prop]
    } catch (err) {
      // If env is missing, return a noop function to avoid crashes during build-time analysis.
      return () => { throw err }
    }
  },
  apply(_target, thisArg, args) {
    const client = getSupabaseServer()
    return (client as any).apply(thisArg, args)
  }
})

export default supabaseServer
