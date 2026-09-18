import { createAuthClient } from 'better-auth/react'
import { usernameClient } from 'better-auth/client/plugins'

// Client-side auth client: prefer the current browser origin so cookies are
// issued and read by the same host. Only fall back to explicit env URLs if the
// app is intentionally running behind a different public base URL.
const browserOrigin = typeof window !== 'undefined' ? window.location.origin : ''
const clientBase = browserOrigin || process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL

export const authClient = createAuthClient({
  ...(clientBase ? { baseURL: clientBase } : {}),
  fetchOptions: {
    // Ensure cookies are sent for session endpoints
    credentials: 'include',
  },
  plugins: [usernameClient()],
})

export default authClient
