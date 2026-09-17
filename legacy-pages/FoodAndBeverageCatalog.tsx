'use client'
import { useEffect, useMemo, useState, useRef, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { List, Trash2, Pencil, ChevronDown, Archive, ArchiveRestore } from 'lucide-react'
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

// All prices on this page are shown with the Philippine Peso symbol (₱).
const pesoFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
})

const formatCurrency = (value: number | string | null | undefined) => {
  const amount = Number(value)
  return pesoFormatter.format(Number.isFinite(amount) ? amount : 0)
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
  mobile?: boolean
}

function SkeletonTableRows({ columns, rows = 6, columnConfig, mobile = false }: SkeletonTableRowsProps) {
  if (mobile) {
    return (
      <div className="flex flex-col">
        {Array.from({ length: rows }, (_, rowIdx) => (
          <div key={rowIdx} className="border-b border-slate-100 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-2">
                <SkeletonBar width={columnConfig?.[0]?.width ?? "60%"} height="0.85rem" rounded="rounded-md" />
                <SkeletonBar width={columnConfig?.[1]?.width ?? "30%"} height="0.7rem" rounded="rounded-md" />
              </div>
              <SkeletonBar width={columnConfig?.[2]?.width ?? "24%"} height="1.1rem" rounded="rounded-full" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }, (_, colIdx) => (
                <SkeletonBar key={colIdx} width="70%" height="0.85rem" rounded="rounded-md" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

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

// Unit label for a recipe ingredient row (e.g. "kg" out of "Kilogram (kg)").
const getIngredientUnitAbbrev = (opt: any) => {
  const unit = opt?.ingredient_category === 'quantity'
    ? opt?.unit
    : (opt?.recipe_unit || opt?.unit || '')
  if (!unit) return ''
  const match = String(unit).match(/\(([^)]*)\)$/)
  return match ? match[1].trim() : String(unit)
}

// Readable quantity label for a recipe row (used by the mobile summary list).
const getRecipeRowQtyLabel = (row: any) => {
  const mode = getRowQuantityMode(row)
  if (mode === 'fraction') return ensureFractionLabel(row?.fractionValue)
  if (mode === 'whole+fraction') return `${row?.quantity_required || 0} + ${ensureFractionLabel(row?.fractionValue)}`
  return String(row?.quantity_required ?? 0)
}

const getFractionKey = (decimal: number): string | null => {
  return getPureFractionKey(decimal)
}

// Typeable ingredient picker: the field is an input, so typing a letter filters the
// ingredient list down to the names containing it. The option list is rendered in a
// portal so it is never clipped by the modal's scroll container.
interface IngredientTypeaheadProps {
  value: string | number | null | undefined
  options: any[]
  onChange: (id: string) => void
  /** ids that cannot be picked again (e.g. an ingredient already on this recipe) */
  disabledIds?: (string | number)[]
  placeholder?: string
  /** classes for the wrapper (e.g. flex-1) */
  className?: string
  /** classes for the input itself */
  inputClassName?: string
}

function IngredientTypeahead({ value, options, onChange, disabledIds = [], placeholder = 'Select an ingredient', className = '', inputClassName = '' }: IngredientTypeaheadProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })

  const selectedLabel = options.find(o => String(o.production_inventory_id) === String(value ?? ''))?.name || ''
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(o => String(o.name).toLowerCase().includes(q))
  }, [options, query])

  const isDisabled = (opt: any) => disabledIds.some(d => String(d) === String(opt.production_inventory_id))
  const selectable = filtered.filter(o => !isDisabled(o))

  const reposition = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
  }, [])

  useLayoutEffect(() => { if (open) reposition() }, [open, reposition])

  // reposition on scroll/resize while open, and close on an outside mousedown
  useEffect(() => {
    if (!open) return
    const update = () => reposition()
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (wrapRef.current?.contains(target)) return
      if (target.closest('[data-ingredient-typeahead-option]')) return
      setOpen(false)
      setQuery('')
    }
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    document.addEventListener('mousedown', onDocMouseDown)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
      document.removeEventListener('mousedown', onDocMouseDown)
    }
  }, [open, reposition])

  // keep the keyboard cursor on the first match while the user types
  useEffect(() => { setHighlight(0) }, [query])

  const close = () => { setOpen(false); setQuery('') }

  const commit = (opt: any) => {
    if (!opt) return
    onChange(String(opt.production_inventory_id))
    close()
  }

  const handleKeyDown = (e: any) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) { setOpen(true); return }
      if (selectable.length === 0) return
      const delta = e.key === 'ArrowDown' ? 1 : -1
      setHighlight(prev => (prev + delta + selectable.length) % selectable.length)
      return
    }
    if (e.key === 'Enter') {
      if (!open) return
      e.preventDefault()
      commit(selectable[highlight] || selectable[0])
      return
    }
    if (e.key === 'Escape' || e.key === 'Tab') close()
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        role="textbox"
        aria-label={placeholder}
        value={open ? query : selectedLabel}
        placeholder={open && selectedLabel ? selectedLabel : placeholder}
        onFocus={() => setOpen(true)}
        onChange={e => { setOpen(true); setQuery(e.target.value) }}
        onKeyDown={handleKeyDown}
        className={`w-full pr-7 ${inputClassName}`}
      />
      <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />

      {open && createPortal(
        <div
          data-ingredient-typeahead-option
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="bg-white border border-slate-200 rounded shadow-md max-h-[180px] overflow-y-auto"
        >
          <ul>
            {filtered.map(p => {
              const disabled = isDisabled(p)
              const isHighlighted = !disabled && selectable.indexOf(p) === highlight
              return (
                <li key={p.production_inventory_id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => commit(p)}
                    className={`w-full text-left px-3 py-2 text-sm ${isHighlighted ? 'bg-indigo-50 text-indigo-700' : disabled ? 'text-slate-300 line-through cursor-not-allowed' : 'hover:bg-slate-50'}`}
                  >{p.name}{disabled && <span className="ml-1 text-[10px] font-medium not-italic">(already in recipe)</span>}</button>
                </li>
              )
            })}
            {filtered.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">No matching ingredients</li>}
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
  // Archive visibility filter shown next to the category filter.
  const [archiveFilter, setArchiveFilter] = useState<'Archived' | 'Unarchived'>('Unarchived')
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
  // mobile recipe picker (select + qty + Add) — see addIngredientRow
  const [ingredientSelect, setIngredientSelect] = useState('')
  const [ingredientQty, setIngredientQty] = useState('1')

  const sortedProductionOptions = useMemo(() => [...productionOptionsModal].sort((a, b) => a.name.localeCompare(b.name)), [productionOptionsModal])

  const filtered = useMemo(
    () => items.filter(item => {
      const nameMatches = item.name.toLowerCase().includes(search.toLowerCase())
      const categoryMatches = selectedCategoryFilter === 'All' || normalizeCategory(item.category) === selectedCategoryFilter
      const archiveMatches = archiveFilter === 'Archived' ? Boolean(item.is_archived) : !item.is_archived
      return nameMatches && categoryMatches && archiveMatches
    }),
    [items, search, selectedCategoryFilter, archiveFilter],
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
  
  // Mobile view: add a recipe ingredient from the picker (select + qty + Add)
  const addIngredientRow = (ingredientId: string, quantity: string) => {
    const id = Number(ingredientId)
    if (!Number.isFinite(id) || id <= 0) return
    if (recipeRowsModal.some(r => String(r.production_inventory_id) === String(id))) {
      setRecipeErrors('Ingredient already added.')
      setTimeout(() => setRecipeErrors(null), 3000)
      return
    }
    const qty = toDecimal(quantity)
    const safeQty = qty > 0 ? qty : 1
    setRecipeErrors(null)
    setRecipeRowsModal(prev => [
      ...prev,
      applyQuantityMode({ production_inventory_id: String(id), quantity_required: String(safeQty), isFraction: false, fractionValue: '1/2', showFractionNumber: false }, 'whole'),
    ])
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
  }, [showModal])

  // when the Restaurant field changes after open: refetch ingredients, clear stale recipe rows
  useEffect(() => {
    if (!showModal) return
    if (loadedRestRef.current !== form.restaurant) {
      loadedRestRef.current = form.restaurant
      fetchProductionOptions(form.restaurant)
      setRecipeRowsModal([])
      setRecipeErrors('Recipe cleared — ingredient list depends on restaurant')
      setTimeout(() => setRecipeErrors(null), 3000)
    }
  }, [form.restaurant, showModal])

  const handleSave = async () => {
    const next = getErrors(form)
    if (Object.keys(next).length) { setErrors(next); return }
    // recipe validations
    if (!Array.isArray(recipeRowsModal) || recipeRowsModal.length === 0) { setRecipeErrors('Recipe must include at least one ingredient.'); return }
    // ensure no duplicate production_inventory_id
    const ids = recipeRowsModal.map(r => String(r.production_inventory_id))
    const dup = ids.find((id, idx) => ids.indexOf(id) !== idx)
    if (dup) { setRecipeErrors('Duplicate ingredient selected.'); return }
    if (savingAction) return
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
    setSavingAction('save')
    try {
      if (editingId) {
        const r = await fetch('/api/food_and_beverage', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ food_and_beverage_id: editingId, ...payload }) })
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
      } else {
        const r = await fetch('/api/food_and_beverage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
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
      }
    } catch (err: any) {
      showToast({ type: 'error', message: editingId ? 'Failed to update menu item' : 'Failed to save menu item', description: err?.message || undefined })
    } finally {
      setSavingAction(null)
    }
  }

  const archiveItem = async (id: any) => {
    try {
      const res = await fetch(`/api/food_and_beverage?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Archive failed')
      // Keep the row in state (flagged as archived) so the Archived view can list it.
      setItems(prev => {
        const next = prev.map(i => (String(i.food_and_beverage_id) === String(id) ? { ...i, is_archived: true } : i))
        fbItemsCache = next
        return next
      })
      showToast({ type: 'success', message: 'Menu item archived' })
    } catch (err) { showToast({ type: 'error', message: 'Failed to archive' }) }
  }

  const restoreItem = async (id: any) => {
    try {
      const res = await fetch('/api/food_and_beverage', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ food_and_beverage_id: id, is_archived: false }) })
      if (!res.ok) throw new Error('Restore failed')
      const j = await res.json().catch(() => ({}))
      const restored = j.item
      setItems(prev => {
        const next = restored
          ? prev.map(i => (String(i.food_and_beverage_id) === String(id) ? restored : i))
          : prev.map(i => (String(i.food_and_beverage_id) === String(id) ? { ...i, is_archived: false } : i))
        fbItemsCache = next
        return next
      })
      showToast({ type: 'success', message: 'Menu item restored', description: restored?.name || undefined })
    } catch (err) { showToast({ type: 'error', message: 'Failed to restore' }) }
  }

  // Runs the archive/restore only after the user confirms in the confirmation modal.
  // The modal stays open (with the button disabled) until the request finishes.
  const confirmArchiveAction = async () => {
    const target = archiveTarget
    if (!target || savingAction) return
    const id = target.item?.food_and_beverage_id
    setSavingAction(target.action)
    try {
      if (target.action === 'archive') await archiveItem(id)
      else await restoreItem(id)
    } finally {
      setSavingAction(null)
      setArchiveTarget(null)
    }
  }

  // selection / delete confirmation state
  const [selectedItem, setSelectedItem] = useState<any | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)
  // Archive / Restore confirmation state — { item, action } where action is 'archive' | 'restore'
  const [archiveTarget, setArchiveTarget] = useState<{ item: any; action: 'archive' | 'restore' } | null>(null)

  // recipe editor state
  const [recipeOpen, setRecipeOpen] = useState(false)
  const [recipeRows, setRecipeRows] = useState<any[]>([])
  const [recipeLoading, setRecipeLoading] = useState(false)
  const [productionOptions, setProductionOptions] = useState<any[]>([])
  const [activeFB, setActiveFB] = useState<any | null>(null)
  const [packageBadges, setPackageBadges] = useState<Record<number, string>>({})
  // Which mutating action is in flight ('save' | 'delete' | 'archive' | 'restore' |
  // 'recipe-add' | 'recipe-save-<id>' | 'recipe-del-<id>'). While any action runs, all
  // other action buttons are disabled so the user cannot double-submit.
  const [savingAction, setSavingAction] = useState<string | null>(null)

  // Permanent delete — the API refuses when the menu item is still referenced by sales or food packages.
  // The confirm modal stays open (button disabled) until the request finishes.
  const deleteItem = async () => {
    const item = deleteTarget
    if (!item || savingAction) return
    const id = item.food_and_beverage_id
    setSavingAction('delete')
    try {
      const res = await fetch(`/api/food_and_beverage?id=${id}&hard_delete=true`, { method: 'DELETE' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast({ type: 'error', message: j.error || 'Failed to delete menu item' })
        return
      }
      setItems(prev => {
        const next = prev.filter(i => String(i.food_and_beverage_id) !== String(id))
        fbItemsCache = next
        return next
      })
      setSelectedItem(null)
      showToast({ type: 'success', message: 'Menu item deleted', description: item.name })
    } catch (err) {
      showToast({ type: 'error', message: 'Failed to delete menu item' })
    } finally {
      setSavingAction(null)
      setDeleteTarget(null)
    }
  }

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
    if (!activeFB || savingAction) return
    if (recipeRows.some(r => String(r.production_inventory_id) === String(production_inventory_id))) {
      showToast({ type: 'error', message: 'That ingredient is already in this recipe' })
      return
    }
    setSavingAction('recipe-add')
    try {
      const res = await fetch('/api/food_and_beverage_recipe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ food_and_beverage_id: activeFB.food_and_beverage_id, production_inventory_id, quantity_required }) })
      if (!res.ok) throw new Error('Failed')
      const j = await res.json()
      const decomposed = decomposeIngredientQuantity(Number(j.recipe.quantity_required ?? 0))
      setRecipeRows(prev => [{ ...j.recipe, ...decomposed, quantityMode: decomposed.quantityMode }, ...prev])
    } catch (err) {
      // ignore
    } finally {
      setSavingAction(null)
    }
  }

  const removeRecipeRow = async (recipeId: any) => {
    if (savingAction) return
    setSavingAction('recipe-delete')
    try {
      const res = await fetch(`/api/food_and_beverage_recipe?id=${recipeId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setRecipeRows(prev => prev.filter(r => String(r.recipe_id) !== String(recipeId)))
    } catch (err) {
      // ignore
    } finally {
      setSavingAction(null)
    }
  }

  const [editingRecipeId, setEditingRecipeId] = useState<number | null>(null)
  const [editingRecipeQty, setEditingRecipeQty] = useState<string>('')
  const [editingRecipeMode, setEditingRecipeMode] = useState<RecipeQuantityMode>('whole')
  const [editingRecipeFractionValue, setEditingRecipeFractionValue] = useState('1/2')
  const [newRowIngredientId, setNewRowIngredientId] = useState('')
  const [newRowMode, setNewRowMode] = useState<RecipeQuantityMode>('whole')
  const [newRowQty, setNewRowQty] = useState('')
  const [newRowFractionValue, setNewRowFractionValue] = useState('1/2')
  const saveRecipeEdit = async (recipeId: any) => {
    if (savingAction) return
    setSavingAction('recipe-save')
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
    } finally {
      setSavingAction(null)
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

  useEffect(() => { setLakayPage(1) }, [search, selectedCategoryFilter, archiveFilter, items.length])
  useEffect(() => { setArooPage(1) }, [search, selectedCategoryFilter, archiveFilter, items.length])

  const renderRestaurantTable = (title: string, displayItems: typeof filtered, totalItems: typeof filtered, currentPage: number, totalPages: number, setPage: (value: number | ((prev: number) => number)) => void, emptyCount: number) => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden mb-6" style={{ display: initialLoading || totalItems.length > 0 ? 'block' : 'none' }}>
      {isMobile ? (
        <div className="px-4 py-3 border-b border-slate-200 bg-indigo-600 text-white">
          <h3 className="text-sm font-semibold">{title} Menu </h3>
        </div>
      ) : (
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h3 className="text-sm font-semibold">{title} Menu </h3>
        </div>
      )}
      {!isMobile ? (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <colgroup>
              <col style={{ width: '22%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '30%' }} />
            </colgroup>
            <thead className="text-xsuppercase border-b border-slate-200 bg-indigo-600 text-white">
              <tr>
                <th className="py-3 px-4 text-left">Name</th>
                <th className="py-3 px-4 text-center">Category</th>
                <th className="py-3 px-4 text-center">Number of Ingredients</th>
                <th className="py-3 px-4 text-center">Servings</th>
                <th className="py-3 px-4 text-right">Price</th>
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
              ) : totalItems.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-sm text-slate-400">{archiveFilter === 'Archived' ? 'No archived menu items.' : 'No menu items.'}</td></tr> : displayItems.map(i => (
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
                  <td className="py-3 px-4 text-center text-sm text-slate-600">{Array.isArray(i.recipe) ? i.recipe.length : 0}</td>
                  <td className="py-3 px-4 text-center text-sm text-slate-600">{i.servings ?? 1}</td>
                  <td className="py-3 px-4 text-right font-mono">{formatCurrency(i.price)}</td>
                  <td className="py-3 px-4 text-center text-sm" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-x-3 gap-y-1 flex-wrap">
                      <button type="button" onClick={(e) => { e.stopPropagation(); openEdit(i) }} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 whitespace-nowrap"><Pencil size={14} /> Edit</button>
                      {i.is_archived ? (
                        <button type="button" onClick={(e) => { e.stopPropagation(); setArchiveTarget({ item: i, action: 'restore' }) }} className="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1 whitespace-nowrap"><ArchiveRestore size={14} /> Restore</button>
                      ) : (
                        <button type="button" onClick={(e) => { e.stopPropagation(); setArchiveTarget({ item: i, action: 'archive' }) }} className="text-xs font-medium text-violet-500 hover:text-violet-600 hover:underline flex items-center gap-1 whitespace-nowrap"><Archive size={14} /> Archive</button>
                      )}
                      <button type="button" onClick={(e) => { e.stopPropagation(); openRecipeEditor(i) }} className="text-xs font-medium text-slate-700 hover:text-slate-800 hover:underline flex items-center gap-1 whitespace-nowrap"><List size={14} /> Recipe</button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteTarget(i) }} className="text-xs font-medium text-red-600 hover:text-red-800 hover:underline flex items-center gap-1 whitespace-nowrap"><Trash2 size={14} /> Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {emptyCount > 0 && (
                Array.from({ length: emptyCount }).map((_, ii) => (
                  <tr key={`empty-${ii}`} className="invisible border-slate-200">
                    <td className="py-3 px-4 font-medium"><div className="flex items-center gap-2 flex-wrap"><span>Placeholder</span></div></td>
                    <td className="py-3 px-4 text-center text-sm"><span className="inline-flex rounded-full px-2 py-1 text-[10px] font-medium">Menu Item</span></td>
                    <td className="py-3 px-4 text-center font-mono">{formatCurrency(0)}</td>
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
            mobile
            columns={3}
            rows={6}
            columnConfig={[
              { width: "65%" },
              { width: "35%" },
              { width: "35%" },
            ]}
          />
        ) : totalItems.length === 0 ? <div className="p-4 text-sm text-slate-400">{archiveFilter === 'Archived' ? 'No archived menu items.' : 'No menu items.'}</div> : displayItems.map(i => (
          <button key={i.food_and_beverage_id} type="button" onClick={() => setSelectedItem(i)} className="text-left p-3 border-b border-slate-200 hover:bg-slate-50 flex items-center justify-between gap-3 w-full">
            <div>
              <div className="font-medium">{i.name}</div>
              <div className="text-xs text-slate-500">{i.restaurant}</div>
            </div>
            <div className="font-mono">{formatCurrency(i.price)}</div>
          </button>
        ))}
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
          <div>
            <select
              value={selectedCategoryFilter}
              onChange={e => setSelectedCategoryFilter(e.target.value as 'All' | 'Menu Item' | 'Others')}
              className="w-full border border-slate-200 rounded-lg px-3 py-3 text-sm bg-white"
            >
              <option value="All">All Categories</option>
              <option value="Menu Item">Menu Item</option>
              <option value="Others">Others</option>
            </select>
          </div>
          <div className="md:w-52">
            <select
              value={archiveFilter}
              onChange={e => setArchiveFilter(e.target.value as 'Archived' | 'Unarchived')}
              className="w-full border border-slate-200 rounded-lg px-3 py-3 text-sm bg-white"
            >
              <option value="Unarchived">Active Menu</option>
              <option value="Archived">Phase out Menu</option>
            </select>
          </div>
        </div>
      </div>

      {renderRestaurantTable('Lakay Ago', paginatedLakayItems, lakayAgoItems, lakayPage, lakayPageTotal, setLakayPage, lakayEmptyCount)}
      {renderRestaurantTable('Aroo', paginatedArooItems, arooItems, arooPage, arooPageTotal, setArooPage, arooEmptyCount)}

      <Modal
        open={showModal}
        title={editingId ? 'Edit Menu Item' : 'Add Menu Item'}
        onClose={() => { setShowModal(false); setForm(emptyForm); setRecipeRowsModal([]); setEditingId(null); setErrors({}); setIngredientSelect(''); setIngredientQty('1') }}
        className={`${isMobile ? '' : 'max-w-[70vw]!'} w-full`}
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
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">₱</span>
                      <input value={form.price} onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))} className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-sm" />
                    </div>
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
                {isMobile ? (
                  <div className="flex flex-col flex-1 min-h-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-xs font-medium text-slate-700">Recipe</label>
                      <span className="text-[10px] uppercase tracking-wide text-slate-500">{recipeRowsModal.length} selected</span>
                    </div>

                    <div className="flex gap-2 mb-3">
                      <IngredientTypeahead
                        value={ingredientSelect}
                        options={sortedProductionOptions}
                        disabledIds={recipeRowsModal.map(r => r.production_inventory_id)}
                        placeholder="Select an ingredient"
                        className="flex-1"
                        inputClassName="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                        onChange={setIngredientSelect}
                      />
                      <button type="button" onClick={() => { if (!ingredientSelect) return; addIngredientRow(ingredientSelect, ingredientQty); setIngredientSelect(''); setIngredientQty('1') }} disabled={!ingredientSelect} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed">Add</button>
                    </div>
                    {recipeErrors && <div className="text-xs text-red-600 mb-2">{recipeErrors}</div>}

                    <div className="space-y-2 overflow-y-auto max-h-80 pr-1">
                      {recipeRowsModal.length === 0 ? (
                        <div className="text-xs text-slate-400">No ingredients yet.</div>
                      ) : recipeRowsModal.map((r, idx) => {
                        const ingredient = sortedProductionOptions.find(p => String(p.production_inventory_id) === String(r.production_inventory_id))
                        const unit = getIngredientUnitAbbrev(ingredient)
                        const mode = getRowQuantityMode(r)
                        return (
                          <div key={idx} className="rounded-lg border border-slate-200 bg-white p-2.5">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="min-w-0 text-sm font-medium text-slate-700 truncate">{ingredient ? ingredient.name : 'Select ingredient'}</div>
                              <button type="button" onClick={() => setRecipeRowsModal(prev => prev.filter((_, i) => i !== idx))} className="text-red-600 hover:text-red-700 shrink-0" aria-label="Remove ingredient">
                                <Trash2 size={14} />
                              </button>
                            </div>

                            <div>
                              <div>
                                <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">Quantity Type</label>
                                <select
                                  value={mode}
                                  onChange={e => {
                                    const nextMode = e.target.value as RecipeQuantityMode
                                    setRecipeRowsModal(prev => prev.map((row, i) => {
                                      if (i !== idx) return row
                                      const nextRow = applyQuantityMode(row, nextMode)
                                      if (nextMode === 'whole') return { ...nextRow, quantity_required: String(row.quantity_required || '0') }
                                      if (nextMode === 'fraction') return { ...nextRow, quantity_required: '0', fractionValue: ensureFractionLabel(row.fractionValue) }
                                      return { ...nextRow, quantity_required: String(row.quantity_required || '0'), fractionValue: ensureFractionLabel(row.fractionValue) }
                                    }))
                                  }}
                                  className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs bg-white"
                                >
                                  <option value="whole">Whole</option>
                                  <option value="fraction">Fraction</option>
                                  <option value="whole+fraction">Whole + Fraction</option>
                                </select>
                              </div>

                              <div className="grid grid-cols-2 gap-2 items-center mt-2">
                                <div>
                                  <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">Qty</label>
                                  {mode === 'whole+fraction' ? (
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        value={r.quantity_required ?? '0'}
                                        onChange={e => {
                                          const val = e.target.value
                                          if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                                            setRecipeRowsModal(prev => prev.map((row, i) => i === idx ? { ...row, quantity_required: val } : row))
                                          }
                                        }}
                                        placeholder="0"
                                        className="w-14 border border-slate-200 rounded px-2 py-1.5 text-xs text-right"
                                      />
                                      <span className="text-slate-500">+</span>
                                      <select
                                        value={ensureFractionLabel(r.fractionValue)}
                                        onChange={e => setRecipeRowsModal(prev => prev.map((row, i) => i === idx ? { ...row, fractionValue: e.target.value } : row))}
                                        className="w-16 border border-slate-200 rounded px-2 py-1.5 text-xs bg-white"
                                      >
                                        {FRACTION_OPTIONS.map(opt => (
                                          <option key={opt.label} value={opt.label}>{opt.label}</option>
                                        ))}
                                      </select>
                                    </div>
                                  ) : mode === 'fraction' ? (
                                    <select
                                      value={ensureFractionLabel(r.fractionValue)}
                                      onChange={e => setRecipeRowsModal(prev => prev.map((row, i) => i === idx ? { ...row, fractionValue: e.target.value } : row))}
                                      className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs bg-white"
                                    >
                                      {FRACTION_OPTIONS.map(opt => (
                                        <option key={opt.label} value={opt.label}>{opt.label}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      value={r.quantity_required ?? '0'}
                                      onChange={e => {
                                        const val = e.target.value
                                        if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                                          setRecipeRowsModal(prev => prev.map((row, i) => i === idx ? { ...row, quantity_required: val } : row))
                                        }
                                      }}
                                      placeholder="0"
                                      className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs text-right"
                                    />
                                  )}
                                </div>
                                <div>
                                  <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">Unit</label>
                                  <div className="flex min-h-[34px] items-center border border-slate-200 rounded px-2 py-1.5 text-xs text-slate-700 bg-slate-50">
                                    {unit || '-'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <>
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
                              <IngredientTypeahead
                                value={r.production_inventory_id}
                                options={sortedProductionOptions}
                                disabledIds={recipeRowsModal.filter((_, j) => j !== idx).map(rr => rr.production_inventory_id)}
                                placeholder="Select ingredient"
                                inputClassName="border border-slate-200 rounded px-2 py-1 text-sm bg-white"
                                onChange={(id) => {
                                  setRecipeRowsModal(prev => prev.map((row, i) => i === idx ? { ...row, production_inventory_id: id } : row))
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
                              {getIngredientUnitAbbrev(productionOptionsModal.find(p => String(p.production_inventory_id) === String(r.production_inventory_id)))}
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
                </>
                )}
              </div>
            </div>
          </div>

          {/* Footer — outside scroll area */}
          <div className="flex justify-end gap-2 pt-3 mt-3 border-t border-slate-100">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-slate-200">Cancel</button>
            <button onClick={handleSave} disabled={Boolean(savingAction)} className={`px-4 py-2 bg-indigo-600 text-white rounded-lg ${savingAction ? 'opacity-40 cursor-not-allowed' : ''}`}>{savingAction === 'save' ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </Modal>

      <Modal open={recipeOpen} title={`${activeFB?.name || ''} Recipe`} onClose={() => { setRecipeOpen(false); setActiveFB(null); setRecipeRows([]) }}>
        <div className="w-md max-h-[50vh] space-y-4 ">
          <div className="w-full pt-2">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <IngredientTypeahead
                  value={newRowIngredientId}
                  options={productionOptions}
                  disabledIds={recipeRows.map(r => r.production_inventory_id)}
                  placeholder="Select ingredient"
                  inputClassName="border border-slate-200 rounded-lg px-2 py-2 text-sm bg-white"
                  onChange={setNewRowIngredientId}
                />
                <select
                    value={newRowMode}
                    onChange={e => setNewRowMode(e.target.value as RecipeQuantityMode)}
                    className="border border-slate-200 rounded-lg px-2 py-2 text-sm bg-white"
                  >
                    <option value="whole">Whole</option>
                    <option value="fraction">Fraction</option>
                    <option value="whole+fraction">Whole + Fraction</option>
                  </select>
                </div>

              <div className={`${newRowMode === 'whole+fraction' ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-2 gap-2'}`}>
                {newRowMode === 'whole+fraction' ? (
                  <>
                    <input value={newRowQty} onChange={e => { const val = e.target.value; if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) setNewRowQty(val) }} placeholder="Qty" className="border border-slate-200 rounded-lg px-2 py-2 text-sm" />
                    <select value={newRowFractionValue} onChange={e => setNewRowFractionValue(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-2 text-sm bg-white">
                      {FRACTION_OPTIONS.map(opt => <option key={opt.label} value={opt.label}>{opt.label}</option>)}
                    </select>
                  </>
                ) : newRowMode === 'fraction' ? (
                  <select value={newRowFractionValue} onChange={e => setNewRowFractionValue(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-2 text-sm bg-white">
                    {FRACTION_OPTIONS.map(opt => <option key={opt.label} value={opt.label}>{opt.label}</option>)}
                  </select>
                ) : (
                  <input value={newRowQty} onChange={e => { const val = e.target.value; if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) setNewRowQty(val) }} placeholder="Qty" className="border border-slate-200 rounded-lg px-2 py-2 text-sm" />
                )}

                <div className="min-w-[52px] rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm text-slate-600">
                  {(() => {
                    const selectedIngredient = productionOptions.find(p => String(p.production_inventory_id) === String(newRowIngredientId))
                    const unit = selectedIngredient ? getIngredientUnitAbbrev(selectedIngredient) : ''
                    return unit || 'unit'
                  })()}
                </div>
              </div>
              <div className="flex justify-end gap-2 border-b border-slate-200 pb-2">
                <button
                  onClick={() => {
                    if (savingAction) return
                    if (!newRowIngredientId) { showToast({ type: 'error', message: 'Select an ingredient first' }); return }
                    const decimal = newRowMode === 'whole+fraction'
                      ? Number(newRowQty || 0) + (FRACTION_TO_DECIMAL[ensureFractionLabel(newRowFractionValue)] || 0)
                      : newRowMode === 'fraction'
                        ? (FRACTION_TO_DECIMAL[ensureFractionLabel(newRowFractionValue)] || 0)
                        : Number(newRowQty || 0)
                    addRecipeRow(newRowIngredientId, decimal)
                    setNewRowIngredientId('')
                    setNewRowMode('whole')
                    setNewRowQty('')
                    setNewRowFractionValue('1/2')
                  }}
                  disabled={Boolean(savingAction)}
                  className={`ml-auto w-full px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm shrink-0 ${savingAction ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {savingAction === 'recipe-add' ? 'Adding…' : 'Add'}
                </button>
              </div>
            </div>
          </div>
          {recipeLoading ? <div className="text-sm text-slate-400">Loading...</div> : (
            <div className="space-y-2">
              {recipeRows.length === 0 ? <div className="text-sm text-slate-400">No recipe defined.</div> : recipeRows.map(r => {
                const mode = getRowQuantityMode(r)
                return (
                  <div key={r.recipe_id} className=" gap-3 border border-slate-200 shadow-md rounded-lg px-3 py-2">
                    <div className={`${editingRecipeId !== r.recipe_id ? 'flex items-center justify-between gap-2' : '' }`}>
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
                          )}
                        </div>
                      </div>
                    <div className="flex items-center justify-end gap-2 mt-2">
                      {editingRecipeId === r.recipe_id ? (
                        <>
                          <div>
                            <button onClick={() => saveRecipeEdit(r.recipe_id)} disabled={Boolean(savingAction)} className={`px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm ${savingAction ? 'opacity-40 cursor-not-allowed' : ''}`}>{savingAction === 'recipe-save' ? 'Saving…' : 'Save'}</button>
                          </div>
                          <div>
                            <button onClick={() => { setEditingRecipeId(null); setEditingRecipeQty(''); setEditingRecipeMode('whole'); setEditingRecipeFractionValue('1/2') }} className="px-4 py-2 border border-slate-600 rounded-xl hover:bg-slate-200 text-sm">Cancel</button>
                          </div>
                        </>
                      ) : (
                        <>
                        <div>
                          <button onClick={() => { setEditingRecipeId(r.recipe_id); const decomposed = decomposeIngredientQuantity(Number(r.quantity_required ?? 0)); setEditingRecipeQty(decomposed.quantity_required); setEditingRecipeMode(decomposed.quantityMode); setEditingRecipeFractionValue(decomposed.fractionValue); }} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm"><Pencil size={14} /></button>
                        </div>
                        <div>  
                          <button onClick={() => removeRecipeRow(r.recipe_id)} disabled={Boolean(savingAction)} className={`px-4 py-2 border border-red-600 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm ${savingAction ? 'opacity-40 cursor-not-allowed' : ''}`}>{savingAction === 'recipe-delete' ? 'Deleting…' : <Trash2 size={14} />}</button>
                        </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
          )}
          <div className="flex justify-end gap-2 py-0.5">
          </div>
        </div>
      </Modal>

      {selectedItem && (
        <Modal open={!!selectedItem} title={selectedItem.name} onClose={() => setSelectedItem(null)}>
          <div className="space-y-3 w-full max-w-md">
            <div className="grid grid-cols-2 gap-3 w-md">
              <div>
                <p className="text-xs text-slate-400">Price</p>
                <p className="text-sm font-medium">{formatCurrency(selectedItem.price)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Restaurant</p>
                <p className="text-sm font-medium">{selectedItem.restaurant}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Servings</p>
                <p className="text-sm font-medium">{selectedItem.servings ?? 1}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Category</p>
                <p className="text-sm font-medium">{normalizeCategory(selectedItem.category)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400"># Ingredients</p>
                <p className="text-sm font-medium">{Array.isArray(selectedItem.recipe) ? selectedItem.recipe.length : 0}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Recipe</p>
                <button type="button" onClick={() => { setSelectedItem(null); openRecipeEditor(selectedItem) }} className="text-sm hover:underline rounded-lg flex items-center gap-2"><List size={14} /> Recipe List</button>
              </div>
            </div>
            {isMobile ? (
              <>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => { setSelectedItem(null); setDeleteTarget(selectedItem) }} className="px-3 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center justify-center gap-2"><Trash2 size={14} /> Delete</button>
                {selectedItem.is_archived ? (
                  <button type="button" onClick={() => { const target = selectedItem; setSelectedItem(null); setArchiveTarget({ item: target, action: 'restore' }) }} className="px-3 py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center justify-center gap-2"><ArchiveRestore size={14} /> Restore</button>
                ) : (
                  <button type="button" onClick={() => { const target = selectedItem; setSelectedItem(null); setArchiveTarget({ item: target, action: 'archive' }) }} className="px-3 py-2 text-sm text-white bg-violet-600 hover:bg-violet-700 rounded-lg flex items-center justify-center gap-2"><Archive size={14} /> Archive</button>
                )}
                <button type="button" onClick={() => { setSelectedItem(null); openEdit(selectedItem) }} className="px-3 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center justify-center gap-2"><Pencil size={14} /> Edit</button>
              </div>
              </>
            ) : (
              <>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => { setSelectedItem(null); setDeleteTarget(selectedItem) }} className="px-3 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center justify-center gap-2"><Trash2 size={14} /> Delete</button>
                {selectedItem.is_archived ? (
                  <button type="button" onClick={() => { const target = selectedItem; setSelectedItem(null); setArchiveTarget({ item: target, action: 'restore' }) }} className="px-3 py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center justify-center gap-2"><ArchiveRestore size={14} /> Restore</button>
                ) : (
                  <button type="button" onClick={() => { const target = selectedItem; setSelectedItem(null); setArchiveTarget({ item: target, action: 'archive' }) }} className="px-3 py-2 text-sm text-white bg-violet-600 hover:bg-violet-700 rounded-lg flex items-center justify-center gap-2"><Archive size={14} /> Archive</button>
                )}
                <button type="button" onClick={() => { setSelectedItem(null); openEdit(selectedItem) }} className="px-3 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center justify-center gap-2"><Pencil size={14} /> Edit</button>
              </div>
              </>
            )}
            
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal open={!!deleteTarget} title="Confirm deletion" onClose={() => setDeleteTarget(null)}>
          <div className="w-md p-2">
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to permanently delete <span className="font-semibold text-slate-700">{deleteTarget.name}</span>?
            </p>
            <p className="text-xs text-slate-500 mb-4">This action cannot be undone. The recipe of this menu item is deleted together with it. Menu items that are still referenced by sales or food packages cannot be deleted.</p>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => { if (!savingAction) setDeleteTarget(null) }} disabled={Boolean(savingAction)} className={`px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-200 font-display ${savingAction ? 'opacity-40 cursor-not-allowed' : ''}`}>Cancel</button>
              <button type="button" onClick={deleteItem} disabled={Boolean(savingAction)} className={`px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg font-display flex items-center justify-center gap-2 ${savingAction ? 'opacity-40 cursor-not-allowed' : ''}`}>{savingAction === 'delete' ? 'Deleting…' : <><Trash2 size={14} /> Delete</>}</button>
            </div>
          </div>
        </Modal>
      )}

      {archiveTarget && (
        <Modal open={!!archiveTarget} title={archiveTarget.action === 'archive' ? 'Confirm archive' : 'Confirm restore'} onClose={() => setArchiveTarget(null)}>
          <div className="w-md p-2">
            <p className="text-sm text-slate-600 mb-4">
              {archiveTarget.action === 'archive' ? 'Are you sure you want to archive ' : 'Are you sure you want to restore '}
              <span className="font-semibold text-slate-700">{archiveTarget.item?.name}</span>?
            </p>
            <p className="text-xs text-slate-500 mb-4">
              {archiveTarget.action === 'archive'
                ? 'Archived menu items are hidden from the Unarchived menu items view. This item keeps its ingredient list and can be listed again anytime using Restore.'
                : 'This menu item will show up again in the Unarchived menu items view, together with its ingredient list.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => { if (!savingAction) setArchiveTarget(null) }} disabled={Boolean(savingAction)} className={`px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-200 font-display ${savingAction ? 'opacity-40 cursor-not-allowed' : ''}`}>Cancel</button>
              {archiveTarget.action === 'archive' ? (
                <button type="button" onClick={confirmArchiveAction} disabled={Boolean(savingAction)} className={`px-4 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-display flex items-center justify-center gap-2 ${savingAction ? 'opacity-40 cursor-not-allowed' : ''}`}>{savingAction === 'archive' ? 'Archiving…' : <><Archive size={14} /> Archive</>}</button>
              ) : (
                <button type="button" onClick={confirmArchiveAction} disabled={Boolean(savingAction)} className={`px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-display flex items-center justify-center gap-2 ${savingAction ? 'opacity-40 cursor-not-allowed' : ''}`}>{savingAction === 'restore' ? 'Restoring…' : <><ArchiveRestore size={14} /> Restore</>}</button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}