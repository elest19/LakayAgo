'use client'
import { useEffect, useMemo, useState, useRef, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { List, Trash2, Pencil, ChevronDown } from 'lucide-react'
import { Search, Plus } from 'lucide-react'
import Modal from '../components/Modal'
import PaginationFooter from '../components/PaginationFooter'
import useIsMobile from '../hooks/isMobile'
import { useApp } from '../App'
import { useRealtimeEntity } from '../hooks/useRealtimeEntity'

let fbItemsCache: any[] | null = null

const FRACTION_OPTIONS = [
  { label: '1/2', value: 0.5 },
  { label: '1/4', value: 0.25 },
  { label: '1/3', value: 0.3333 },
  { label: '3/4', value: 0.75 },
] as const

const FRACTION_TO_DECIMAL: Record<string, number> = {
  '1/2': 0.5,
  '1/4': 0.25,
  '1/3': 0.3333,
  '3/4': 0.75,
}

const DECIMAL_TO_FRACTION: Record<number, string> = {
  0.5: '1/2',
  0.25: '1/4',
  0.3333: '1/3',
  0.75: '3/4',
}

type RecipeQuantityMode = 'whole' | 'fraction' | 'whole+fraction'

const normalizeCategory = (value: unknown): 'Menu Item' | 'Others' => {
  return value === 'Others' ? 'Others' : 'Menu Item'
}

const ensureFractionLabel = (value?: string) => {
  if (value && FRACTION_OPTIONS.some(option => option.label === value)) return value
  return '1/2'
}

const getRowQuantityMode = (row: any): RecipeQuantityMode => {
  if (row?.quantityMode) return row.quantityMode
  if (row?.showFractionNumber && !row?.isFraction) return 'whole+fraction'
  if (row?.isFraction) return 'fraction'
  return 'whole'
}

const applyQuantityMode = (row: any, mode: RecipeQuantityMode) => {
  const next = { ...row, quantityMode: mode }
  if (mode === 'fraction') {
    return { ...next, isFraction: true, showFractionNumber: false, fractionValue: ensureFractionLabel(row?.fractionValue) }
  }
  if (mode === 'whole+fraction') {
    return { ...next, isFraction: false, showFractionNumber: true, fractionValue: ensureFractionLabel(row?.fractionValue) }
  }
  return { ...next, isFraction: false, showFractionNumber: false, fractionValue: row?.fractionValue || '' }
}

const getPureFractionKey = (decimal: number): string | null => {
  for (const [key, value] of Object.entries(DECIMAL_TO_FRACTION)) {
    if (Math.abs(Number(key) - decimal) < 0.0001) return value
  }
  return null
}

const decomposeIngredientQuantity = (value: number) => {
  const safeValue = Number(value)
  if (Number.isNaN(safeValue)) {
    return { quantityMode: 'whole' as RecipeQuantityMode, quantity_required: '0', fractionValue: '1/2', showFractionNumber: false, isFraction: false }
  }

  const wholePart = Math.trunc(safeValue)
  const remainder = safeValue - wholePart
  const pureFraction = getPureFractionKey(safeValue)
  if (pureFraction) {
    return { quantityMode: 'fraction' as RecipeQuantityMode, quantity_required: '0', fractionValue: pureFraction, showFractionNumber: false, isFraction: true }
  }

  const matchingFraction = Object.entries(DECIMAL_TO_FRACTION).find(([key]) => Math.abs(Number(key) - remainder) < 0.0001)
  if (matchingFraction) {
    return {
      quantityMode: 'whole+fraction' as RecipeQuantityMode,
      quantity_required: String(wholePart),
      fractionValue: matchingFraction[1],
      showFractionNumber: true,
      isFraction: false,
    }
  }

  return { quantityMode: 'whole' as RecipeQuantityMode, quantity_required: String(safeValue), fractionValue: '1/2', showFractionNumber: false, isFraction: false }
}

interface FBForm {
  name: string
  price: string
  restaurant: string
  servings: string
  category: 'Menu Item' | 'Others'
}
const emptyForm: FBForm = { name: '', price: '0.00', restaurant: 'Lakay Ago', servings: '', category: 'Menu Item' }

const getErrors = (f: FBForm) => {
  const e: Partial<Record<keyof FBForm, string>> = {}
  if (!f.name.trim()) e.name = 'Name is required.'
  if (f.price === '' || Number.isNaN(Number(f.price)) || Number(f.price) < 0) e.price = 'Price must be a non-negative number.'
  if (!f.restaurant) e.restaurant = 'Restaurant is required.'
  if (!['Menu Item', 'Others'].includes(f.category)) e.category = 'Category is invalid.'
  if (f.servings === '' || Number.isNaN(Number(f.servings)) || !Number.isInteger(Number(f.servings)) || Number(f.servings) <= 0) e.servings = 'Servings must be a positive integer.'
  return e
}

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

const toDecimal = (qty: string | number): number => {
  const n = Number(qty)
  return Number.isNaN(n) ? 0 : n
}

const getFractionKey = (decimal: number): string | null => {
  return getPureFractionKey(decimal)
}

// Portal-based ingredient dropdown so it doesn't affect the table's overflow container
interface IngredientDropdownProps {
  idx: number
  selectedLabel: string
  options: any[]
  recipeRowsModal: any[]
  isOpen: boolean
  onToggle: () => void
  onSelect: (id: any) => void
}

function IngredientDropdown({ idx, selectedLabel, options, recipeRowsModal, isOpen, onToggle, onSelect }: IngredientDropdownProps) {
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })

  useLayoutEffect(() => {
    if (isOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
  }, [isOpen])

  // reposition on scroll/resize while open (e.g. if the modal body scrolls)
  useEffect(() => {
    if (!isOpen) return
    const update = () => {
      if (btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect()
        setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
      }
    }
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [isOpen])

  return (
    <div data-recipe-drop>
      <button
        ref={btnRef}
        type="button"
        onClick={onToggle}
        className="w-full text-left border border-slate-200 rounded px-2 py-1 text-sm bg-white flex items-center justify-between gap-1"
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown size={12} className="text-slate-500 shrink-0" />
      </button>

      {isOpen && createPortal(
        <div
          data-recipe-drop
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="bg-white border border-slate-200 rounded shadow-md max-h-[180px] overflow-y-auto"
        >
          <ul>
            {options.map(p => {
              const disabled = recipeRowsModal.some((rr, j) => j !== idx && String(rr.production_inventory_id) === String(p.production_inventory_id))
              const selected = String(recipeRowsModal[idx].production_inventory_id) === String(p.production_inventory_id)
              return (
                <li key={p.production_inventory_id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelect(p.production_inventory_id)}
                    className={`w-full text-left px-3 py-2 text-sm ${selected ? 'bg-indigo-50 text-indigo-700' : disabled ? 'text-slate-300 cursor-not-allowed' : 'hover:bg-slate-50'}`}
                  >{p.name}</button>
                </li>
              )
            })}
            {options.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">No ingredients available</li>}
          </ul>
        </div>,
        document.body
      )}
    </div>
  )
}

export default function FoodAndBeverageCatalog() {
  const isMobile = useIsMobile()
  const { showToast } = useApp()
  const { appMode } = useApp()

  const [search, setSearch] = useState('')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<'All' | 'Menu Item' | 'Others'>('All')
  const [items, setItems] = useState<any[]>([])
  const [lakayPage, setLakayPage] = useState(1)
  const [arooPage, setArooPage] = useState(1)
  const [initialLoading, setInitialLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<FBForm>(emptyForm)
  const [errors, setErrors] = useState<Partial<Record<keyof FBForm, string>>>({})
  const [editingId, setEditingId] = useState<number | null>(null)
  const [recipeRowsModal, setRecipeRowsModal] = useState<any[]>([])
  const [productionOptionsModal, setProductionOptionsModal] = useState<any[]>([])
  const [recipeErrors, setRecipeErrors] = useState<string | null>(null)
  const [recipeRowOpen, setRecipeRowOpen] = useState<number | null>(null)

  const sortedProductionOptions = useMemo(() => [...productionOptionsModal].sort((a, b) => a.name.localeCompare(b.name)), [productionOptionsModal])

  // close recipe ingredient dropdown when clicking outside
  useEffect(() => {
    if (recipeRowOpen === null) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-recipe-drop]')) setRecipeRowOpen(null)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [recipeRowOpen])

  const filtered = useMemo(
    () => items.filter(item => {
      const nameMatches = item.name.toLowerCase().includes(search.toLowerCase())
      const categoryMatches = selectedCategoryFilter === 'All' || normalizeCategory(item.category) === selectedCategoryFilter
      return nameMatches && categoryMatches
    }),
    [items, search, selectedCategoryFilter],
  )

  const openCreate = () => { setForm({ ...emptyForm, category: 'Menu Item' }); setErrors({}); setShowModal(true) }
  const openEdit = (item: any) => { 
    setEditingId(item.food_and_beverage_id); 
    const recipeWithFraction = (item.recipe || []).map((r: any) => {
      const qty = Number(r.quantity_required ?? 0)
      const decomposed = decomposeIngredientQuantity(qty)
      return {
        ...r,
        quantity_required: decomposed.quantity_required,
        isFraction: decomposed.isFraction,
        fractionValue: decomposed.fractionValue,
        showFractionNumber: decomposed.showFractionNumber,
        quantityMode: decomposed.quantityMode,
      }
    })
    setForm({ name: item.name || '', price: String(item.price ?? '0.00'), restaurant: item.restaurant || 'Lakay Ago', servings: String(item.servings ?? '1'), category: normalizeCategory(item.category) }); 
    setErrors({}); 
    setShowModal(true);
    setRecipeRowsModal(recipeWithFraction)
  }
  
  // prepare modal for create/edit: set restaurant from app mode and load production options
  const fetchProductionOptions = (restaurant: string) => {
    fetch(`/api/production_inventory?restaurant=${encodeURIComponent(restaurant)}`)
      .then(r => r.json())
      .then(j => setProductionOptionsModal(j.production_inventory || []))
      .catch(() => setProductionOptionsModal([]))
  }

  const loadedRestRef = useRef<string | null>(null)

  // on modal open: initialize restaurant, load options, prefill recipe for edit
  useEffect(() => {
    if (!showModal) return
    const rest = form.restaurant || (appMode === 'lakayAgo' ? 'Lakay Ago' : 'Aroo')
    setForm(prev => ({ ...prev, restaurant: rest }))
    loadedRestRef.current = rest
    fetchProductionOptions(rest)
    if (editingId) {
      const it = items.find(i => i.food_and_beverage_id === editingId)
      if (it) {
        const recipeWithFraction = (it.recipe || []).map((r: any) => {
          const qty = Number(r.quantity_required ?? 0)
          const decomposed = decomposeIngredientQuantity(qty)
          return {
            ...r,
            quantity_required: decomposed.quantity_required,
            isFraction: decomposed.isFraction,
            fractionValue: decomposed.fractionValue,
            showFractionNumber: decomposed.showFractionNumber,
            quantityMode: decomposed.quantityMode,
          }
        })
        setRecipeRowsModal(recipeWithFraction)
      }
    } else {
      setRecipeRowsModal([])
    }
    setRecipeRowOpen(null)
  }, [showModal])

  // when the Restaurant field changes after open: refetch ingredients, clear stale recipe rows
  useEffect(() => {
    if (!showModal) return
    if (loadedRestRef.current !== form.restaurant) {
      loadedRestRef.current = form.restaurant
      fetchProductionOptions(form.restaurant)
      setRecipeRowsModal([])
      setRecipeRowOpen(null)
      setRecipeErrors('Recipe cleared — ingredient list depends on restaurant')
      setTimeout(() => setRecipeErrors(null), 3000)
    }
  }, [form.restaurant, showModal])

  const handleSave = () => {
    const next = getErrors(form)
    if (Object.keys(next).length) { setErrors(next); return }
    // recipe validations
    if (!Array.isArray(recipeRowsModal) || recipeRowsModal.length === 0) { setRecipeErrors('Recipe must include at least one ingredient.'); return }
    // ensure no duplicate production_inventory_id
    const ids = recipeRowsModal.map(r => String(r.production_inventory_id))
    const dup = ids.find((id, idx) => ids.indexOf(id) !== idx)
    if (dup) { setRecipeErrors('Duplicate ingredient selected.'); return }
    setRecipeErrors(null)
    const payload = { 
      name: form.name.trim(), 
      price: Number(form.price), 
      restaurant: form.restaurant, 
      servings: parseInt(form.servings, 10),
      category: normalizeCategory(form.category),
      recipe: recipeRowsModal.map(r => {
        const mode = getRowQuantityMode(r)
        const fractionValue = ensureFractionLabel(r.fractionValue)
        const wholePart = toDecimal(r.quantity_required || '0')
        const fractionAmount = FRACTION_TO_DECIMAL[fractionValue] || 0
        const quantity_required = mode === 'whole+fraction'
          ? wholePart + fractionAmount
          : mode === 'fraction'
            ? fractionAmount
            : toDecimal(r.quantity_required || r.fractionValue || '0')

        return {
          production_inventory_id: Number(r.production_inventory_id),
          quantity_required,
        }
      }) 
    }
    if (editingId) {
      fetch('/api/food_and_beverage', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ food_and_beverage_id: editingId, ...payload }) })
        .then(async r => {
          if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.error || b.detail || 'Update failed') }
          const j = await r.json()
          const updated = j.item
          setItems(prev => {
            const next = prev.map(it => (it.food_and_beverage_id === updated.food_and_beverage_id ? updated : it))
            fbItemsCache = next
            return next
          })
          showToast({ type: 'success', message: 'Menu item updated', description: updated.name })
          setShowModal(false)
          setEditingId(null)
        })
        .catch(err => { showToast({ type: 'error', message: 'Failed to update menu item', description: err.message || undefined }) })
    } else {
      fetch('/api/food_and_beverage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then(async r => {
          if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.error || b.detail || 'Create failed') }
          const j = await r.json()
          const created = j.item
          setItems(prev => {
            const next = [created, ...prev]
            fbItemsCache = next
            return next
          })
          showToast({ type: 'success', message: 'Menu item saved', description: created.name })
          setShowModal(false)
        })
        .catch(err => { showToast({ type: 'error', message: 'Failed to save menu item', description: err.message || undefined }) })
    }
  }

  const archiveItem = async (id: any) => {
    try {
      const res = await fetch(`/api/food_and_beverage?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Archive failed')
      setItems(prev => {
        const next = prev.filter(i => String(i.food_and_beverage_id) !== String(id))
        fbItemsCache = next
        return next
      })
      showToast({ type: 'success', message: 'Menu item archived' })
    } catch (err) { showToast({ type: 'error', message: 'Failed to archive' }) }
  }

  // recipe editor state
  const [selectedItem, setSelectedItem] = useState<any | null>(null)
  const [recipeOpen, setRecipeOpen] = useState(false)
  const [recipeRows, setRecipeRows] = useState<any[]>([])
  const [recipeLoading, setRecipeLoading] = useState(false)
  const [productionOptions, setProductionOptions] = useState<any[]>([])
  const [activeFB, setActiveFB] = useState<any | null>(null)
  const [packageBadges, setPackageBadges] = useState<Record<number, string>>({})

  const openRecipeEditor = async (item: any) => {
    setActiveFB(item)
    setRecipeLoading(true)
    setRecipeOpen(true)
    try {
      const [rRes, pRes] = await Promise.all([fetch(`/api/food_and_beverage_recipe?food_and_beverage_id=${item.food_and_beverage_id}`), fetch('/api/production_inventory')])
      if (rRes.ok) {
        const jr = await rRes.json()
        const rowsWithFraction = (jr.recipe || []).map((r: any) => {
          const decomposed = decomposeIngredientQuantity(Number(r.quantity_required ?? 0))
          return {
            ...r,
            ...decomposed,
            quantityMode: decomposed.quantityMode,
            fractionValue: decomposed.fractionValue,
            isFraction: decomposed.isFraction,
            showFractionNumber: decomposed.showFractionNumber,
          }
        })
        setRecipeRows(rowsWithFraction)
      } else {
        setRecipeRows([])
      }
      if (pRes.ok) {
        const jp = await pRes.json()
        setProductionOptions(jp.production_inventory || [])
      } else {
        setProductionOptions([])
      }
    } catch (err) {
      setRecipeRows([])
      setProductionOptions([])
    } finally {
      setRecipeLoading(false)
    }
  }

  const addRecipeRow = async (production_inventory_id: any, quantity_required: any) => {
    if (!activeFB) return
    try {
      const res = await fetch('/api/food_and_beverage_recipe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ food_and_beverage_id: activeFB.food_and_beverage_id, production_inventory_id, quantity_required }) })
      if (!res.ok) throw new Error('Failed')
      const j = await res.json()
      const decomposed = decomposeIngredientQuantity(Number(j.recipe.quantity_required ?? 0))
      setRecipeRows(prev => [{ ...j.recipe, ...decomposed, quantityMode: decomposed.quantityMode }, ...prev])
    } catch (err) {
      // ignore
    }
  }

  const removeRecipeRow = async (recipeId: any) => {
    try {
      const res = await fetch(`/api/food_and_beverage_recipe?id=${recipeId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setRecipeRows(prev => prev.filter(r => String(r.recipe_id) !== String(recipeId)))
    } catch (err) {
      // ignore
    }
  }

  const [editingRecipeId, setEditingRecipeId] = useState<number | null>(null)
  const [editingRecipeQty, setEditingRecipeQty] = useState<string>('')
  const [editingRecipeMode, setEditingRecipeMode] = useState<RecipeQuantityMode>('whole')
  const [editingRecipeFractionValue, setEditingRecipeFractionValue] = useState('1/2')
  const [newRowMode, setNewRowMode] = useState<RecipeQuantityMode>('whole')
  const [newRowQty, setNewRowQty] = useState('')
  const [newRowFractionValue, setNewRowFractionValue] = useState('1/2')
  const saveRecipeEdit = async (recipeId: any) => {
    const fractionAmount = FRACTION_TO_DECIMAL[ensureFractionLabel(editingRecipeFractionValue)] || 0
    const decimal = editingRecipeMode === 'whole+fraction'
      ? Number(editingRecipeQty || 0) + fractionAmount
      : editingRecipeMode === 'fraction'
        ? fractionAmount
        : Number(editingRecipeQty || 0)
    try {
      const res = await fetch('/api/food_and_beverage_recipe', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipe_id: recipeId, quantity_required: decimal }) })
      if (!res.ok) throw new Error('Failed')
      const j = await res.json()
      const decomposed = decomposeIngredientQuantity(Number(j.recipe.quantity_required ?? 0))
      setRecipeRows(prev => prev.map(r => (String(r.recipe_id) === String(recipeId) ? { ...j.recipe, ...decomposed, quantityMode: decomposed.quantityMode } : r)))
      setEditingRecipeId(null)
      setEditingRecipeQty('')
      setEditingRecipeMode('whole')
      setEditingRecipeFractionValue('1/2')
    } catch (err) {
      // ignore
    }
  }

  // load items
  const loadItems = useCallback(async () => {
    try {
      const res = await fetch('/api/food_and_beverage')
      if (!res.ok) return
      const j = await res.json()
      const next = j.items || []
      fbItemsCache = next
      setItems(next)
      setInitialLoading(false)
    } catch {
      if (!fbItemsCache) setInitialLoading(false)
    }
  }, [])

  useEffect(() => {
    if (fbItemsCache) {
      setItems(fbItemsCache)
      setInitialLoading(false)
    } else {
      setInitialLoading(true)
    }
    void loadItems()
  }, [loadItems])

  // Live updates: refetch whenever any user creates, edits, or archives an item —
  // including recipe-only edits, since the API writes the inventory row in the same
  // request, so an event always fires and the refetch returns the fresh recipe.
  // The page shows both restaurants, so subscribe without a restaurant filter —
  // the previous per-mode filter encoded the space as "Lakay%20Ago", which never
  // matched the stored "Lakay Ago" value and silently dropped every event.
  useRealtimeEntity('food_and_beverage_inventory', {
    restaurant: 'Both',
    onChange: loadItems,
  })

  // Recipe rows are edited through the inline recipe editor, which writes ONLY the
  // food_and_beverage_recipe table (it has no restaurant column). Subscribe to it as
  // well so every user refetches the item list (with fresh joined recipes) whenever
  // a recipe row is added, edited, or removed.
  useRealtimeEntity('food_and_beverage_recipe', {
    onChange: loadItems,
  })

  useEffect(() => {
    if (!items.length) {
      setPackageBadges({})
      return
    }

    let mounted = true
    Promise.all(
      items.map(async (item) => {
        try {
          const res = await fetch(`/api/food_and_beverage/${item.food_and_beverage_id}/packages`)
          if (!res.ok) return [item.food_and_beverage_id, []]
          const json = await res.json().catch(() => ({ packages: [] }))
          return [item.food_and_beverage_id, json.packages || []]
        } catch (error) {
          return [item.food_and_beverage_id, []]
        }
      })
    ).then((entries) => {
      if (!mounted) return
      const next: Record<number, string> = {}
      for (const [id, packages] of entries) {
        if (!Array.isArray(packages) || packages.length === 0) continue
        const names = packages.map((pkg: any) => pkg.package_name || pkg.name).filter(Boolean)
        next[Number(id)] = names.length === 1 ? `In ${names[0]}` : `In ${packages.length} packages`
      }
      setPackageBadges(next)
    })

    return () => {
      mounted = false
    }
  }, [items])

  const lakayAgoItems = filtered.filter(i => i.restaurant === 'Lakay Ago')
  const arooItems = filtered.filter(i => i.restaurant === 'Aroo')
  const pageSize = 10
  const lakayPageTotal = Math.max(1, Math.ceil(lakayAgoItems.length / pageSize))
  const arooPageTotal = Math.max(1, Math.ceil(arooItems.length / pageSize))
  const paginatedLakayItems = lakayAgoItems.slice((lakayPage - 1) * pageSize, lakayPage * pageSize)
  const paginatedArooItems = arooItems.slice((arooPage - 1) * pageSize, arooPage * pageSize)

  const lakayEmptyCount = paginatedLakayItems.length === 0 ? 0 : Math.max(0, pageSize - paginatedLakayItems.length)
  const arooEmptyCount = paginatedArooItems.length === 0 ? 0 : Math.max(0, pageSize - paginatedArooItems.length)

  useEffect(() => { setLakayPage(1) }, [search, selectedCategoryFilter, items.length])
  useEffect(() => { setArooPage(1) }, [search, selectedCategoryFilter, items.length])

  const renderRestaurantTable = (title: string, displayItems: typeof filtered, totalItems: typeof filtered, currentPage: number, totalPages: number, setPage: (value: number | ((prev: number) => number)) => void, emptyCount: number) => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden mb-6" style={{ display: initialLoading || totalItems.length > 0 ? 'block' : 'none' }}>
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <h3 className="text-sm font-semibold">{title} Menu </h3>
      </div>
      {!isMobile ? (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <colgroup>
              <col style={{ width: '20%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '14%' }} />
            </colgroup>
            <thead className="text-xs text-slate-500 uppercase border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 text-left">Name</th>
                <th className="py-3 px-4 text-center">Category</th>
                <th className="py-3 px-4 text-center">Price</th>
                <th className="py-3 px-4 text-center">Number of Ingredients</th>
                <th className="py-3 px-4 text-center">Servings</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {initialLoading ? (
                <SkeletonTableRows
                  columns={6}
                  rows={6}
                  columnConfig={[
                    { width: "70%" },
                    { width: "40%", pill: true },
                    { width: "40%" },
                    { width: "30%" },
                    { width: "30%" },
                    { width: "50%" },
                  ]}
                />
              ) : totalItems.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-sm text-slate-400">No menu items.</td></tr> : displayItems.map(i => (
                <tr key={i.food_and_beverage_id} className="hover:bg-slate-50 group cursor-pointer border-slate-200" onClick={() => setSelectedItem(i)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedItem(i) } }}>
                  <td className="py-3 px-4 font-medium">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{i.name}</span>
                      {packageBadges[i.food_and_beverage_id] && (
                        <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 uppercase tracking-wide">
                          {packageBadges[i.food_and_beverage_id]}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center text-sm">
                    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-medium ${normalizeCategory(i.category) === 'Menu Item' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                      {normalizeCategory(i.category)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center font-mono">{i.price}</td>
                  <td className="py-3 px-4 text-center text-sm text-slate-600">{Array.isArray(i.recipe) ? i.recipe.length : 0}</td>
                  <td className="py-3 px-4 text-center text-sm text-slate-600">{i.servings ?? 1}</td>
                  <td className="py-3 px-4 text-center text-sm" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-2">
                      <button type="button" onClick={(e) => { e.stopPropagation(); openEdit(i) }} className="text-indigo-600 hover:text-indigo-800 text-xs">Edit</button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); archiveItem(i.food_and_beverage_id) }} className="text-red-600 hover:text-red-800 text-xs">Archive</button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); openRecipeEditor(i) }} className="text-amber-600 hover:text-amber-800 text-xs">Recipe</button>
                    </div>
                  </td>
                </tr>
              ))}
              {emptyCount > 0 && (
                Array.from({ length: emptyCount }).map((_, ii) => (
                  <tr key={`empty-${ii}`} className="invisible">
                    <td className="py-3 px-4 font-medium"><div className="flex items-center gap-2 flex-wrap"><span>Placeholder</span></div></td>
                    <td className="py-3 px-4 text-center text-sm"><span className="inline-flex rounded-full px-2 py-1 text-[10px] font-medium">Menu Item</span></td>
                    <td className="py-3 px-4 text-center font-mono">0.00</td>
                    <td className="py-3 px-4 text-center text-sm text-slate-600">0</td>
                    <td className="py-3 px-4 text-center text-sm text-slate-600">0</td>
                    <td className="py-3 px-4 text-center text-sm"><div className="flex items-center justify-center gap-2"><button className="invisible">Edit</button></div></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div>{initialLoading ? (
          <SkeletonTableRows
            columns={3}
            rows={6}
            columnConfig={[
              { width: "65%" },
              { width: "35%" },
              { width: "35%" },
            ]}
          />
        ) : totalItems.length === 0 ? <div className="p-4 text-sm text-slate-400">No menu items.</div> : displayItems.map(i => (
          <button key={i.food_and_beverage_id} type="button" onClick={() => setSelectedItem(i)} className="text-left p-3 border-b hover:bg-slate-50 flex items-center justify-between gap-3 w-full">
            <div>
              <div className="font-medium">{i.name}</div>
              <div className="text-xs text-slate-500">{i.restaurant}</div>
            </div>
            <div className="font-mono">{i.price}</div>
          </button>
        ))}
        {emptyCount > 0 && (
          Array.from({ length: emptyCount }).map((_, ii) => (
            <button key={`empty-mobile-${ii}`} className="text-left p-3 border-b hover:bg-slate-50 flex items-center justify-between gap-3 w-full invisible">
              <div>
                <div className="font-medium">Placeholder</div>
                <div className="text-xs text-slate-500">Restaurant</div>
              </div>
              <div className="font-mono">0.00</div>
            </button>
          ))
        )}
        </div>
      )}
      <PaginationFooter items={totalItems} page={currentPage} setPage={setPage} pageSize={pageSize} noun="items" />
    </div>
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">Food & Beverage Catalog</h2>
          <p className="text-sm text-slate-500">Manage menu items and recipes.</p>
        </div>
        <div>
          <button onClick={openCreate} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm"><Plus size={14}/> Add Item</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-md p-4 mb-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex-1 flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 focus-within:border-indigo-400">
            <Search size={14} className="text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search menu items..." className="w-full outline-none text-sm" />
          </div>
          <div className="md:w-52">
            <select
              value={selectedCategoryFilter}
              onChange={e => setSelectedCategoryFilter(e.target.value as 'All' | 'Menu Item' | 'Others')}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="All">All Categories</option>
              <option value="Menu Item">Menu Item</option>
              <option value="Others">Others</option>
            </select>
          </div>
        </div>
      </div>

      {renderRestaurantTable('Lakay Ago', paginatedLakayItems, lakayAgoItems, lakayPage, lakayPageTotal, setLakayPage, lakayEmptyCount)}
      {renderRestaurantTable('Aroo', paginatedArooItems, arooItems, arooPage, arooPageTotal, setArooPage, arooEmptyCount)}

      <Modal
        open={showModal}
        title={editingId ? 'Edit Menu Item' : 'Add Menu Item'}
        onClose={() => { setShowModal(false); setForm(emptyForm); setRecipeRowsModal([]); setEditingId(null); setErrors({}); setRecipeRowOpen(null) }}
        className="max-w-[70vw]! w-full"
      >
        <div className="w-full flex flex-col max-h-[75vh]">
          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 min-h-0 pr-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* LEFT COLUMN — form fields, including Name now */}
              <div className="ml-2 space-y-4">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Name</label>
                  <input value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  {errors.name && <div className="text-xs text-red-600 mt-1">{errors.name}</div>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Price</label>
                    <input value={form.price} onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                    {errors.price && <div className="text-xs text-red-600 mt-1">{errors.price}</div>}
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Servings</label>
                    <input value={form.servings} onChange={e => setForm(prev => ({ ...prev, servings: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="1" />
                    {errors.servings && <div className="text-xs text-red-600 mt-1">{errors.servings}</div>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Restaurant</label>
                    <select value={form.restaurant} onChange={e => setForm(prev => ({ ...prev, restaurant: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                      <option value="Lakay Ago">Lakay Ago</option>
                      <option value="Aroo">Aroo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Category</label>
                    <select
                      value={form.category}
                      onChange={e => setForm(prev => ({ ...prev, category: normalizeCategory(e.target.value) }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="Menu Item">Menu Item</option>
                      <option value="Others">Others</option>
                    </select>
                    {errors.category && <div className="text-xs text-red-600 mt-1">{errors.category}</div>}
                  </div>
                </div>

                
              </div>

              {/* RIGHT COLUMN — recipe table */}
              <div className="flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-slate-600">Recipe</label>
                  <button
                    onClick={() => setRecipeRowsModal(prev => [...prev, applyQuantityMode({ production_inventory_id: '', quantity_required: '0', isFraction: false, fractionValue: '1/2', showFractionNumber: false }, 'whole')])}
                    className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-sm whitespace-nowrap"
                  >
                    + Add Ingredient
                  </button>
                </div>
                {recipeErrors && <div className="text-xs text-red-600 mb-2">{recipeErrors}</div>}

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 flex-1 min-h-0">
                  <div className="overflow-y-auto overflow-x-auto max-h-60">
                    <table className="w-full text-sm table-fixed">
                      <colgroup>
                        <col className="w-[20%]" />
                        <col className="w-[22%]" />
                        <col className="w-[16%]" />
                        <col className="w-[14%]" />
                        <col className="w-[12%]" />
                      </colgroup>
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="py-2 px-2 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Ingredient</th>
                          <th className="py-2 px-2 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Mode</th>
                          <th className="py-2 px-2 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Qty</th>
                          <th className="py-2 px-2 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Unit</th>
                          <th className="py-2 px-2 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {recipeRowsModal.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-4 text-center text-xs text-slate-400">No ingredients yet.</td>
                          </tr>
                        ) : recipeRowsModal.map((r, idx) => (
                          <tr key={idx}>
                            <td className="py-2 px-2 truncate">
                              <IngredientDropdown
                                idx={idx}
                                selectedLabel={(() => {
                                  const sel = sortedProductionOptions.find(p => String(p.production_inventory_id) === String(r.production_inventory_id))
                                  return sel ? sel.name : 'Select ingredient'
                                })()}
                                options={sortedProductionOptions}
                                recipeRowsModal={recipeRowsModal}
                                isOpen={recipeRowOpen === idx}
                                onToggle={() => setRecipeRowOpen(recipeRowOpen === idx ? null : idx)}
                                onSelect={(id) => {
                                  setRecipeRowsModal(prev => prev.map((row, i) => i === idx ? { ...row, production_inventory_id: id } : row))
                                  setRecipeRowOpen(null)
                                }}
                              />
                            </td>
                            <td className="py-2 px-2 text-center">
                              <select
                                value={getRowQuantityMode(r)}
                                onChange={e => {
                                  const nextMode = e.target.value as RecipeQuantityMode
                                  setRecipeRowsModal(prev => prev.map((row, i) => {
                                    if (i !== idx) return row
                                    const nextRow = applyQuantityMode(row, nextMode)
                                    if (nextMode === 'whole') {
                                      return { ...nextRow, quantity_required: String(row.quantity_required || '0') }
                                    }
                                    if (nextMode === 'fraction') {
                                      return { ...nextRow, quantity_required: '0', fractionValue: ensureFractionLabel(row.fractionValue) }
                                    }
                                    return { ...nextRow, quantity_required: String(row.quantity_required || '0'), fractionValue: ensureFractionLabel(row.fractionValue) }
                                  }))
                                }}
                                className="border border-slate-200 rounded px-1 py-1 text-xs bg-white w-full"
                              >
                                <option value="whole">Whole</option>
                                <option value="fraction">Fraction</option>
                                <option value="whole+fraction">Whole + Fraction</option>
                              </select>
                            </td>
                            <td className="py-2 px-2 text-center">
                              {getRowQuantityMode(r) === 'whole+fraction' ? (
                                <span className="inline-flex items-center gap-1">
                                  <input
                                    value={r.quantity_required ?? '0'}
                                    onChange={e => { const val = e.target.value; if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) setRecipeRowsModal(prev => prev.map((row, i) => i === idx ? { ...row, quantity_required: val } : row)) }}
                                    placeholder="0"
                                    className="w-10 border rounded px-1 py-1 text-sm text-right"
                                  />
                                  +
                                  <select
                                    value={ensureFractionLabel(r.fractionValue)}
                                    onChange={e => setRecipeRowsModal(prev => prev.map((row, i) => i === idx ? { ...row, fractionValue: e.target.value } : row))}
                                    className="w-12 border rounded px-1 py-1 text-sm bg-white"
                                  >
                                    {FRACTION_OPTIONS.map(opt => (
                                      <option key={opt.label} value={opt.label}>{opt.label}</option>
                                    ))}
                                  </select>
                                </span>
                              ) : getRowQuantityMode(r) === 'fraction' ? (
                                <select
                                  value={ensureFractionLabel(r.fractionValue)}
                                  onChange={e => setRecipeRowsModal(prev => prev.map((row, i) => i === idx ? { ...row, fractionValue: e.target.value } : row))}
                                  className="w-12 border rounded px-1 py-1 text-sm bg-white"
                                >
                                  {FRACTION_OPTIONS.map(opt => (
                                    <option key={opt.label} value={opt.label}>{opt.label}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  value={r.quantity_required ?? '0'}
                                  onChange={e => { const val = e.target.value; if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) setRecipeRowsModal(prev => prev.map((row, i) => i === idx ? { ...row, quantity_required: val } : row)) }}
                                  placeholder="0"
                                  className="w-10 border rounded px-1 py-1 text-sm text-right"
                                />
                              )}
                            </td>
                            <td className="py-2 px-2 text-center truncate">
                              {(() => {
                                const opt = productionOptionsModal.find(p => String(p.production_inventory_id) === String(r.production_inventory_id));
                                const cat = opt?.ingredient_category;
                                const u = cat === 'quantity'
                                  ? opt?.unit
                                  : (opt?.recipe_unit || opt?.unit || '');
                                if (!u) return '';
                                const m = u.match(/\(([^)]*)\)$/);
                                return m ? m[1].trim() : u;
                              })()}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <button onClick={() => setRecipeRowsModal(prev => prev.filter((_, i) => i !== idx))} className="text-red-600 hover:text-red-800"><Trash2 size={14} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer — outside scroll area */}
          <div className="flex justify-end gap-2 pt-3 mt-3 border-t border-slate-100">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Save</button>
          </div>
        </div>
      </Modal>

      <Modal open={recipeOpen} title={`${activeFB?.name || ''} Recipe`} onClose={() => { setRecipeOpen(false); setActiveFB(null); setRecipeRows([]) }}>
        <div className="w-md space-y-4">
          <div className="text-sm text-slate-600">Ingredients</div>
          {recipeLoading ? <div className="text-sm text-slate-400">Loading...</div> : (
            <div className="space-y-2">
              {recipeRows.length === 0 ? <div className="text-sm text-slate-400">No recipe defined.</div> : recipeRows.map(r => {
                const mode = getRowQuantityMode(r)
                return (
                  <div key={r.recipe_id} className="flex items-center justify-between gap-3 border border-slate-200 shadow-md rounded-lg px-3 py-2">
                    <div>
                      <div className="font-medium">{productionOptions.find(p => String(p.production_inventory_id) === String(r.production_inventory_id))?.name || `Item ${r.production_inventory_id}`}</div>
                      <div className="text-xs text-slate-500">{editingRecipeId === r.recipe_id ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <select
                            value={editingRecipeMode}
                            onChange={e => setEditingRecipeMode(e.target.value as RecipeQuantityMode)}
                            className="border px-2 py-1 rounded text-sm bg-white"
                          >
                            <option value="whole">Whole</option>
                            <option value="fraction">Fraction</option>
                            <option value="whole+fraction">Whole + Fraction</option>
                          </select>
                          {editingRecipeMode === 'whole+fraction' ? (
                            <>
                              <input value={editingRecipeQty} onChange={e => { const val = e.target.value; if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) setEditingRecipeQty(val) }} className="border px-2 py-1 rounded text-sm w-16" />
                              <select value={ensureFractionLabel(editingRecipeFractionValue)} onChange={e => setEditingRecipeFractionValue(e.target.value)} className="border px-2 py-1 rounded text-sm bg-white">
                                {FRACTION_OPTIONS.map(opt => <option key={opt.label} value={opt.label}>{opt.label}</option>)}
                              </select>
                            </>
                          ) : editingRecipeMode === 'fraction' ? (
                            <select value={ensureFractionLabel(editingRecipeFractionValue)} onChange={e => setEditingRecipeFractionValue(e.target.value)} className="border px-2 py-1 rounded text-sm bg-white">
                              {FRACTION_OPTIONS.map(opt => <option key={opt.label} value={opt.label}>{opt.label}</option>)}
                            </select>
                          ) : (
                            <input value={editingRecipeQty} onChange={e => { const val = e.target.value; if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) setEditingRecipeQty(val) }} className="border px-2 py-1 rounded text-sm w-20" />
                          )}
                        </div>
                      ) : (
                        <>
                          <span className="text-xs">Qty: </span>
                          {mode === 'fraction' ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="text-xs font-medium text-indigo-700">{ensureFractionLabel(r.fractionValue)}</span>
                            </span>
                          ) : mode === 'whole+fraction' ? (
                            <span className="text-xs font-medium text-indigo-700">{r.quantity_required ?? '0'} + {ensureFractionLabel(r.fractionValue)}</span>
                          ) : (
                            <span className="text-xs">{Number(r.quantity_required ?? 0)}</span>
                          )}
                          <span className="text-xs"> {(() => {
                              const opt = productionOptions.find(p => String(p.production_inventory_id) === String(r.production_inventory_id));
                              const cat = opt?.ingredient_category;
                              const u = cat === 'quantity'
                                ? opt?.unit
                                : (opt?.recipe_unit || opt?.unit || '');
                              if (!u) return '';
                              const m = u.match(/\(([^)]*)\)$/);
                              return m ? m[1].trim() : u;
                            })()}</span>
                        </>
                      )}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {editingRecipeId === r.recipe_id ? (
                        <>
                          <button onClick={() => saveRecipeEdit(r.recipe_id)} className="text-indigo-600 text-sm">Save</button>
                          <button onClick={() => { setEditingRecipeId(null); setEditingRecipeQty(''); setEditingRecipeMode('whole'); setEditingRecipeFractionValue('1/2') }} className="text-slate-600 text-sm">Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditingRecipeId(r.recipe_id); const decomposed = decomposeIngredientQuantity(Number(r.quantity_required ?? 0)); setEditingRecipeQty(decomposed.quantity_required); setEditingRecipeMode(decomposed.quantityMode); setEditingRecipeFractionValue(decomposed.fractionValue); }} className="text-slate-700"><Pencil size={14} /></button>
                          <button onClick={() => removeRecipeRow(r.recipe_id)} className="text-red-600"><Trash2 size={14} /></button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="pt-2 border-t pt-3">
            <div className="flex flex-wrap items-end gap-2">
              <select id="prodSelect" className="flex-1 min-w-[160px] border border-slate-200 rounded-lg px-2 py-1 text-sm">
                <option value="">Select ingredient</option>
                {productionOptions.map(p => <option key={p.production_inventory_id} value={p.production_inventory_id}>{p.name}</option>)}
              </select>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={newRowMode}
                  onChange={e => setNewRowMode(e.target.value as RecipeQuantityMode)}
                  className="border rounded-lg px-1 py-1 text-sm bg-white"
                >
                  <option value="whole">Whole</option>
                  <option value="fraction">Fraction</option>
                  <option value="whole+fraction">Whole + Fraction</option>
                </select>
                {newRowMode === 'whole+fraction' ? (
                  <>
                    <input value={newRowQty} onChange={e => { const val = e.target.value; if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) setNewRowQty(val) }} placeholder="Qty" className="w-14 border rounded-lg px-1 py-1 text-sm" />
                    <select value={newRowFractionValue} onChange={e => setNewRowFractionValue(e.target.value)} className="w-14 border rounded-lg px-1 py-1 text-sm bg-white">
                      {FRACTION_OPTIONS.map(opt => <option key={opt.label} value={opt.label}>{opt.label}</option>)}
                    </select>
                  </>
                ) : newRowMode === 'fraction' ? (
                  <select value={newRowFractionValue} onChange={e => setNewRowFractionValue(e.target.value)} className="w-14 border rounded-lg px-1 py-1 text-sm bg-white">
                    {FRACTION_OPTIONS.map(opt => <option key={opt.label} value={opt.label}>{opt.label}</option>)}
                  </select>
                ) : (
                  <input value={newRowQty} onChange={e => { const val = e.target.value; if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) setNewRowQty(val) }} placeholder="Qty" className="w-14 border rounded-lg px-1 py-1 text-sm" />
                )}
              </div>
              <button
                onClick={() => {
                  const sel = (document.getElementById('prodSelect') as HTMLSelectElement).value
                  if (!sel) { showToast({ type: 'error', message: 'Select an ingredient first' }); return }
                  const decimal = newRowMode === 'whole+fraction'
                    ? Number(newRowQty || 0) + (FRACTION_TO_DECIMAL[ensureFractionLabel(newRowFractionValue)] || 0)
                    : newRowMode === 'fraction'
                      ? (FRACTION_TO_DECIMAL[ensureFractionLabel(newRowFractionValue)] || 0)
                      : Number(newRowQty || 0)
                  addRecipeRow(sel, decimal)
                  setNewRowMode('whole')
                  setNewRowQty('')
                  setNewRowFractionValue('1/2')
                }}
                className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-sm shrink-0"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {selectedItem && (
        <Modal open={!!selectedItem} title={selectedItem.name} onClose={() => setSelectedItem(null)}>
          <div className="space-y-3 w-full max-w-md">
            <div className="grid grid-cols-2 gap-3 w-md">
              <div>
                <p className="text-xs text-slate-400">Price</p>
                <p className="text-sm font-medium">{selectedItem.price}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Restaurant</p>
                <p className="text-sm font-medium">{selectedItem.restaurant}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400"># Ingredients</p>
                <p className="text-sm font-medium">{Array.isArray(selectedItem.recipe) ? selectedItem.recipe.length : 0}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Category</p>
                <p className="text-sm font-medium">{normalizeCategory(selectedItem.category)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Servings</p>
                <p className="text-sm font-medium">{selectedItem.servings ?? 1}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => { setSelectedItem(null); openEdit(selectedItem) }} className="px-3 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">Edit</button>
              <button type="button" onClick={() => { setSelectedItem(null); archiveItem(selectedItem.food_and_beverage_id) }} className="px-3 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg">Archive</button>
              <button type="button" onClick={() => { setSelectedItem(null); openRecipeEditor(selectedItem) }} className="px-3 py-2 text-sm text-white bg-amber-600 hover:bg-amber-700 rounded-lg">Recipe</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}