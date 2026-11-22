export const LOCATIONS = [
  'Warehouse',
  'Lakay Ago',
  'Aroo',
  'Pasalubong Center',
  'Food Cart',
] as const

export type Location = (typeof LOCATIONS)[number]

export function isLocation(value: unknown): value is Location {
  return typeof value === 'string' && (LOCATIONS as readonly string[]).includes(value)
}
