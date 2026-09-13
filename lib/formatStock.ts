function unitAbbrev(unit: string | undefined | null): string {
  if (!unit) return ''
  const match = unit.match(/\(([^)]*)\)$/)
  return match ? match[1].trim() : unit
}

export function formatStockReadable(stock: number, unit: string | undefined | null): string {
  if (!unit) return String(stock)
  const abbrev = unitAbbrev(unit)
  if (abbrev === 'kg') {
    const whole = Math.floor(stock)
    const grams = Math.round((stock - whole) * 1000)
    return grams > 0 ? `${whole} kg ${grams} g` : `${whole} kg`
  }
  if (abbrev === 'l') {
    const whole = Math.floor(stock)
    const ml = Math.round((stock - whole) * 1000)
    return ml > 0 ? `${whole} L ${ml} ml` : `${whole} L`
  }
  return `${Number(stock).toFixed(4).replace(/\.?0+$/, '')} ${abbrev}`
}

export default { formatStockReadable }
