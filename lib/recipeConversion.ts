import { convertVolume, convertPureWeight, isSpoonUnit } from './unitConversions'

export interface Ingredient {
  ingredient_category: 'weight' | 'volume' | 'quantity' | null
  unit: string | null
  recipe_unit: string | null
  conversion_factor: number | null
}

export function convertRecipeQuantityToStockUnit(quantityInRecipeUnit: number, ingredient: Ingredient): number {
  const { ingredient_category, unit, recipe_unit, conversion_factor } = ingredient

  if (ingredient_category === 'quantity') {
    return quantityInRecipeUnit
  }

  if (ingredient_category === 'volume') {
    if (!recipe_unit) throw new Error('Missing recipe_unit for volume ingredient')
    if (!unit) throw new Error('Missing stock unit for volume ingredient')
    return convertVolume(quantityInRecipeUnit, recipe_unit as any, unit as any)
  }

  // weight
  if (ingredient_category === 'weight') {
    if (!recipe_unit) throw new Error('Missing recipe_unit for weight ingredient')
    if (!unit) throw new Error('Missing stock unit for weight ingredient')

    const recipeIsSpoon = isSpoonUnit(recipe_unit)
    const stockIsSpoon = isSpoonUnit(unit)

    if (!recipeIsSpoon && !stockIsSpoon) {
      return convertPureWeight(quantityInRecipeUnit as any, recipe_unit as any, unit as any)
    }

    if (conversion_factor == null) {
      throw new Error('Missing conversion_factor for ingredient using spoon units')
    }

    // conversion_factor = grams per 1 recipe_unit
    const grams = recipeIsSpoon ? quantityInRecipeUnit * conversion_factor : quantityInRecipeUnit

    if (stockIsSpoon) {
      return grams / conversion_factor
    }

    return convertPureWeight(grams, 'g', unit as any)
  }

  throw new Error('Unsupported ingredient category')
}

export default { convertRecipeQuantityToStockUnit }
