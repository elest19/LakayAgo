import { auth } from './auth.ts'

export type AppSessionUser = {
  user_id: string | null
  id: string | null
  name: string | null
  email: string | null
  username: string | null
  role: string | null
  restaurant: string | null
}

export async function getSessionFromRequest(req: Request): Promise<AppSessionUser | null> {
  try {
    const session = await auth.api.getSession({ headers: req.headers as Headers })
    const user = session?.user
    if (!user) return null

    return {
      user_id: (user as any).user_id ?? (user as any).id ?? null,
      id: (user as any).id ?? (user as any).user_id ?? null,
      name: user.name ?? null,
      email: user.email ?? null,
      username: (user as any).username ?? null,
      role: (user as any).role ?? null,
      restaurant: (user as any).restaurant ?? null,
    }
  } catch (err) {
    console.error('Better Auth session lookup failed', err)
    return null
  }
}

export default getSessionFromRequest
