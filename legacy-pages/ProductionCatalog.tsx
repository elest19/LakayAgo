'use client'
import { useEffect, useMemo, useState } from 'react'
import { Search, Pencil, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../App'
import Modal from '../components/Modal'
import useIsMobile from '../hooks/isMobile'
import { VOLUME_UNITS, WEIGHT_UNITS, isSpoonUnit, isCupUnit, fullUnitName, getConversionFactorForRecipeUnit } from '../lib/unitConversions'
import { formatStockReadable } from '../lib/formatStock'
import type { ProductionItem } from '../types'

const FRACTION_TO_DECIMAL: Record<string, number> = {
  '1/2': 0.5,
  '1/4': 0.25,
  '1/3': 0.3333,
  '3/4': 0.75,
} as const

const DECIMAL_TO_FRACTION: Record<number, string> = {
  0.5: '1/2',
  0.25: '1/4',
  0.3333: '1/3',
  0.75: '3/4',
}

const getFractionKey = (decimal: number): string | null => {
  for (const [key, value] of Object.entries(DECIMAL_TO_FRACTION)) {
    if (Math.abs(Number(key) - decimal) < 0.0001) return value
  }
  return null
}

// use shared display formatter for stock
const formatStock = (stock: number, unit?: string | null) => formatStockReadable(stock, unit || undefined)

const unitAbbrev = (unit?: string | null) => {
  if (!unit) return ''
  const match = unit.match(/\(([^)]*)\)$/)
  return match ? match[1].trim() : unit
}

interface ProductionFormState {
  name: string
  unit: string
  stock: string
  restaurant?: string
  recipe_unit?: string
  conversion_factor?: string
  ingredient_category?: string
}

const emptyForm: ProductionFormState = {
  name: '',
  unit: '',
  stock: '0',
  restaurant: 'Lakay Ago',
  recipe_unit: '',
  conversion_factor: '',
  ingredient_category: '',
}

const PAGE_SIZE = 10

interface SkeletonBarProps {
  width?: string | number
  height?: string | number
  rounded?: string
  className?: string
}

function SkeletonBar({ width = "100%", height = "1rem", rounded = "rounded-md", className = "" }: SkeletonBarProps) {
  return (
    <div
      className={`bg-slate-200 animate-pulse ${rounded} ${className}`}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
      }}
    />
  )
}

interface SkeletonTableRowsProps {
  columns: number
  rows?: number
  columnConfig?: { width?: string; pill?: boolean }[]
}

function SkeletonTableRows({ columns, rows = 6, columnConfig }: SkeletonTableRowsProps) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIdx) => (
        <tr key={rowIdx} className="border-b border-slate-50">
          {Array.from({ length: columns }, (_, colIdx) => {
            const config = columnConfig?.[colIdx]
            return (
              <td key={colIdx} className="py-2 px-3">
                <SkeletonBar
                  width={config?.width ?? "80%"}
                  height={config?.pill ? "1.1rem" : "0.85rem"}
                  rounded={config?.pill ? "rounded-full" : "rounded-md"}
                />
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}

const getValidationErrors = (form: ProductionFormState) => {
  const errors: Partial<Record<keyof ProductionFormState, string>> = {}
  if (!form.name.trim()) errors.name = 'Name is required.'
  if (!form.restaurant) errors.restaurant = 'Restaurant is required.'
  if (form.stock === '' || Number.isNaN(Number(form.stock)) || Number(form.stock) < 0) errors.stock = 'Stock must be a valid non-negative number.'
  if (form.conversion_factor !== undefined && form.conversion_factor !== '' && (Number.isNaN(Number(form.conversion_factor)) || Number(form.conversion_factor) <= 0)) errors.conversion_factor = 'Conversion factor must be a positive number.'
  // conversion_factor required when weight category uses spoon units
  if (form.ingredient_category === 'weight') {
    const recipeIsSpoon = isSpoonUnit(form.recipe_unit || '')
    if (recipeIsSpoon && (!form.conversion_factor || Number(form.conversion_factor) <= 0)) {
      errors.conversion_factor = 'Conversion factor is required when using tbsp/tsp for weight ingredients.'
    }
  }
  return errors
}

export default function ProductionCatalog() {
  const { showToast } = useApp()
  const [productionStock, setProductionStock] = useState<ProductionItem[]>([])
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    fetch('/api/production_inventory')
      .then(r => r.json())
      .then(j => {
        if (!mounted) return
        const rows = j.production_inventory || []
        const mapped = rows.map((r: any) => ({
          id: String(r.production_inventory_id),
          name: r.name,
          restaurant: r.restaurant,
          unit: r.unit || '',
          stock: Number(r.stock) || 0,
          isArchived: Boolean(r.is_archived),
          createdAt: r.created_at,
          createdBy: r.created_by || 'System',
          updatedAt: r.updated_at || r.created_at,
          updatedBy: r.updated_by || 'System',
          recipe_unit: r.recipe_unit || null,
          conversion_factor: r.conversion_factor !== undefined ? Number(r.conversion_factor) : null,
          ingredient_category: r.ingredient_category || null,
        }))
        setProductionStock(mapped)
      })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const [search, setSearch] = useState('')
  const [selectedItem, setSelectedItem] = useState<ProductionItem | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingItem, setEditingItem] = useState<ProductionItem | null>(null)
  const [form, setForm] = useState<ProductionFormState>(emptyForm)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ProductionFormState, string>>>({})
  const [lakayPage, setLakayPage] = useState(1)
  const [arooPage, setArooPage] = useState(1)
  const [showConversionTooltip, setShowConversionTooltip] = useState(false);
  const [addStockId, setAddStockId] = useState<string | null>(null)
  const [addStockValue, setAddStockValue] = useState('')
  const [addStockLoading, setAddStockLoading] = useState(false)

  const filteredItems = useMemo(() => productionStock.filter(item => item.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)), [productionStock, search])

  const resetForm = () => {
    setForm(emptyForm)
    setFormErrors({})
    setEditingItem(null)
  }

  const openCreate = () => {
    resetForm()
    setShowAddModal(true)
  }

  const openEdit = (item: ProductionItem) => {
    setEditingItem(item)
    const catRaw = String((item as any).ingredient_category || '').toLowerCase()
    const validCats = ['weight', 'volume', 'quantity']
    let category = validCats.includes(catRaw) ? catRaw : ''
    const recipeUnitFromDb = (item as any).recipe_unit || ''
    const unitFromDb = item.unit || ''
    // If category missing but recipe_unit exists, infer category from recipe_unit
    if (!category && recipeUnitFromDb) {
      const fullRecipeUnit = fullUnitName(recipeUnitFromDb)
      if (WEIGHT_UNITS.includes(fullRecipeUnit as any)) category = 'weight'
      else if (VOLUME_UNITS.includes(fullRecipeUnit as any)) category = 'volume'
      else if (unitFromDb && fullRecipeUnit === fullUnitName(unitFromDb)) category = 'quantity'
    }
    const initialRecipeUnit = category === 'quantity' ? unitFromDb : recipeUnitFromDb
    setForm({
      name: item.name,
      unit: fullUnitName(unitFromDb),
      stock: String(item.stock),
      restaurant: item.restaurant || 'Lakay Ago',
      recipe_unit: fullUnitName(initialRecipeUnit),
      conversion_factor: (item as any).conversion_factor ? String((item as any).conversion_factor) : '',
      ingredient_category: category,
    })
    setFormErrors({})
    setShowAddModal(true)
  }

  const handleSave = async () => {
    const next = getValidationErrors(form)
    if (Object.keys(next).length) { setFormErrors(next); return }
    const parsedStock = Math.round(Number(form.stock) * 100) / 100
    const normalizedUnit = fullUnitName(form.unit.trim())
    const normalizedRecipeUnit = form.recipe_unit ? fullUnitName(form.recipe_unit) : ''
    const isQuantity = form.ingredient_category === 'quantity'
    const recipeUnit = isQuantity ? normalizedUnit : (normalizedRecipeUnit || null)
    const isSpoon = isSpoonUnit(recipeUnit || '')
    const conversionFactor = isQuantity
      ? 1
      : (isSpoon
          ? (form.conversion_factor ? Number(form.conversion_factor) : undefined)
          : (recipeUnit ? getConversionFactorForRecipeUnit(form.ingredient_category || '', recipeUnit) : undefined))
    if (editingItem) {
      setLoading(true)
      try {
        const res = await fetch('/api/production_inventory', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ production_inventory_id: Number(editingItem.id), name: form.name.trim(), unit: normalizedUnit, stock: parsedStock, is_archived: editingItem.isArchived, restaurant: form.restaurant, recipe_unit: recipeUnit, conversion_factor: conversionFactor, ingredient_category: form.ingredient_category }) })
        const body = await res.json().catch(() => ({}))
        setLoading(false)
        if (!res.ok) { showToast({ type: 'error', message: 'Failed to update production item', description: body.error || body.detail || `Status ${res.status}` }); return }
        const updated = body.production_inventory
        const updatedItem: ProductionItem = {
          ...editingItem,
          name: updated.name || form.name.trim(),
          unit: updated.unit || form.unit.trim(),
          stock: Number(updated.stock ?? parsedStock),
          isArchived: Boolean(updated.is_archived),
          restaurant: updated.restaurant || form.restaurant || editingItem.restaurant,
          recipe_unit: updated.recipe_unit ?? recipeUnit,
          conversion_factor: updated.conversion_factor ?? conversionFactor,
          ingredient_category: updated.ingredient_category || form.ingredient_category || null,
          updatedAt: updated.updated_at || new Date().toISOString(),
          updatedBy: 'Admin',
        }
        setProductionStock(prev => prev.map(item => (item.id === editingItem.id ? updatedItem : item)))
        showToast({ type: 'success', message: 'Production item updated', description: `${updatedItem.name} has been updated.` })
        setShowAddModal(false)
        resetForm()
      } catch (err) {
        setLoading(false)
        showToast({ type: 'error', message: 'Failed to update production item' })
      }
    } else {
      setLoading(true)
      try {
        const payload = { name: form.name.trim(), unit: normalizedUnit, stock: parsedStock, restaurant: form.restaurant, recipe_unit: isQuantity ? normalizedUnit : (normalizedRecipeUnit || null), conversion_factor: isQuantity ? 1 : (form.conversion_factor ? Number(form.conversion_factor) : null), ingredient_category: form.ingredient_category || null }
        const res = await fetch('/api/production_inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        const body = await res.json().catch(() => ({}))
        setLoading(false)
        if (!res.ok) { showToast({ type: 'error', message: 'Failed to add production item', description: body.error || body.detail || `Status ${res.status}` }); return }
        const created = body.production_inventory
        const newItem: ProductionItem = {
          id: String(created.production_inventory_id || `PRO-${Date.now()}`),
          name: created.name,
          restaurant: created.restaurant || form.restaurant,
          unit: created.unit || form.unit,
          stock: Number(created.stock ?? parsedStock),
          isArchived: Boolean(created.is_archived),
          recipe_unit: created.recipe_unit ?? (isQuantity ? normalizedUnit : (normalizedRecipeUnit || null)),
          conversion_factor: created.conversion_factor ?? conversionFactor,
          ingredient_category: created.ingredient_category || form.ingredient_category || null,
          createdAt: created.created_at || new Date().toISOString(),
          createdBy: 'Admin',
          updatedAt: created.created_at || new Date().toISOString(),
          updatedBy: 'Admin',
        }
        setProductionStock(prev => [newItem, ...prev])
        showToast({ type: 'success', message: 'Production item added', description: `${newItem.name} is now in the production catalog.` })
        setShowAddModal(false)
        resetForm()
      } catch (err) {
        setLoading(false)
        showToast({ type: 'error', message: 'Failed to add production item' })
      }
    }
  }

  const archiveItem = async (id: string) => {
    try {
      const res = await fetch(`/api/production_inventory?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Archive failed')
      setProductionStock(prev => prev.filter(p => p.id !== id))
      showToast({ type: 'success', message: 'Production item archived' })
    } catch (err) { showToast({ type: 'error', message: 'Failed to archive production item' }) }
  }

  const handleAddStock = async (item: ProductionItem) => {
    const amount = Number(addStockValue)
    if (addStockValue === '' || Number.isNaN(amount) || amount <= 0) { showToast({ type: 'error', message: 'Enter a valid amount' }); return }
    const newStock = Math.round((item.stock + amount) * 100) / 100
    setAddStockLoading(true)
    try {
      const res = await fetch('/api/production_inventory', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ production_inventory_id: Number(item.id), stock: newStock }) })
      const body = await res.json().catch(() => ({}))
      setAddStockLoading(false)
      if (!res.ok) { showToast({ type: 'error', message: 'Failed to add stock', description: body.error || body.detail || `Status ${res.status}` }); return }
      setProductionStock(prev => prev.map(p => (p.id === item.id ? { ...p, stock: newStock } : p)))
      showToast({ type: 'success', message: 'Stock added', description: `Added ${amount} to ${item.name}.` })
      setAddStockValue('')
      setAddStockId(null)
    } catch (err) {
      setAddStockLoading(false)
      showToast({ type: 'error', message: 'Failed to add stock' })
    }
  }

  const renderTable = () => {
    const lakayAgoItems = filteredItems.filter(item => item.restaurant === 'Lakay Ago')
    const arooItems = filteredItems.filter(item => item.restaurant === 'Aroo')

    const PaginationFooter = ({ items, page, setPage }: { items: typeof filteredItems, page: number, setPage: (value: number | ((prev: number) => number)) => void }) => {
      const totalPages = Math.ceil(items.length / PAGE_SIZE)
      if (totalPages <= 1) return null
      return (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-white rounded-b-xl">
          <p className="text-xs text-slate-500">Showing {items.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, items.length)} of {items.length} items</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40"><ChevronLeft size={16} /></button>
            {Array.from({ length: totalPages }, (_, i) => {
              const p = i + 1
              const show = p === 1 || p === totalPages || Math.abs(p - page) <= 2
              if (!show) {
                if (i === 1 || i === totalPages - 2) return <span key={p} className="px-1 text-slate-400">…</span>
                return null
              }
              return (
                <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 rounded-lg text-xs font-medium font-display ${page === p ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                  {p}
                </button>
              )
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40"><ChevronRight size={16} /></button>
          </div>
        </div>
      )
    }

    const renderRestaurantTable = (title: string, items: typeof filteredItems) => {
      const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
      const pageState = title === 'Lakay Ago' ? { page: lakayPage, setPage: setLakayPage } : { page: arooPage, setPage: setArooPage }
      const safePage = Math.min(pageState.page, totalPages)
      const pagedItems = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
      const emptyCount = pagedItems.length === 0 ? 0 : Math.max(0, PAGE_SIZE - pagedItems.length)
      return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6" style={{ display: loading || items.length > 0 ? 'block' : 'none' }}>
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <h3 className="text-lg font-semibold text-slate-700 font-display">{title}</h3>
          </div>
          {!isMobile ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full table-fixed">
                  <colgroup>
                    <col style={{ width: '25%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '27%' }} />
                  </colgroup>
                  <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {['Name', 'Recipe Unit', 'Stock', 'Leftover Stock', 'Status', 'Actions'].map(column => (
                  <th key={column} className={`text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display whitespace-nowrap`}>
                    {column}
                  </th>
                  ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {loading ? (
                      <SkeletonTableRows
                        columns={6}
                        rows={PAGE_SIZE}
                        columnConfig={[
                          { width: "70%" },
                          { width: "50%" },
                          { width: "40%" },
                          { width: "40%" },
                          { width: "30%", pill: true },
                          { width: "60%" },
                        ]}
                      />
                    ) : items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">No production items found.</td>
                      </tr>
                      ) : (
                      <>
                        {pagedItems.map(item => (
                          <tr key={item.id} className="hover:bg-slate-50 group cursor-pointer" onClick={() => setSelectedItem(item)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedItem(item) } }}>
                            <td className="py-3 px-4 text-sm font-medium text-slate-700 font-display">{item.name}</td>
                            <td className="py-3 px-4 text-sm text-slate-600">{(() => { const cat = (item as any).ingredient_category; if (cat === 'quantity') return unitAbbrev(item.unit); return unitAbbrev((item as any).recipe_unit || item.unit); })()}</td>
                            <td className="py-3 px-4 font-mono text-xs text-slate-700">{Math.floor(item.stock)} {unitAbbrev(item.unit)}</td>
                            <td className="py-3 px-4 font-mono text-xs text-slate-700">{(Math.floor((item.stock - Math.floor(item.stock)) * 100) / 100).toFixed(2)} {unitAbbrev(item.unit)}</td>
                            <td className="py-3 px-4 text-sm text-slate-600">{item.isArchived ? 'Archived' : 'Active'}</td>
                            <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                              {addStockId === item.id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    value={addStockValue}
                                    onChange={e => { if (e.target.value === '' || /^\d*\.?\d{0,2}$/.test(e.target.value)) setAddStockValue(e.target.value) }}
                                    placeholder="Amount"
                                    inputMode="decimal"
                                    autoFocus
                                    className="w-24 border border-slate-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                  />
                                  <button type="button" onClick={() => handleAddStock(item)} disabled={addStockLoading} className="text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1">Add</button>
                                  <button type="button" onClick={() => { setAddStockId(null); setAddStockValue('') }} className="text-xs font-medium text-slate-600 border border-slate-200 rounded-lg px-3 py-1 hover:bg-slate-50">Cancel</button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <button type="button" onClick={() => { setAddStockId(item.id); setAddStockValue('') }} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">+ Add Stock</button>
                                  <button type="button" onClick={() => openEdit(item)} className="text-xs font-medium text-slate-600 hover:text-slate-900">Edit</button>
                                  <button type="button" onClick={() => archiveItem(item.id)} className="text-xs font-medium text-red-600 hover:text-red-800">Delete</button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                        {emptyCount > 0 && (
                          Array.from({ length: emptyCount }).map((_, ei) => (
                            <tr key={`empty-${ei}`} className="invisible">
                              <td className="py-3 px-4 text-sm font-medium text-slate-700 font-display">Placeholder</td>
                              <td className="py-3 px-4 text-sm text-slate-600">Unit</td>
                              <td className="py-3 px-4 font-mono text-xs text-slate-700">0</td>
                              <td className="py-3 px-4 font-mono text-xs text-slate-700">0.00</td>
                              <td className="py-3 px-4 text-sm text-slate-600">Status</td>
                              <td className="py-3 px-4"><div className="invisible">Actions</div></td>
                            </tr>
                          ))
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
              <PaginationFooter items={items} page={pageState.page} setPage={pageState.setPage} />
            </>
          ) : (
            <div className="p-4">
              {loading ? (
                <SkeletonTableRows
                  columns={3}
                  rows={PAGE_SIZE}
                  columnConfig={[
                    { width: "65%" },
                    { width: "35%" },
                    { width: "35%" },
                  ]}
                />
              ) : items.length === 0 ? (
                <div className="p-4 text-sm text-slate-400">No production items found.</div>
              ) : (
                <>
                  {pagedItems.map(item => (
                    <button key={item.id} type="button" onClick={() => setSelectedItem(item)} className="text-left p-3 border-b border-slate-50 hover:bg-slate-50 flex items-center justify-between gap-3 w-full">
                      <div>
                        <div className="text-sm font-semibold text-slate-700 font-display">{item.name}</div>
                        <div className="text-xs text-slate-400">{unitAbbrev(item.unit)}</div>
                      </div>
                      <div className="text-sm font-mono text-slate-700">{formatStock(item.stock, item.unit)}</div>
                    </button>
                  ))}
                  <PaginationFooter items={items} page={pageState.page} setPage={pageState.setPage} />
                </>
              )}
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="space-y-0">
        {renderRestaurantTable('Lakay Ago', lakayAgoItems)}
        {renderRestaurantTable('Aroo', arooItems)}
        {!loading && filteredItems.length === 0 && <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center"><p className="text-sm text-slate-400">No production items found.</p></div>}
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-display">Production Catalog</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage production stock by item and department</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 shadow-sm">
        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search production item..." className="bg-transparent text-sm outline-none text-slate-700 w-full placeholder:text-slate-400" />
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 mb-4">
        <button type="button" onClick={openCreate} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg font-display">
          <Plus size={16} /> Add Item
        </button>
        <TransferButton productionStock={productionStock} onTransferComplete={() => {
          // refetch
          fetch('/api/production_inventory').then(r => r.json()).then(j => setProductionStock((j.production_inventory || []).map((r: any) => ({ id: String(r.production_inventory_id), name: r.name, restaurant: r.restaurant, unit: r.unit || '', stock: Number(r.stock) || 0, isArchived: Boolean(r.is_archived), createdAt: r.created_at, createdBy: r.created_by || 'System', updatedAt: r.updated_at || r.created_at, updatedBy: r.updated_by || 'System', recipe_unit: r.recipe_unit || null, conversion_factor: r.conversion_factor !== undefined ? Number(r.conversion_factor) : null, ingredient_category: r.ingredient_category || null }))))
        }} />
      </div>
      {renderTable()}

      <Modal
        open={showAddModal}
        title={editingItem ? 'Edit Production Item' : 'Add Production Item'}
        onClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
      >
        <div className="w-full max-w-lg space-y-4">
          {/* Name */}
          <div className="w-full">
            <label className="block text-xs font-medium text-slate-600 mb-1 font-display">
              Name
            </label>
            <input
              value={form.name}
              onChange={e =>
                setForm(prev => ({ ...prev, name: e.target.value }))
              }
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              placeholder="Enter name"
            />
            {formErrors.name && (
              <p className="mt-1 text-xs text-red-600">
                {formErrors.name}
              </p>
            )}
          </div>

          {/* Stock Unit + Stock */}
          <div className="grid grid-cols-2 gap-3 w-full">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 font-display">
                Stock Unit (When Bought)
              </label>
              {form.ingredient_category === 'volume' ? (
                <select value={form.unit} onChange={e => setForm(prev => ({ ...prev, unit: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                  <option value="">Select unit</option>
                  {VOLUME_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              ) : form.ingredient_category === 'weight' ? (
                <select value={form.unit} onChange={e => setForm(prev => ({ ...prev, unit: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                  <option value="">Select unit</option>
                  {WEIGHT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              ) : (
                <input
                  disabled={!form.ingredient_category || !['weight','volume','quantity'].includes(form.ingredient_category)}
                  value={form.unit}
                  onChange={e => setForm(prev => ({ ...prev, unit: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  placeholder={form.ingredient_category ? `ex. pcs, kg` : `Select Category First`}
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 font-display">
                Stock
              </label>
              <input
                value={form.stock}
                onChange={e => {
                  if (
                    e.target.value === '' ||
                    /^\d*\.?\d{0,2}$/.test(e.target.value)
                  ) {
                    setForm(prev => ({ ...prev, stock: e.target.value }));
                  }
                }}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                placeholder="0"
                inputMode="decimal"
              />
              {formErrors.stock && (
                <p className="mt-1 text-xs text-red-600">
                  {formErrors.stock}
                </p>
              )}
            </div>
          </div>

          {/* Recipe Unit + Conversion Factor */}
          <div className="grid grid-cols-2 gap-3 w-full">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 font-display">
                Recipe Unit
              </label>
              {form.ingredient_category === 'volume' ? (
                <select value={form.recipe_unit} onChange={e => setForm(prev => ({ ...prev, recipe_unit: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                  <option value="">Select recipe unit</option>
                  {VOLUME_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              ) : form.ingredient_category === 'weight' ? (
                <select value={form.recipe_unit} onChange={e => setForm(prev => ({ ...prev, recipe_unit: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                  <option value="">Select recipe unit</option>
                  {WEIGHT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              ) : (
                <input disabled value={form.unit || 'pcs'} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-100" />
              )}
            </div>
            <div>
              {form.ingredient_category === 'weight' && isSpoonUnit(form.recipe_unit || '') ? (
                <>
                  <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1 font-display">
                    Conversion Factor
                    <span className="relative inline-block">
                      <button
                        type="button"
                        onClick={() => setShowConversionTooltip(prev => !prev)}
                        onBlur={() => setShowConversionTooltip(false)}
                        className="w-4 h-4 flex items-center justify-center rounded-full bg-green-500 text-slate-100 text-[10px] font-bold hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        aria-label="What is Conversion Factor?"
                      >
                        ?
                      </button>
                      {showConversionTooltip && (
                        <div
                          style={{
                            position: 'absolute',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            bottom: 'calc(100% + 8px)',
                            width: '224px',
                            maxWidth: '224px',
                            minWidth: '224px',
                            whiteSpace: 'normal',
                            wordBreak: 'normal',
                            overflowWrap: 'break-word',
                            textAlign: 'left',
                            zIndex: 50,
                          }}
                          className="rounded-lg bg-green-600 text-white text-xs leading-relaxed p-2 shadow-lg"
                        >
                          Ingredients bought have different measurements from recipe (ex. Salt is stored
                          in kg, but in a recipe, it is used in tsp).
                          <label className="block text-xs mb-1 font-display font-bold">
                            Ex. 1 tsp of salt = 0.005 kg, so the conversion factor is 0.005.
                          </label>
                        </div>
                      )}
                    </span>
                  </label>
                  <input
                    value={form.conversion_factor}
                    onChange={e => {
                      if (e.target.value === '' || /^\d*\.?\d*$/.test(e.target.value)) {
                        setForm(prev => ({ ...prev, conversion_factor: e.target.value }));
                      }
                    }}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    placeholder="Grams per tbsp/tsp (e.g. 18)"
                  />
                  {formErrors.conversion_factor && (
                    <p className="mt-1 text-xs text-red-600">{formErrors.conversion_factor}</p>
                  )}
                </>
              ) : (
                <>
                </>
              )}
            </div>
          </div>

          

          {/* Ingredient Category */}
          <div className="w-full">
            <label className="block text-xs font-medium text-slate-600 mb-1 font-display">
              Ingredient Category
            </label>
            <select
              value={form.ingredient_category}
              onChange={e =>
                setForm(prev => ({
                  ...prev,
                  ingredient_category: e.target.value,
                  recipe_unit: e.target.value === 'quantity' ? prev.unit || '' : prev.recipe_unit,
                }))
              }
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Unspecified</option>
              <option value="weight">Weight (Solid, ex. Flour)</option>
              <option value="volume">Volume (Liquid ex. Soy Sauce)</option>
              <option value="quantity">Quantity (1:1 ratio)</option>
            </select>
          </div>

          {/* Weight + Spoon unit reference table */}
          {form.ingredient_category === 'weight' && isSpoonUnit(form.recipe_unit || '') && (
  <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 w-md">
    {isCupUnit(form.recipe_unit || '') ? (
      <>
        <p className="text-xs font-semibold text-slate-700 mb-2">Approximate grams per 1 cup (use as reference for Conversion Factor):</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="py-1 px-2 text-left font-medium text-slate-600">Ingredient</th>
                <th className="py-1 px-2 text-right font-medium text-slate-600">1 cup ≈ (g)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr><td className="py-1 px-2 text-slate-700">Liver Spread</td><td className="py-1 px-2 text-right text-slate-700">225</td></tr>
              <tr><td className="py-1 px-2 text-slate-700">Rolled Oats</td><td className="py-1 px-2 text-right text-slate-700">90</td></tr>
              <tr><td className="py-1 px-2 text-slate-700">Bread Crumbs (dried)</td><td className="py-1 px-2 text-right text-slate-700">108</td></tr>
              <tr><td className="py-1 px-2 text-slate-700">Panko Breadcrumbs</td><td className="py-1 px-2 text-right text-slate-700">50</td></tr>
              <tr><td className="py-1 px-2 text-slate-700">Mayonnaise</td><td className="py-1 px-2 text-right text-slate-700">220</td></tr>
              <tr><td className="py-1 px-2 text-slate-700">Peanut Butter</td><td className="py-1 px-2 text-right text-slate-700">258</td></tr>
              <tr><td className="py-1 px-2 text-slate-700">Desiccated Coconut</td><td className="py-1 px-2 text-right text-slate-700">93</td></tr>
              <tr><td className="py-1 px-2 text-slate-700">Powdered Milk</td><td className="py-1 px-2 text-right text-slate-700">68</td></tr>
              <tr><td className="py-1 px-2 text-slate-700">Cornmeal</td><td className="py-1 px-2 text-right text-slate-700">138</td></tr>
              <tr><td className="py-1 px-2 text-slate-700">Raisins</td><td className="py-1 px-2 text-right text-slate-700">145</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mt-2">Note: Values are approximate. Use actual product density for precise conversions.</p>
      </>
    ) : (
      <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 w-md">
        <p className="text-xs font-semibold text-slate-700 mb-2">Approximate grams per 1 tbsp (use as reference for Conversion Factor):</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="py-1 px-2 text-left font-medium text-slate-600">Ingredient</th>
                <th className="py-1 px-2 text-right font-medium text-slate-600">1 tbsp ≈ (g)</th>
                <th className="py-1 px-2 text-right font-medium text-slate-600">1 tsp ≈ (g)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr><td className="py-1 px-2 text-slate-700">Salt</td><td className="py-1 px-2 text-right text-slate-700">18</td><td className="py-1 px-2 text-right text-slate-700">6</td></tr>
              <tr><td className="py-1 px-2 text-slate-700">Sugar</td><td className="py-1 px-2 text-right text-slate-700">12.5</td><td className="py-1 px-2 text-right text-slate-700">4.17</td></tr>
              <tr><td className="py-1 px-2 text-slate-700">Flour</td><td className="py-1 px-2 text-right text-slate-700">8</td><td className="py-1 px-2 text-right text-slate-700">2.67</td></tr>
              <tr><td className="py-1 px-2 text-slate-700">Baking Soda</td><td className="py-1 px-2 text-right text-slate-700">14</td><td className="py-1 px-2 text-right text-slate-700">4.67</td></tr>
              <tr><td className="py-1 px-2 text-slate-700">Rice</td><td className="py-1 px-2 text-right text-slate-700">12</td><td className="py-1 px-2 text-right text-slate-700">4</td></tr>
              <tr><td className="py-1 px-2 text-slate-700">Ground Pepper</td><td className="py-1 px-2 text-right text-slate-700">6</td><td className="py-1 px-2 text-right text-slate-700">2</td></tr>
              <tr><td className="py-1 px-2 text-slate-700">MSG</td><td className="py-1 px-2 text-right text-slate-700">8</td><td className="py-1 px-2 text-right text-slate-700">2.67</td></tr>
              <tr><td className="py-1 px-2 text-slate-700">Garlic Powder</td><td className="py-1 px-2 text-right text-slate-700">9</td><td className="py-1 px-2 text-right text-slate-700">3</td></tr>
              <tr><td className="py-1 px-2 text-slate-700">Cocoa Powder</td><td className="py-1 px-2 text-right text-slate-700">5</td><td className="py-1 px-2 text-right text-slate-700">1.67</td></tr>
              <tr><td className="py-1 px-2 text-slate-700">Cheese (grated)</td><td className="py-1 px-2 text-right text-slate-700">5</td><td className="py-1 px-2 text-right text-slate-700">1.67</td></tr>
              <tr><td className="py-1 px-2 text-slate-700">Butter</td><td className="py-1 px-2 text-right text-slate-700">14</td><td className="py-1 px-2 text-right text-slate-700">4.67</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mt-2">Note: Values are approximate. Use actual product density for precise conversions.</p>
      </div>
    )}
  </div>
)}

          {/* Restaurant */}
          <div className="w-full">
            <label className="block text-xs font-medium text-slate-600 mb-1 font-display">
              Restaurant
            </label>
            <select
              value={form.restaurant}
              onChange={e =>
                setForm(prev => ({ ...prev, restaurant: e.target.value }))
              }
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="Lakay Ago">Lakay Ago</option>
              <option value="Aroo">Aroo</option>
            </select>
            {formErrors.restaurant && (
              <p className="mt-1 text-xs text-red-600">
                {formErrors.restaurant}
              </p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setShowAddModal(false);
                resetForm();
              }}
              className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display"
            >
              Save
            </button>
          </div>
        </div>
      </Modal>

      {selectedItem && (
        <Modal open={!!selectedItem} title={selectedItem.name} onClose={() => setSelectedItem(null)}>
          <div className="space-y-3 w-full max-w-md">
            <div className="grid grid-cols-2 gap-3 w-md">
              <div>
                <p className="text-xs text-slate-400">Unit</p>
                <p className="text-sm font-medium">{unitAbbrev(selectedItem.unit)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Recipe Unit</p>
                <p className="text-sm font-medium">{(selectedItem as any).recipe_unit ? unitAbbrev((selectedItem as any).recipe_unit) : '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Conversion Factor</p>
                <p className="text-sm font-medium">{(selectedItem as any).conversion_factor ?? '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Ingredient Category</p>
                <p className="text-sm font-medium">{(selectedItem as any).ingredient_category || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Stock</p>
                <p className="text-sm font-medium">{formatStock(selectedItem.stock, (selectedItem as any).unit)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Status</p>
                <p className="text-sm font-medium">{selectedItem.isArchived ? 'Archived' : 'Active'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Created</p>
                <p className="text-sm font-medium">{new Date(selectedItem.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Updated</p>
                <p className="text-sm font-medium">{new Date(selectedItem.updatedAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Created By</p>
                <p className="text-sm font-medium">{selectedItem.createdBy}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Updated By</p>
                <p className="text-sm font-medium">{selectedItem.updatedBy}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => { setSelectedItem(null); openEdit(selectedItem) }} className="px-3 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">Edit</button>
              <button type="button" onClick={() => { setSelectedItem(null); setShowAddModal(false); archiveItem(selectedItem.id) }} className="px-3 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg">Delete</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function TransferButton({ productionStock, onTransferComplete }: { productionStock: ProductionItem[], onTransferComplete: () => void }) {
  const { showToast } = useApp()
  const [open, setOpen] = useState(false)
  const [fromId, setFromId] = useState<string | null>(null)
  const [fromSearch, setFromSearch] = useState('')
  const [fromOpen, setFromOpen] = useState(false)
  const [qty, setQty] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // set sensible default source from Lakay Ago
    const fromDefault = productionStock.find(p => p.restaurant === 'Lakay Ago')
    setFromId(fromDefault ? fromDefault.id : (productionStock[0]?.id ?? null))
    setFromSearch(fromDefault ? fromDefault.name : '')
  }, [productionStock])

  // close dropdown when clicking outside
  useEffect(() => {
    if (!fromOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.relative')) setFromOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [fromOpen])

  const selectedFrom = productionStock.find(p => p.id === fromId) || null

  const filteredOptions = productionStock.filter(p => p.restaurant === 'Lakay Ago' && p.name.toLowerCase().includes(fromSearch.toLowerCase()))

  const handleSubmit = async () => {
    if (!fromId) { showToast({ type: 'error', message: 'Select source item' }); return }

    const fromRow = productionStock.find(p => p.id === fromId)
    if (!fromRow) { showToast({ type: 'error', message: 'From (source) item is not in the database' }); return }
    if (!qty || Number.isNaN(Number(qty)) || Number(qty) <= 0) { showToast({ type: 'error', message: 'Enter a valid quantity' }); return }
    if (fromRow.restaurant !== 'Lakay Ago') { showToast({ type: 'error', message: 'Source must be a Lakay Ago item' }); return }
    if (Number(qty) > fromRow.stock) { showToast({ type: 'error', message: 'Quantity exceeds source stock' }); return }

    setLoading(true)
    try {
      const res = await fetch('/api/production_inventory_transfers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from_production_inventory_id: Number(fromId), quantity: Math.round(Number(qty) * 100) / 100 }) })
      const body = await res.json().catch(() => ({}))
      setLoading(false)
      if (!res.ok) { showToast({ type: 'error', message: 'Transfer failed', description: body.error || body.detail || `Status ${res.status}` }); return }
      showToast({ type: 'success', message: 'Transfer recorded', description: `Transferred ${qty}` })
      setOpen(false)
      setQty('')
      setFromSearch('')
      onTransferComplete()
    } catch (err) {
      setLoading(false)
      showToast({ type: 'error', message: 'Transfer failed' })
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg font-display">
        Transfer Stock
      </button>
      <Modal open={open} title="Transfer Production Stock" onClose={() => setOpen(false)}>
        <div className="space-y-4 w-full">
          <div className='w-md relative'>
            <label className="block text-xs font-medium text-slate-600 mb-1">From (source)</label>
            <div className="relative">
              <input
                type="text"
                value={fromSearch}
                onChange={e => { setFromSearch(e.target.value); setFromOpen(true) }}
                onFocus={() => setFromOpen(true)}
                placeholder="Search or select source..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              {fromOpen && (
                <div className="absolute z-10 w-full mt-1 border border-slate-200 rounded-lg bg-white shadow-lg max-h-[190px] overflow-y-auto">
                  {filteredOptions.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setFromId(p.id); setFromSearch(p.name); setFromOpen(false) }}
                      className={`w-full px-3 py-2 text-sm text-left ${fromId === p.id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50'}`}
                    >
                      {p.name} ({formatStock(p.stock, p.unit)} available)
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">To (destination)</label>
            <input value={`Aroo`} readOnly disabled className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Quantity</label>
            <input value={qty} onChange={e => { if (e.target.value === '' || /^\d*\.?\d{0,2}$/.test(e.target.value)) setQty(e.target.value) }} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" inputMode="decimal" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button type="button" onClick={handleSubmit} disabled={loading} className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg">Transfer</button>
          </div>
        </div>
      </Modal>
    </>
  )
}