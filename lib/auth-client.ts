import { createAuthClient } from 'better-auth/react'
import { usernameClient } from 'better-auth/client/plugins'

// Client-side auth client: prefer explicit public API URL, then app URL,
// then BETTER_AUTH_URL; if none is set, omit baseURL so requests go to
// the same origin (avoids CORS when backend is on the same domain).
const clientBase = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL

export const authClient = createAuthClient({
  ...(clientBase ? { baseURL: clientBase } : {}),
  fetchOptions: {
    // Ensure cookies are sent for session endpoints
    credentials: 'include',
  },
  plugins: [usernameClient()],
})

export default authClient
