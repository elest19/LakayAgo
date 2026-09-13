export const VOLUME_UNITS = ['Teaspoon (tsp)', 'Tablespoon (tbsp)', 'Cup', 'Fluid Ounce (fl_oz)', 'Milliliter (ml)', 'Liter (l)'] as const
export type VolumeUnit = typeof VOLUME_UNITS[number]

export const WEIGHT_UNITS = ['Gram (g)', 'Kilogram (kg)', 'Ounce (oz)', 'Pound (lb)', 'Tablespoon (tbsp)', 'Teaspoon (tsp)', 'Cup (cup)'] as const
export type WeightUnit = typeof WEIGHT_UNITS[number]

const VOLUME_TO_TBSP: Record<string, number> = {
  tsp: 1 / 3,
  tbsp: 1,
  cup: 16,
  fl_oz: 2,
  ml: 1 / 14.7868,
  l: 67.628,
  'Teaspoon (tsp)': 1 / 3,
  'Tablespoon (tbsp)': 1,
  Cup: 16,
  'Fluid Ounce (fl_oz)': 2,
  'Milliliter (ml)': 1 / 14.7868,
  'Liter (l)': 67.628,
}

const WEIGHT_TO_G: Record<string, number> = {
  'Gram (g)': 1,
  'Kilogram (kg)': 1000,
  'Ounce (oz)': 28.3495,
  'Pound (lb)': 453.592,
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
}

const UNIT_ALIASES: Record<string, string> = {
  g: 'Gram (g)',
  kg: 'Kilogram (kg)',
  oz: 'Ounce (oz)',
  lb: 'Pound (lb)',
  tsp: 'Teaspoon (tsp)',
  tbsp: 'Tablespoon (tbsp)',
  cup: 'Cup',
  fl_oz: 'Fluid Ounce (fl_oz)',
  ml: 'Milliliter (ml)',
  l: 'Liter (l)',
}

export function normalizeUnitName(unit: string | null | undefined): string | null {
  if (unit == null) return null
  const value = String(unit).trim()
  if (!value) return null
  return fullUnitName(value)
}

export function convertVolume(value: number, from: VolumeUnit | string, to: VolumeUnit | string): number {
  const normalizedFrom = normalizeUnitName(from)
  const normalizedTo = normalizeUnitName(to)
  if (!normalizedFrom || !normalizedTo) throw new Error(`Unsupported volume unit conversion: ${String(from)} -> ${String(to)}`)
  const inTbsp = value * (VOLUME_TO_TBSP as any)[normalizedFrom]
  if (!Number.isFinite(inTbsp)) throw new Error(`Unsupported volume unit conversion: ${String(from)} -> ${String(to)}`)
  return inTbsp / (VOLUME_TO_TBSP as any)[normalizedTo]
}

export function convertPureWeight(value: number, from: 'Gram (g)' | 'Kilogram (kg)' | 'Ounce (oz)' | 'Pound (lb)' | 'g' | 'kg' | 'oz' | 'lb', to: 'Gram (g)' | 'Kilogram (kg)' | 'Ounce (oz)' | 'Pound (lb)' | 'g' | 'kg' | 'oz' | 'lb'): number {
  const normalizedFrom = normalizeUnitName(from)
  const normalizedTo = normalizeUnitName(to)
  if (!normalizedFrom || !normalizedTo) throw new Error(`Unsupported weight unit conversion: ${String(from)} -> ${String(to)}`)
  const inGrams = value * (WEIGHT_TO_G as any)[normalizedFrom]
  if (!Number.isFinite(inGrams)) throw new Error(`Unsupported weight unit conversion: ${String(from)} -> ${String(to)}`)
  return inGrams / (WEIGHT_TO_G as any)[normalizedTo]
}

export function getConversionFactorForRecipeUnit(category: string | null | undefined, recipeUnit: string | null | undefined): number | null {
  const normalizedCategory = String(category ?? '').trim().toLowerCase()
  if (!recipeUnit) return null

  const normalizedUnit = normalizeUnitName(recipeUnit)
  if (!normalizedUnit) return null

  if (normalizedCategory === 'quantity') return 1

  if (normalizedCategory === 'weight') {
    const weightFactors: Record<string, number> = {
      'Gram (g)': 1,
      'Kilogram (kg)': 1000,
      'Ounce (oz)': 28.3495,
      'Pound (lb)': 453.592,
    }
    if (!(normalizedUnit in weightFactors)) {
      throw new Error(`Unsupported weight recipe unit: ${recipeUnit}`)
    }
    return weightFactors[normalizedUnit]
  }

  if (normalizedCategory === 'volume') {
    const volumeFactors: Record<string, number> = {
      'Teaspoon (tsp)': 1 / 3,
      'Tablespoon (tbsp)': 1,
      Cup: 16,
      'Fluid Ounce (fl_oz)': 2,
      'Milliliter (ml)': 1 / 14.7868,
      'Liter (l)': 67.628,
    }
    if (!(normalizedUnit in volumeFactors)) {
      throw new Error(`Unsupported volume recipe unit: ${recipeUnit}`)
    }
    return volumeFactors[normalizedUnit]
  }

  return null
}

export function isSpoonUnit(unit: string): unit is 'Tablespoon (tbsp)' | 'Teaspoon (tsp)' | 'Cup (cup)' | 'tbsp' | 'tsp' | 'cup' {
  return unit === 'Tablespoon (tbsp)' || unit === 'Teaspoon (tsp)' || unit === 'Cup (cup)' || unit === 'tbsp' || unit === 'tsp' || unit === 'cup'
}

export function isCupUnit(unit: string): unit is 'Cup (cup)' | 'cup' {
  return unit === 'Cup (cup)' || unit === 'cup'
}

const UNIT_FULL: Record<string, string> = {}
for (const u of [...VOLUME_UNITS, ...WEIGHT_UNITS]) {
  const match = u.match(/\(([^)]*)\)$/)
  UNIT_FULL[u] = u
  if (match) {
    UNIT_FULL[match[1].trim()] = u
    UNIT_FULL[match[1].trim().toLowerCase()] = u
  }
  UNIT_FULL[u.toLowerCase()] = u
}
for (const [alias, canonical] of Object.entries(UNIT_ALIASES)) {
  UNIT_FULL[alias] = canonical
  UNIT_FULL[alias.toLowerCase()] = canonical
}

export function fullUnitName(unit: string): string {
  if (!unit) return unit
  const value = String(unit).trim()
  return UNIT_FULL[value] || UNIT_FULL[value.toLowerCase()] || value
}

export default {
  VOLUME_UNITS,
  WEIGHT_UNITS,
  convertVolume,
  convertPureWeight,
  isSpoonUnit,
  fullUnitName,
}
