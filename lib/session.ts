import { auth } from './auth.ts'
import { normalizeRole, normalizeRestaurant, resolveEffectiveRestaurant } from './permissions'

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

    const role = normalizeRole((user as any).role) ?? ((user as any).role ?? null)
    const requestAppMode = req.headers.get('x-app-mode') || req.headers.get('X-App-Mode') || req.headers.get('app-mode')
    const restaurant = resolveEffectiveRestaurant((user as any).restaurant, requestAppMode)
      ?? normalizeRestaurant((user as any).restaurant)
      ?? ((user as any).restaurant ?? null)

    return {
      user_id: (user as any).user_id ?? (user as any).id ?? null,
      id: (user as any).id ?? (user as any).user_id ?? null,
      name: user.name ?? null,
      email: user.email ?? null,
      username: (user as any).username ?? null,
      role,
      restaurant,
    }
  } catch (err) {
    console.error('Better Auth session lookup failed', err)
    return null
  }
}

export default getSessionFromRequest
