import test from 'node:test'
import assert from 'node:assert/strict'
import { getConversionFactorForRecipeUnit } from './unitConversions.ts'

test('accepts tablespoon as a weight recipe unit', () => {
  assert.doesNotThrow(() => getConversionFactorForRecipeUnit('weight', 'Tablespoon (tbsp)'))
  assert.equal(getConversionFactorForRecipeUnit('weight', 'Tablespoon (tbsp)'), 1)
})

test('accepts teaspoon as a weight recipe unit', () => {
  assert.doesNotThrow(() => getConversionFactorForRecipeUnit('weight', 'Teaspoon (tsp)'))
  assert.equal(getConversionFactorForRecipeUnit('weight', 'Teaspoon (tsp)'), 1 / 3)
})
