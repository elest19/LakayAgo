export type AppRole = 'Admin' | 'Staff'
export type RestaurantScope = 'Lakay Ago' | 'Aroo' | 'Both'
export type ActiveRestaurant = 'Lakay Ago' | 'Aroo'

export const ADMIN_ROLE: AppRole = 'Admin'
export const STAFF_ROLE: AppRole = 'Staff'

export function normalizeRole(role: unknown): AppRole | null {
  const value = typeof role === 'string' ? role.trim() : ''
  if (!value) return null

  const normalized = value.toLowerCase()
  if (normalized === 'superadmin' || normalized === 'super admin') return 'Admin'
  if (normalized === 'admin') return 'Admin'
  if (normalized === 'staff') return 'Staff'
  return null
}

export function normalizeRestaurant(value: unknown): RestaurantScope | null {
  const candidate = typeof value === 'string' ? value.trim() : ''
  if (!candidate || candidate === 'null') return null

  if (candidate === 'Lakay Ago' || candidate === 'Aroo' || candidate === 'Both') {
    return candidate
  }

  return null
}

export function normalizeAppMode(value: unknown): 'Lakay Ago' | 'Aroo' | null {
  const candidate = typeof value === 'string' ? value.trim() : ''
  if (!candidate) return null

  const normalized = candidate.toLowerCase()
  if (normalized === 'lakay ago' || normalized === 'lakayago' || normalized === 'lakay_ago' || normalized === 'lakayago') return 'Lakay Ago'
  if (normalized === 'aroo') return 'Aroo'
  return null
}

export function requireRole(
  session: { role?: string | null } | null,
  allowedRoles: AppRole[]
): { ok: true; role: AppRole } | { ok: false; status: 401 | 403; error: string } {
  if (!session || !session.role) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }

  const role = normalizeRole(session.role)
  if (!role) {
    return { ok: false, status: 403, error: 'Forbidden' }
  }

  if (!allowedRoles.includes(role)) {
    return { ok: false, status: 403, error: 'Forbidden' }
  }

  return { ok: true, role }
}

export function resolveEffectiveRestaurant(
  sessionRestaurant: string | null | undefined,
  appModeFromRequest?: string | null,
): ActiveRestaurant | null {
  const restaurant = normalizeRestaurant(sessionRestaurant)
  if (restaurant === 'Lakay Ago' || restaurant === 'Aroo') {
    return restaurant
  }

  if (restaurant === 'Both') {
    return normalizeAppMode(appModeFromRequest) ?? 'Lakay Ago'
  }

  return null
}

export function getRestaurantScope(
  session: { restaurant?: string | null } | null,
  appModeFromRequest?: string | null,
): { ok: true; restaurant: ActiveRestaurant } | { ok: false; status: 400 | 401 | 403; error: string } {
  if (!session || !session.restaurant) {
    return { ok: false, status: 401, error: 'Unauthorized' }
  }

  const restaurant = resolveEffectiveRestaurant(session.restaurant, appModeFromRequest)
  if (!restaurant) {
    return { ok: false, status: 403, error: 'Forbidden' }
  }

  return { ok: true, restaurant }
}
