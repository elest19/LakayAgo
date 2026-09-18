'use client'
import { useEffect, useMemo, useState } from 'react'
import { Search, Plus, Pencil, Trash2 } from 'lucide-react'
import { useApp } from '../App'
import Modal from '../components/Modal'
import PaginationFooter from '../components/PaginationFooter'
import SearchableSelect from '../components/SearchableSelect'
import useIsMobile from '../hooks/isMobile'
import DateFilter, { dateInRange, defaultDateFilterValue, resolveDateRange, type DateFilterValue } from '../components/DateFilter'
import type { InventoryCategory, InventoryItem, SaleRecord } from '../types'

interface FoodBundle {
  food_package_id: number
  name: string
  price: number
  restaurant: string
  type: string
  items: Array<{ food_package_item_id: number; food_and_beverage_id: number; quantity: number; name: string }>
  item_count: number
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(value)

const SALE_CATEGORIES: InventoryCategory[] = ['Menu Item', 'Food Bundle', 'Others']

// Mirrors SalesSummary's skeleton helpers: a pulsing placeholder bar shaped like real content.
function SkeletonBar({ width = '100%', height = '1rem', rounded = 'rounded-md', className = '' }: { width?: string | number; height?: string | number; rounded?: string; className?: string }) {
  return (
    <div
      className={`bg-slate-200 animate-pulse ${rounded} ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  )
}

// Mirrors the sales list while data loads: desktop uses the real table's indigo header row plus
// placeholder rows; mobile renders card-shaped rows (a <tr> outside a <table> is invalid HTML,
// so the mobile variant is built from divs like the stacked cards it stands in for).
function SalesTableSkeleton({ rows = 6, mobile = false }: { rows?: number; mobile?: boolean }) {
  if (mobile) {
    return (
      <div className="flex flex-col">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`sale-skeleton-card-${rowIndex}`} className="flex items-center justify-between gap-3 border-b border-slate-50 p-3 last:border-b-0">
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonBar width="60%" height="0.875rem" />
              <SkeletonBar width="40%" height="0.75rem" />
            </div>
            <div className="flex flex-col items-end gap-2">
              <SkeletonBar width="5rem" height="0.875rem" />
              <SkeletonBar width="3rem" height="0.75rem" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-slate-200 bg-indigo-600">
          {['Item', 'Sale Created', 'No. of Sales', 'Category', 'Discount', 'Cost', 'Actions'].map(header => (
            <th key={header} className={` ${header === 'Item' ? 'text-left' : header === 'Cost' ? 'text-right' : header === 'Discount' ? 'text-right' : 'text-center'} py-3 px-4 text-xs font-semibold text-white/70 uppercase tracking-wide font-display whitespace-nowrap`}>
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <tr key={`sale-skeleton-row-${rowIndex}`}>
            <td className="py-3 px-4"><SkeletonBar width="60%" height="0.875rem" /></td>
            <td className="py-3 px-4"><SkeletonBar width="5rem" height="0.75rem" className="mx-auto" /></td>
            <td className="py-3 px-4"><SkeletonBar width="1.5rem" height="0.75rem" className="mx-auto" /></td>
            <td className="py-3 px-4"><SkeletonBar width="5rem" height="0.75rem" className="mx-auto" /></td>
            <td className="py-3 px-4"><SkeletonBar width="3.5rem" height="0.75rem" className="ml-auto" /></td>
            <td className="py-3 px-4"><SkeletonBar width="3.5rem" height="0.75rem" className="ml-auto" /></td>
            <td className="py-3 px-4"><SkeletonBar width="4rem" height="0.75rem" className="mx-auto" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// Bundle sales are not stored with a category, so GET /api/sales derives it from the
// referenced food_packages row. Normalise whatever comes back (including the legacy
// 'Menu Bundle' value) into the categories this page filters and displays.
const normalizeSaleCategory = (value: unknown): InventoryCategory => {
  if (value === 'Others') return 'Others'
  if (value === 'Food Bundle' || value === 'Menu Bundle') return 'Food Bundle'
  return 'Menu Item'
}

type Restaurant = 'Lakay Ago' | 'Aroo'

interface SaleFormState {
  itemId: string
  item: string
  foodCost: string
  numberOfSales: string
  category: InventoryCategory
  discount: string
  restaurant: Restaurant | ''
}

const emptyForm = (): SaleFormState => ({
  itemId: '',
  item: '',
  foodCost: '',
  numberOfSales: '1',
  category: 'Menu Item',
  discount: '',
  restaurant: '',
})

const getSaleValidationErrors = (form: SaleFormState) => {
  const errors: Partial<Record<keyof SaleFormState, string>> = {}

  if (!form.itemId) {
    errors.itemId = 'Please select an item.'
  }

  if (!form.restaurant) {
    errors.restaurant = 'Please select a restaurant.'
  }

  if (form.foodCost === '' || form.foodCost.trim() === '') {
    errors.foodCost = 'Food cost is required.'
  } else {
    const parsed = Number(form.foodCost)
    if (Number.isNaN(parsed) || parsed < 0) {
      errors.foodCost = 'Food cost must be a valid non-negative number.'
    }
  }

  if (form.numberOfSales === '' || form.numberOfSales.trim() === '') {
    errors.numberOfSales = 'Number of sales is required.'
  } else {
    const parsed = Number(form.numberOfSales)
    if (Number.isNaN(parsed) || parsed <= 0) {
      errors.numberOfSales = 'Number of sales must be a valid positive number.'
    }
  }

  if (form.discount !== '') {
    const parsed = Number(form.discount)
    if (Number.isNaN(parsed) || parsed < 0) {
      errors.discount = 'Discount must be a valid non-negative number.'
    }
  }

  if (!SALE_CATEGORIES.includes(form.category)) {
    errors.category = 'Category is invalid.'
  }

  return errors
}

export default function Sales() {
  const { showToast } = useApp()
  const [inventoryItems, setInventoryItems] = useState<any[]>([])
  const [foodBundles, setFoodBundles] = useState<FoodBundle[]>([])
  const [salesRecords, setSalesRecords] = useState<any[]>([])
  const isMobile = useIsMobile()
  const [search, setSearch] = useState('')
  const [selectedItemFilter, setSelectedItemFilter] = useState('All Items')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<'All' | InventoryCategory>('All')
  const [selectedRestaurantFilter, setSelectedRestaurantFilter] = useState('All Restaurants')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSale, setEditingSale] = useState<SaleRecord | null>(null)
  const [form, setForm] = useState<SaleFormState>(emptyForm())
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof SaleFormState, string>>>({})
  const [activeItemTab, setActiveItemTab] = useState<'menu_items' | 'food_bundles'>('menu_items')
  const [previewSale, setPreviewSale] = useState<SaleFormState | null>(null)
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null)
  const [deleteSaleTarget, setDeleteSaleTarget] = useState<SaleRecord | null>(null)
  const [returnIngredientsStock, setReturnIngredientsStock] = useState(false)
  const [salesPage, setSalesPage] = useState(1)
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(defaultDateFilterValue)
  const [loading, setLoading] = useState(true)
  const [isBulkSaleModalOpen, setIsBulkSaleModalOpen] = useState(false)
  const [bulkSaleRestaurant, setBulkSaleRestaurant] = useState<Restaurant | ''>('')
  const [bulkSaleRows, setBulkSaleRows] = useState<Array<{ id: string; itemId: string; item: string; cost: string; quantity: string; discount: string }>>([])

  const loadInventory = async (restaurant?: string) => {
    try {
      const url = restaurant ? `/api/food_and_beverage?restaurant=${encodeURIComponent(restaurant)}` : '/api/food_and_beverage'
      const res = await fetch(url)
      if (!res.ok) return
      const j = await res.json()
      const rows = j.items || []
      setInventoryItems(rows.map((r: any) => ({ id: String(r.food_and_beverage_id || r.id || r.food_and_beverage_id), item: r.name || r.item || '', cost: r.price || r.cost || 0, category: r.category || 'Menu Item', restaurant: r.restaurant || 'Lakay Ago' })))
    } catch (err) {
      console.error('Failed loading menu items', err)
    }
  }

  const loadFoodBundles = async (restaurant?: string) => {
    try {
      const params = new URLSearchParams({ type: 'menu_bundle' })
      if (restaurant) params.set('restaurant', restaurant)
      const res = await fetch(`/api/food_packages?${params.toString()}`)
      if (!res.ok) return
      const j = await res.json()
      const rows = j.packages || []
      setFoodBundles(rows.map((r: any) => ({ food_package_id: r.food_package_id, name: r.name, price: r.price, restaurant: r.restaurant, type: r.type, items: r.items || [], item_count: r.item_count || 0 })))
    } catch (err) {
      console.error('Failed loading food bundles', err)
    }
  }

  const loadSales = async () => {
    try {
      const res = await fetch('/api/sales')
      if (!res.ok) return
      const j = await res.json()
      const rows = j.sales || []
      setSalesRecords(rows.map((s: any) => ({ id: String(s.sales_id || s.id), item: s.item, cost: Number(s.cost || s.price || 0), numberOfSales: Number(s.number_of_sales || s.numberOfSales || 0), discount: Number(s.discount || 0), category: normalizeSaleCategory(s.category), restaurant: s.restaurant || '', createdAt: s.created_at || s.createdAt, createdBy: s.created_by || s.createdBy, updatedAt: s.updated_at || s.updatedAt, updatedBy: s.updated_by || s.updatedBy })))
    } catch (err) {
      console.error('Failed loading sales', err)
    }
  }

  const handleDeleteSale = async () => {
    const sale = deleteSaleTarget
    if (!sale) return
    try {
      if (sale.id) {
        const params = returnIngredientsStock ? '?return_stock=true' : ''
        const res = await fetch(`/api/sales/${sale.id}${params}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Failed to delete sale')
        await loadSales()
        showToast({ type: 'success', message: 'Sale deleted', description: `${sale.item} was removed.` })
      } else {
        setSalesRecords(prev => prev.filter(entry => entry.id !== sale.id))
        showToast({ type: 'success', message: 'Sale deleted', description: `${sale.item} was removed.` })
      }
    } catch (err) {
      showToast({ type: 'error', message: 'Failed to delete sale' })
    } finally {
      setDeleteSaleTarget(null)
      setReturnIngredientsStock(false)
    }
  }

  // Initial load gates the skeleton: run all three fetches in parallel, clear loading when they settle.
  // Loading stays false for later refreshes (create/delete) so the skeleton only shows on first paint.
  useEffect(() => {
    let mounted = true
    setLoading(true)
    Promise.all([loadInventory(), loadFoodBundles(), loadSales()])
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (deleteSaleTarget) {
      setReturnIngredientsStock(false)
    }
  }, [deleteSaleTarget])

  const itemFilterOptions = ['All Items', ...inventoryItems.map(item => item.item)]

  const restaurantOptions = useMemo(
    () => Array.from(new Set(salesRecords.map(sale => sale.restaurant).filter(Boolean) as string[])).sort(),
    [salesRecords],
  )

  const salesDateRange = useMemo(() => resolveDateRange(dateFilter), [dateFilter])

  const filteredSales = useMemo(() => {
    return salesRecords.filter(sale => {
      const matchItem = selectedItemFilter === 'All Items' || sale.item === selectedItemFilter
      const matchCategory = selectedCategoryFilter === 'All' || sale.category === selectedCategoryFilter
      const matchSearch = !search || sale.item.toLowerCase().includes(search.toLowerCase())
      const matchDate = dateInRange(sale.createdAt, salesDateRange)
      const matchRestaurant = selectedRestaurantFilter === 'All Restaurants' || sale.restaurant === selectedRestaurantFilter
      return matchItem && matchCategory && matchSearch && matchDate && matchRestaurant
    })
  }, [salesRecords, search, selectedCategoryFilter, selectedItemFilter, salesDateRange, selectedRestaurantFilter])

  const salesMetrics = useMemo(() => {
    const grandTotalSales = filteredSales.reduce((sum, sale) => sum + sale.cost * sale.numberOfSales, 0)
    const orderDiscount = filteredSales.reduce((sum, sale) => sum + sale.discount, 0)
    const netSales = Math.max(grandTotalSales - orderDiscount, 0)
    const salesNumber = filteredSales.reduce((sum, sale) => sum + sale.numberOfSales, 0)

    return { grandTotalSales, orderDiscount, netSales, salesNumber }
  }, [filteredSales])

  const salesPageSize = 10
  const paginatedSales = useMemo(
    () => filteredSales.slice((salesPage - 1) * salesPageSize, salesPage * salesPageSize),
    [filteredSales, salesPage],
  )

  const salesEmptyCount = paginatedSales.length === 0 ? 0 : Math.max(0, salesPageSize - paginatedSales.length)

  useEffect(() => { setSalesPage(1) }, [search, selectedItemFilter, selectedCategoryFilter, selectedRestaurantFilter, dateFilter, salesRecords.length])

  const { grandTotalSales, netSales, orderDiscount, salesNumber } = salesMetrics

  const resetForm = () => {
    setForm(emptyForm())
    setFormErrors({})
    setPreviewSale(null)
    setEditingSale(null)
  }

  const openAddSale = () => {
    resetForm()
    setActiveItemTab('menu_items')
    setIsModalOpen(true)
  }

  const createBulkSaleRow = (): { id: string; itemId: string; item: string; cost: string; quantity: string; discount: string } => ({
    id: `bulk-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    itemId: '',
    item: '',
    cost: '',
    quantity: '',
    discount: '',
  })

  const resetBulkSaleForm = () => {
    setBulkSaleRestaurant('')
    setBulkSaleRows([createBulkSaleRow()])
  }

  const openBulkSaleModal = () => {
    resetBulkSaleForm()
    setIsBulkSaleModalOpen(true)
  }

  const updateBulkSaleRow = (rowId: string, updates: Partial<{ itemId: string; item: string; cost: string; quantity: string; discount: string }>) => {
    setBulkSaleRows(prev => prev.map(row => (row.id === rowId ? { ...row, ...updates } : row)))
  }

  const handleBulkSaleItemSelect = (rowId: string, itemId: string) => {
    const selectedItem = inventoryItems.find(item => item.id === itemId)
    if (!selectedItem) {
      updateBulkSaleRow(rowId, { itemId: '', item: '', cost: '' })
      return
    }
    updateBulkSaleRow(rowId, {
      itemId: selectedItem.id,
      item: selectedItem.item,
      cost: String(selectedItem.cost),
      quantity: '1',
      discount: '0',
    })
  }

  const handleBulkSaleSave = () => {
    if (!bulkSaleRestaurant) {
      showToast({ type: 'error', message: 'Select a restaurant' })
      return
    }

    const validRows = bulkSaleRows.filter(row => row.itemId && row.item)
    if (validRows.length === 0) {
      showToast({ type: 'error', message: 'Add at least one menu item' })
      return
    }

    for (const row of validRows) {
      const quantity = Number(row.quantity)
      const cost = Number(row.cost)
      const discount = Number(row.discount || 0)
      if (!Number.isFinite(quantity) || quantity <= 0) {
        showToast({ type: 'error', message: `Invalid quantity for ${row.item || 'selected item'}` })
        return
      }
      if (!Number.isFinite(cost) || cost < 0) {
        showToast({ type: 'error', message: `Invalid price for ${row.item || 'selected item'}` })
        return
      }
      if (!Number.isFinite(discount) || discount < 0) {
        showToast({ type: 'error', message: `Invalid discount for ${row.item || 'selected item'}` })
        return
      }
    }

    const payload = {
      sales: validRows.map(row => ({
        food_and_beverage_id: Number(row.itemId),
        item: row.item,
        cost: Number(row.cost || 0),
        number_of_sales: Number(row.quantity || 0),
        discount: Number(row.discount || 0),
        restaurant: bulkSaleRestaurant,
        source: 'item',
      }))
    }

    fetch('/api/sales', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(async r => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}))
          throw new Error(err.error || 'Failed to save bulk sale')
        }
        await loadSales()
        showToast({ type: 'success', message: 'Bulk sale saved', description: `${validRows.length} menu items recorded.` })
        setIsBulkSaleModalOpen(false)
        resetBulkSaleForm()
      })
      .catch(err => showToast({ type: 'error', message: 'Failed to save bulk sale', description: err.message || undefined }))
  }

  const openEditSale = (sale: SaleRecord) => {
    const matchedItem = inventoryItems.find(item => item.item === sale.item)
    const matchedBundle = foodBundles.find(bundle => bundle.name === sale.item)
    const isBundle = !!matchedBundle
    const rest = (matchedItem?.restaurant || matchedBundle?.restaurant || sale.restaurant || '') as Restaurant | ''
    const initialForm: SaleFormState = {
      itemId: (isBundle ? String(matchedBundle?.food_package_id) : matchedItem?.id) ?? '',
      item: sale.item,
      foodCost: String(sale.cost),
      numberOfSales: String(sale.numberOfSales),
      category: sale.category,
      discount: String(sale.discount),
      restaurant: rest,
    }

    setEditingSale(sale)
    setForm(initialForm)
    setFormErrors({})
    setPreviewSale(null)
    setIsModalOpen(true)
    setActiveItemTab(isBundle ? 'food_bundles' : 'menu_items')
    if (rest && !matchedItem && !matchedBundle) {
      loadInventory(rest)
      loadFoodBundles(rest)
    }
}

  const handleItemSelect = (itemId: string, source: 'menu_items' | 'food_bundles') => {
    if (source === 'food_bundles') {
      const selectedBundle = foodBundles.find(b => String(b.food_package_id) === itemId)
      if (!selectedBundle) {
        setForm(prev => ({ ...prev, itemId: '', item: '', foodCost: '', category: 'Food Bundle' }))
        return
      }
      setForm(prev => ({
        ...prev,
        itemId: String(selectedBundle.food_package_id),
        item: selectedBundle.name,
        foodCost: String(selectedBundle.price),
        category: 'Food Bundle',
        restaurant: (selectedBundle.restaurant || '') as Restaurant | '',
      }))
    } else {
      const selectedItem = inventoryItems.find(item => item.id === itemId)
      if (!selectedItem) {
        setForm(prev => ({ ...prev, itemId: '', item: '', foodCost: '', category: 'Menu Item' }))
        return
      }
      setForm(prev => ({
        ...prev,
        itemId: selectedItem.id,
        item: selectedItem.item,
        foodCost: String(selectedItem.cost),
        category: normalizeSaleCategory(selectedItem.category),
        restaurant: selectedItem.restaurant,
      }))
    }
  }

  const grossAmount = Number(form.foodCost || 0) * Number(form.numberOfSales || 0)
  const numericDiscount = Number(form.discount || 0)
  const netAmount = Math.max(grossAmount - numericDiscount, 0)

  const handleProceed = () => {
    const nextErrors = getSaleValidationErrors(form)
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors)
      return
    }

    setPreviewSale({ ...form })
  }

  const handleConfirm = () => {
    if (!previewSale) {
      showToast({ type: 'error', message: 'Unable to save sale', description: 'The sale preview is missing.' })
      return
    }

    const parsedCost = Number(previewSale.foodCost)
    const parsedSales = Number(previewSale.numberOfSales)
    const parsedDiscount = Number(previewSale.discount || 0)

    if (
      Number.isNaN(parsedCost) ||
      Number.isNaN(parsedSales) ||
      parsedCost < 0 ||
      parsedSales <= 0 ||
      parsedDiscount < 0
    ) {
      showToast({ type: 'error', message: 'Invalid sale data', description: 'Please review the sale details before confirming.' })
      return
    }

    const payloadRow = {
      food_and_beverage_id: Number(previewSale.itemId),
      item: previewSale.item,
      cost: parsedCost,
      number_of_sales: parsedSales,
      discount: parsedDiscount,
      restaurant: previewSale.restaurant || 'Both',
      source: previewSale.category === 'Food Bundle' ? 'bundle' : 'item',
    }

    // submit to API which will call RPC and perform deductions atomically
    if (editingSale) {
      // update existing sale
      fetch(`/api/sales/${editingSale.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payloadRow) })
        .then(async r => {
          if (!r.ok) throw new Error('Failed to update sale')
          await loadSales()
          showToast({ type: 'success', message: 'Sale updated', description: `${previewSale.item} updated.` })
          setIsModalOpen(false)
          setPreviewSale(null)
          resetForm()
        })
        .catch(() => showToast({ type: 'error', message: 'Failed to update sale' }))
    } else {
      fetch('/api/sales', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sales: [payloadRow] }) })
        .then(async r => {
          if (!r.ok) throw new Error('Failed to create sale')
          // refresh sales
          await loadSales()
          showToast({ type: 'success', message: 'Sale created', description: `${previewSale.item} recorded.` })
          setIsModalOpen(false)
          setPreviewSale(null)
          resetForm()
        })
        .catch(() => showToast({ type: 'error', message: 'Failed to create sale' }))
    }
  }

  const handleDelete = (sale: SaleRecord) => {
    setSelectedSale(null)
    setDeleteSaleTarget(sale)
  }

  const tableHeaders = ['Item', 'Sale Created', 'No. of Sales', 'Category', 'Discount' ,'Cost', 'Actions']

  const renderTable = () => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        {loading ? (
          <SalesTableSkeleton mobile={isMobile} rows={isMobile ? 6 : 10} />
        ) : !isMobile ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-indigo-600">
                {tableHeaders.map(header => (
                  <th key={header} className={` ${header === 'Item' ? 'text-left' : header === 'Cost' ? 'text-right' : header === 'Discount' ? 'text-right' : 'text-center' } py-3 px-4 text-xs font-semibold text-white uppercase tracking-wide font-display whitespace-nowrap`}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {paginatedSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">No sales records found.</td>
                </tr>
              ) : (
                paginatedSales.map((sale, index) => (
                  <tr
                    key={sale.id}
                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-100'} hover:bg-slate-50 group cursor-pointer`}
                    onClick={() => setSelectedSale(sale)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedSale(sale)
                      }
                    }}
                  >
                    <td className="py-3 px-4 text-sm font-medium text-slate-700 font-display ">{sale.item}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 text-center">{new Date(sale.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 text-center">{sale.numberOfSales}</td>
                    <td className="py-3 px-4 text-sm text-slate-600 text-center">{sale.category}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 text-right">{formatCurrency(sale.discount)}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 text-right">{formatCurrency(sale.cost)}</td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDelete(sale) }}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-800 hover:underline font-display"
                        title="Delete sale"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
              {salesEmptyCount > 0 && (
                Array.from({ length: salesEmptyCount }).map((_, ei) => (
                  <tr key={`empty-${ei}`} className="invisible">
                    <td className="py-3 px-4 text-sm font-medium text-slate-700 font-display ">Placeholder</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 text-center">PHP 0.00</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 text-center">0</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 text-center">PHP 0.00</td>
                    <td className="py-3 px-4 text-sm text-slate-600 text-center">Category</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 text-center">2020-01-01</td>
                    <td className="py-3 px-4 text-center"><div className="invisible">Actions</div></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col">
            {filteredSales.length === 0 ? (
              <div className="p-4 text-sm text-slate-400">No sales records found.</div>
        ) : (
            paginatedSales.map((sale, index) => (
              <button key={sale.id} type="button" onClick={() => setSelectedSale(sale)} className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-100'} text-left p-3 border-b border-slate-200 hover:bg-slate-50 flex items-center justify-between gap-3`}>
                <div>
                  <div className="text-sm font-semibold text-slate-700 font-display">{sale.item}</div>
                  <div className="text-xs text-slate-400">{sale.restaurant}</div>
                </div>
                <div className="text-sm font-mono text-slate-700">
                  <div>{formatCurrency(sale.cost * sale.numberOfSales)}</div>
                  <div className="text-xs text-slate-400 text-right">Qty: {sale.numberOfSales}</div>
                </div>
              </button>
            ))
          )}
          </div>
        )}
      </div>
      {!loading && (
        <PaginationFooter items={filteredSales} page={salesPage} setPage={setSalesPage} pageSize={salesPageSize} noun="sales" />
      )}
    </div>
  )

  return (
    <div className="p-6">
      {isMobile ? (
        <div>
          <div className="flex items-center justify-between gap-3 mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800 font-display">Sales</h2>
              <p className="text-sm text-slate-500 mt-0.5">Track and manage sales activity</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-3">
              <button type="button" onClick={openAddSale} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg font-display">
                <Plus size={16} /> Add Sale
              </button>
              <button type="button" onClick={openBulkSaleModal} className="flex items-center gap-2 border border-slate-200 bg-indigo-600 text-white hover:bg-indigo-700  text-sm font-semibold px-4 py-2.5 rounded-lg font-display">
                <Plus size={16} /> Add Bulk Sale
              </button>
            </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800 font-display">Sales</h2>
            <p className="text-sm text-slate-500 mt-0.5">Track and manage sales activity</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={openAddSale} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg font-display">
              <Plus size={16} /> Add Sale
            </button>
            <button type="button" onClick={openBulkSaleModal} className="flex items-center gap-2 border border-slate-200 bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold px-4 py-2.5 rounded-lg font-display">
              <Plus size={16} /> Add Bulk Sale
            </button>
          </div>
        </div>
      )}
      
      {isMobile ? (
        <div className="flex flex-col bg-white rounded-xl border border-slate-200 p-2 mb-2 shadow-sm gap-3">
          <div className="flex items-center  border border-slate-200 rounded-lg px-3 py-2 flex-1 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sale item..." className="bg-transparent text-sm outline-none text-slate-700 w-full placeholder:text-slate-400" />
          </div>
          <div className="grid grid-cols-2 gap-1">    
            <div className="w-full">
              <select
                value={selectedRestaurantFilter}
                onChange={e => setSelectedRestaurantFilter(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none font-display text-slate-600"
              >
                <option value="All Restaurants">All Restaurant</option>
                {restaurantOptions.map(restaurant => (
                  <option key={restaurant} value={restaurant}>{restaurant}</option>
                ))}
              </select>
            </div>
            
            <div className="w-full">
              <select value={selectedCategoryFilter} onChange={e => setSelectedCategoryFilter(e.target.value as 'All' | InventoryCategory)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none  font-display text-slate-600">
                <option value="All">All Categories</option>
                <option value="Menu Item">Menu Item</option>
                <option value="Food Bundle">Food Bundle</option>
                <option value="Others">Others</option>
              </select>
            </div>
          </div>
          <div>
            <DateFilter value={dateFilter} onChange={setDateFilter} allLabel="All Sales" className="w-full justify-end" />
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 shadow-sm flex flex-wrap gap-3">
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 flex-1 min-w-48 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sale item..." className="bg-transparent text-sm outline-none text-slate-700 w-full placeholder:text-slate-400" />
          </div>

          <select value={selectedItemFilter} onChange={e => setSelectedItemFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none  font-display text-slate-600">
            {itemFilterOptions.map(item => (
              <option key={item} value={item}>{item === 'All Items' ? 'All Items' : item}</option>
            ))}
          </select>

          <select value={selectedCategoryFilter} onChange={e => setSelectedCategoryFilter(e.target.value as 'All' | InventoryCategory)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none  font-display text-slate-600">
            <option value="All">All Categories</option>
            <option value="Menu Item">Menu Item</option>
            <option value="Food Bundle">Food Bundle</option>
            <option value="Others">Others</option>
          </select>

          <DateFilter value={dateFilter} onChange={setDateFilter} allLabel="All Sales" />

          <select
            value={selectedRestaurantFilter}
            onChange={e => setSelectedRestaurantFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none  font-display text-slate-600"
          >
            <option value="All Restaurants">All Restaurants</option>
            {restaurantOptions.map(restaurant => (
              <option key={restaurant} value={restaurant}>{restaurant}</option>
            ))}
          </select>
        </div>
      )}

      {isMobile ? (
        <div className="grid grid-cols-2 gap-2 mb-6">
          {[
            { label: 'Total Sales', value: formatCurrency(grandTotalSales), background: 'text-green-500' },
            { label: 'Net Sales', value: formatCurrency(netSales), background: 'text-yellow-500'},
            { label: 'Order Discount', value: formatCurrency(orderDiscount), background: 'text-red-500' },
            { label: 'Sales Count', value: salesNumber.toLocaleString(), background: 'text-indigo-500' },
          ].map(card => (
            <div key={card.label} className={` bg-white rounded-xl border border-slate-200 shadow-sm p-4`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
              <p className={`mt-3 text-sm font-bold ${card.background} font-display`}>{card.value}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Grand Total Sales', value: formatCurrency(grandTotalSales), background: 'text-green-500' },
            { label: 'Net Sales', value: formatCurrency(netSales), background: 'text-yellow-500' },
            { label: 'Order Discount', value: formatCurrency(orderDiscount), background: 'text-red-500' },
            { label: 'Sales Count', value: salesNumber.toLocaleString(), background: 'text-indigo-500' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 font-display">{card.label}</p>
              <p className={`mt-3 text-2xl font-bold ${card.background} font-display`}>{card.value}</p>
            </div>
          ))}
        </div>
      )}
      {renderTable()}

      <Modal open={isBulkSaleModalOpen} title="Add Bulk Sale" onClose={() => { setIsBulkSaleModalOpen(false); resetBulkSaleForm(); }}>
        <div className="w-xl max-w-2xl max-h-[60vh]  overflow-y-auto space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Restaurant</label>
            <select
              value={bulkSaleRestaurant}
              onChange={e => {
                const restaurant = e.target.value as Restaurant | ''
                setBulkSaleRestaurant(restaurant)
                if (restaurant) {
                  loadInventory(restaurant)
                }
              }}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Select restaurant</option>
              <option value="Lakay Ago">Lakay Ago</option>
              <option value="Aroo">Aroo</option>
            </select>
          </div>

          <div className="space-y-3">
            {bulkSaleRows.map((row, index) => {
              const rowItems = inventoryItems.filter(item => (!bulkSaleRestaurant || item.restaurant === bulkSaleRestaurant) && item.category === 'Menu Item')
              return (
                <div key={row.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 font-display">Item {index + 1}</p>
                    {bulkSaleRows.length > 1 && (
                      <button type="button" onClick={() => setBulkSaleRows(prev => prev.filter(item => item.id !== row.id))} className="text-xs text-red-600 hover:text-red-700 font-medium">Remove</button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.8fr_1fr_1fr_1fr]">
                    <div>
                      <SearchableSelect
                        value={row.itemId}
                        options={rowItems.map(item => ({ value: item.id, label: item.item }))}
                        onChange={(itemId) => handleBulkSaleItemSelect(row.id, itemId)}
                        placeholder="Select item"
                        disabled={!bulkSaleRestaurant}
                        emptyMessage="No menu items found"
                        className="w-full"
                        inputClassName={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none ${!bulkSaleRestaurant ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'}`}
                      />
                    </div>

                    <input
                      value={row.cost}
                      onChange={e => updateBulkSaleRow(row.id, { cost: e.target.value })}
                      placeholder="Price"
                      inputMode="decimal"
                      disabled={!bulkSaleRestaurant}
                      className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm ${!bulkSaleRestaurant ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'} outline-none`}
                    />

                    <input
                      type="number"
                      min="1"
                      value={row.quantity}
                      onChange={e => updateBulkSaleRow(row.id, { quantity: e.target.value })}
                      placeholder="Qty"
                      disabled={!bulkSaleRestaurant}
                      className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm ${!bulkSaleRestaurant ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'} outline-none`}
                    />

                    <input
                      value={row.discount}
                      onChange={e => updateBulkSaleRow(row.id, { discount: e.target.value })}
                      placeholder="Discount"
                      inputMode="decimal"
                      disabled={!bulkSaleRestaurant}
                      className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm ${!bulkSaleRestaurant ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'} outline-none`}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => setBulkSaleRows(prev => [...prev, createBulkSaleRow()])}
            className="flex items-center gap-2 border border-dashed border-slate-300 text-slate-600 hover:bg-slate-50 rounded-lg px-3 py-2 text-sm font-medium"
          >
            <Plus size={14} /> Add Item
          </button>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => { setIsBulkSaleModalOpen(false); resetBulkSaleForm(); }} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
            <button type="button" onClick={handleBulkSaleSave} className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display">Save Bulk Sale</button>
          </div>
        </div>
      </Modal>

      <Modal open={isModalOpen} title={editingSale ? 'Edit Sale' : 'Add Sale'} onClose={() => { setIsModalOpen(false); resetForm(); }}>
        {!previewSale ? (
          <div className="space-y-4 w-full max-h-[60vh] overflow-y-auto">
            <div className="w-md">
              <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Restaurant</label>
              <select
                value={form.restaurant}
                onChange={e => {
                  const rest = e.target.value as Restaurant | ''
                  setForm(prev => ({ ...prev, restaurant: rest, itemId: '', item: '', foodCost: '', category: 'Menu Item' }))
                  if (rest) { loadInventory(rest); loadFoodBundles(rest) }
                }}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">Select restaurant</option>
                <option value="Lakay Ago">Lakay Ago</option>
                <option value="Aroo">Aroo</option>
              </select>
              {formErrors.restaurant && <p className="mt-1 text-xs text-red-600">{formErrors.restaurant}</p>}
            </div>

            <div className="w-md">
              <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Item</label>
              <div className={`border border-slate-200 rounded-lg overflow-hidden ${!form.restaurant ? 'opacity-60 pointer-events-none' : ''}`}>
                <div className="flex border-b border-slate-200">
                  <button
                    type="button"
                    onClick={() => { setActiveItemTab('menu_items'); setForm(prev => ({ ...prev, itemId: '', item: '', foodCost: '', category: 'Menu Item' })) }}
                    className={`flex-1 px-3 py-2 text-sm font-medium font-display transition-colors ${activeItemTab === 'menu_items' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                  >
                    Menu Items
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveItemTab('food_bundles'); setForm(prev => ({ ...prev, itemId: '', item: '', foodCost: '', category: 'Food Bundle' })) }}
                    className={`flex-1 px-3 py-2 text-sm font-medium font-display transition-colors ${activeItemTab === 'food_bundles' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                  >
                    Food Bundles
                  </button>
                </div>
                {activeItemTab === 'menu_items' ? (
                  <SearchableSelect
                    value={form.itemId}
                    options={inventoryItems.filter(item => !form.restaurant || item.restaurant === form.restaurant).map(item => ({ value: item.id, label: item.item }))}
                    onChange={itemId => handleItemSelect(itemId, 'menu_items')}
                    placeholder="Select menu item"
                    disabled={!form.restaurant}
                    emptyMessage="No menu items found"
                    inputClassName={`w-full border-0 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-100 ${!form.restaurant ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'}`}
                  />
                ) : (
                  <SearchableSelect
                    value={form.itemId}
                    options={foodBundles.filter(b => !form.restaurant || b.restaurant === form.restaurant || b.restaurant === 'Both').map(bundle => ({ value: String(bundle.food_package_id), label: bundle.name }))}
                    onChange={itemId => handleItemSelect(itemId, 'food_bundles')}
                    placeholder="Select food bundle"
                    disabled={!form.restaurant}
                    emptyMessage="No food bundles found"
                    inputClassName={`w-full border-0 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-100 ${!form.restaurant ? 'bg-slate-100 cursor-not-allowed' : 'bg-white'}`}
                  />
                )}
              </div>
              {activeItemTab === 'food_bundles' && form.itemId && (() => {
                const selectedBundle = foodBundles.find(b => String(b.food_package_id) === form.itemId)
                if (!selectedBundle?.items?.length) return null
                return (
                  <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-2">
                    <p className="text-xs font-semibold text-slate-500 mb-1.5 font-display">Bundle contains:</p>
                    <ul className="space-y-1">
                      {selectedBundle.items.map((item, idx) => (
                        <li key={idx} className="flex items-center justify-between text-xs text-slate-600">
                          <span>{item.name}</span>
                          <span className="font-mono text-slate-400">x{item.quantity}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })()}
              {formErrors.itemId && <p className="mt-1 text-xs text-red-600">{formErrors.itemId}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Food Cost</label>
              <input
                value={form.foodCost}
                onChange={e => {
                  const value = e.target.value
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                    setForm(prev => ({ ...prev, foodCost: value }))
                  }
                }}
                disabled={!form.restaurant}
                className={` ${!form.restaurant ? 'bg-slate-200 cursor-not-allowed' : 'bg-white'} w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100`}
                placeholder="0.00"
                inputMode="decimal"
              />
              {formErrors.foodCost && <p className="mt-1 text-xs text-red-600">{formErrors.foodCost}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Number of Sales</label>
              <input
                value={form.numberOfSales}
                onChange={e => {
                  const value = e.target.value
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                    setForm(prev => ({ ...prev, numberOfSales: value }))
                  }
                }}
                disabled={!form.restaurant}
                className={` ${!form.restaurant ? 'bg-slate-200 cursor-not-allowed' : 'bg-white'} w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100`}
                placeholder="1"
                inputMode="numeric"
              />
              {formErrors.numberOfSales && <p className="mt-1 text-xs text-red-600">{formErrors.numberOfSales}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Category</label>
              <input value={form.category} readOnly className="w-full border border-slate-200 bg-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 outline-none cursor-default caret-transparent" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Discount</label>
              <input
                value={form.discount}
                onChange={e => {
                  const value = e.target.value
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                    setForm(prev => ({ ...prev, discount: value }))
                  }
                }}
                className={` ${!form.restaurant ? 'bg-slate-200 cursor-not-allowed' : 'bg-white'} w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100`}
                placeholder="0.00"
                inputMode="decimal"
              />
              {formErrors.discount && <p className="mt-1 text-xs text-red-600">{formErrors.discount}</p>}
            </div>

            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 font-display">Calculated total</p>
              <div className="mt-2 space-y-1">
                <p className="text-sm text-slate-600">Gross Amount: <span className="font-semibold text-slate-800">{formatCurrency(grossAmount)}</span></p>
                <p className="text-sm text-slate-600">Net Amount: <span className="font-semibold text-slate-800">{formatCurrency(netAmount)}</span></p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => { setIsModalOpen(false); resetForm(); }} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
              <button type="button" onClick={handleProceed} className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display">Proceed</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 w-full">
            <p className="text-sm text-slate-500">Please confirm the information before proceeding</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Item</p>
                <p className="mt-1 text-sm font-semibold text-slate-800 font-display">{previewSale?.item}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Food Cost</p>
                <p className="mt-1 text-sm font-semibold text-slate-800 font-display">{previewSale ? formatCurrency(Number(previewSale.foodCost)) : ''}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Number of Sales</p>
                <p className="mt-1 text-sm font-semibold text-slate-800 font-display">{previewSale?.numberOfSales}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Category</p>
                <p className="mt-1 text-sm font-semibold text-slate-800 font-display">{previewSale?.category}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Discount</p>
                <p className="mt-1 text-sm font-semibold text-slate-800 font-display">{previewSale ? formatCurrency(Number(previewSale.discount || 0)) : ''}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Gross Amount</p>
                <p className="mt-1 text-sm font-semibold text-slate-800 font-display">{previewSale ? formatCurrency(Number(previewSale.foodCost || 0) * Number(previewSale.numberOfSales || 0)) : ''}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3 sm:col-span-2">
                <p className="text-xs text-slate-500">Net Amount</p>
                <p className="mt-1 text-sm font-semibold text-slate-800 font-display">{previewSale ? formatCurrency(Math.max(Number(previewSale.foodCost || 0) * Number(previewSale.numberOfSales || 0) - Number(previewSale.discount || 0), 0)) : ''}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setPreviewSale(null)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Back</button>
              <button type="button" onClick={handleConfirm} className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display">{editingSale ? 'Confirm Sale' : 'Add Sale'}</button>
            </div>
          </div>
        )}
      </Modal>

      {deleteSaleTarget && (
        <Modal open={!!deleteSaleTarget} title="Confirm deletion" onClose={() => setDeleteSaleTarget(null)}>
          <div className="w-full p-2">
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to delete <span className="font-semibold text-slate-700">{deleteSaleTarget.item}</span>?
            </p>
            <p className="text-xs text-slate-500 mb-4">This action cannot be undone.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={returnIngredientsStock}
                  onChange={e => setReturnIngredientsStock(e.target.checked)}
                  className="rounded bg-slate-200 p-1 focus:ring-indigo-500"
                />
                Return the ingredients stock
              </label>
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setDeleteSaleTarget(null)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
              <button
                type="button"
                onClick={handleDeleteSale}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg font-display"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </Modal>
      )}

      {selectedSale && (
        <Modal open={!!selectedSale} title={selectedSale.item} onClose={() => setSelectedSale(null)}>
          <div className="space-y-3 w-full max-w-md">
            <div className="grid grid-cols-2 gap-3 w-md">
              <div>
                <p className="text-xs text-slate-400">Cost</p>
                <p className="text-sm font-medium">{formatCurrency(selectedSale.cost)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Number of Sales</p>
                <p className="text-sm font-medium">{selectedSale.numberOfSales}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Discount</p>
                <p className="text-sm font-medium">{formatCurrency(selectedSale.discount)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Category</p>
                <p className="text-sm font-medium">{selectedSale.category}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Created</p>
                <p className="text-sm font-medium">
                    {new Date(selectedSale.createdAt).toLocaleDateString()}
                </p>
              </div>
              </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => handleDelete(selectedSale)} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-red-700 hover:bg-red-600 rounded-lg">
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
