import { createAuthClient } from 'better-auth/react'
import { usernameClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || 'http://localhost:8443',
  fetchOptions: {
    credentials: 'include',
  },
  plugins: [usernameClient()],
})

export default authClient
