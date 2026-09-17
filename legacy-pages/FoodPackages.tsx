'use client'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Trash2, Pencil, Search, Plus, Archive, ArchiveRestore, List } from 'lucide-react'
import Modal from '../components/Modal'
import PaginationFooter from '../components/PaginationFooter'
import useIsMobile from '../hooks/isMobile'
import { useApp } from '../App'
import { useRealtimeEntity } from '../hooks/useRealtimeEntity'

const PACKAGE_TYPES = ['catering_package', 'menu_bundle'] as const
const packageTabs = [
  { key: 'catering_package', label: 'Packages' },
  { key: 'menu_bundle', label: 'Bundles' },
] as const

type PackageType = typeof PACKAGE_TYPES[number]

interface PackForm { name: string; price: string; restaurant: string; type: PackageType }
const emptyForm = (type: PackageType = 'catering_package'): PackForm => ({
  name: '',
  price: '0.00',
  restaurant: 'Lakay Ago',
  type,
})

const getErrors = (f: PackForm) => {
  const e: Partial<Record<keyof PackForm, string>> = {}
  if (!f.name.trim()) e.name = 'Name is required.'
  if (f.price === '' || Number.isNaN(Number(f.price)) || Number(f.price) < 0) e.price = 'Price must be a non-negative number.'
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

export function SkeletonTableRows({ columns, rows = 6, columnConfig, mobile = false }: SkeletonTableRowsProps) {
  // The mobile card list renders outside a <table>, so rows must be divs here —
  // a <tr> inside a <div> is invalid HTML and breaks hydration.
  if (mobile) {
    return (
      <div className="flex flex-col">
        {Array.from({ length: rows }, (_, rowIdx) => (
          <div key={rowIdx} className="border-b border-slate-100 p-3 flex items-center justify-between gap-3">
            <div className="flex-1 space-y-2">
              <SkeletonBar width={columnConfig?.[0]?.width ?? "60%"} height="0.85rem" rounded="rounded-md" />
              <SkeletonBar width={columnConfig?.[1]?.width ?? "30%"} height="0.7rem" rounded="rounded-md" />
            </div>
            <SkeletonBar width={columnConfig?.[2]?.width ?? "24%"} height="0.85rem" rounded="rounded-md" />
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

export default function FoodPackages() {
  const isMobile = useIsMobile()
  const { showToast } = useApp()
  const [activeType, setActiveType] = useState<PackageType>('catering_package')
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [archiveConfirmTarget, setArchiveConfirmTarget] = useState<any | null>(null)
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<any | null>(null)
  // Which action is currently writing to the DB ('save' | 'delete' | 'archive' | 'restore' | 'add') — disables the related buttons
  const [savingAction, setSavingAction] = useState<string | null>(null)
  // Selected Package/Bundle details modal — shows the name and its items
  const [viewItem, setViewItem] = useState<any | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<PackForm>(emptyForm('catering_package'))
  const [errors, setErrors] = useState<Partial<Record<keyof PackForm, string>>>({})
  const [editingId, setEditingId] = useState<number | null>(null)
  const [bundleRowsModal, setBundleRowsModal] = useState<any[]>([])
  const [bundleOptionsModal, setBundleOptionsModal] = useState<any[]>([])
  const [bundleItemSelect, setBundleItemSelect] = useState('')
  const [bundleItemQty, setBundleItemQty] = useState('1')
  const [menuItemsRowsModal, setMenuItemsRowsModal] = useState<any[]>([])
  const [menuItemsOptionsModal, setMenuItemsOptionsModal] = useState<any[]>([])
  const [menuItemSelect, setMenuItemSelect] = useState('')
  const [menuItemQty, setMenuItemQty] = useState('1')
  const [lakayPage, setLakayPage] = useState(1)
  const [arooPage, setArooPage] = useState(1)

  const tabContainerRef = useRef<HTMLDivElement>(null)
  const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [tabIndicator, setTabIndicator] = useState({ x: 0, width: 0 })

  const measureTabIndicator = () => {
    const btn = tabButtonRefs.current[activeType]
    const container = tabContainerRef.current
    if (!btn || !container) return
    const containerRect = container.getBoundingClientRect()
    const btnRect = btn.getBoundingClientRect()
    setTabIndicator({ x: btnRect.left - containerRect.left, width: btnRect.width })
  }

  useLayoutEffect(() => {
    measureTabIndicator()
  }, [activeType])

  useEffect(() => {
    window.addEventListener('resize', measureTabIndicator)
    return () => window.removeEventListener('resize', measureTabIndicator)
  }, [activeType])

  const filtered = useMemo(() => {
    return items.filter((pkg) => {
      const matchesType = (pkg.type ?? activeType) === activeType
      const matchesSearch = pkg.name.toLowerCase().includes(search.toLowerCase())
      // Exclusive match: Archived view shows ONLY archived rows, Active view shows ONLY non-archived rows.
      const matchesArchive = showArchived ? Boolean(pkg.is_archived) : !pkg.is_archived
      return matchesType && matchesSearch && matchesArchive
    })
  }, [items, search, showArchived, activeType])

  const loadPackages = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('type', activeType)
      if (showArchived) params.set('includeArchived', 'true')
      const res = await fetch(`/api/food_packages?${params.toString()}`)
      if (!res.ok) throw new Error('Load failed')
      const j = await res.json()
      setItems(j.packages || [])
    } catch (err) {
      console.error('Failed to load packages', err)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [activeType, showArchived])

  useEffect(() => {
    void loadPackages()
  }, [loadPackages])

  // Live updates: refetch whenever any user creates, edits, or archives a package or bundle.
  // Package items are rewritten in the same API request, so refetching here always
  // returns the fresh item list. The page shows both restaurants, so subscribe
  // without a restaurant filter.
  useRealtimeEntity('food_packages', {
    restaurant: 'Both',
    onChange: loadPackages,
  })

  const fetchBundleOptions = (restaurant: string) => {
    fetch(`/api/food_and_beverage?restaurant=${encodeURIComponent(restaurant)}`)
      .then((r) => r.json())
      .then((j) => {
        setBundleOptionsModal(j.items || [])
        setMenuItemsOptionsModal(j.items || [])
      })
      .catch(() => {
        setBundleOptionsModal([])
        setMenuItemsOptionsModal([])
      })
  }

  useEffect(() => {
    if (!showModal) return
    fetchBundleOptions(form.restaurant)
  }, [showModal, form.restaurant])

  const lakayAgoItems = filtered.filter(i => i.restaurant === 'Lakay Ago')
  const arooItems = filtered.filter(i => i.restaurant === 'Aroo')
  const pageSize = 10
  const lakayPageTotal = Math.max(1, Math.ceil(lakayAgoItems.length / pageSize))
  const arooPageTotal = Math.max(1, Math.ceil(arooItems.length / pageSize))
  const paginatedLakayItems = lakayAgoItems.slice((lakayPage - 1) * pageSize, lakayPage * pageSize)
  const paginatedArooItems = arooItems.slice((arooPage - 1) * pageSize, arooPage * pageSize)

  const lakayEmptyCount = paginatedLakayItems.length === 0 ? 0 : Math.max(0, pageSize - paginatedLakayItems.length)
  const arooEmptyCount = paginatedArooItems.length === 0 ? 0 : Math.max(0, pageSize - paginatedArooItems.length)

  useEffect(() => { setLakayPage(1) }, [search, showArchived, activeType, items.length])
  useEffect(() => { setArooPage(1) }, [search, showArchived, activeType, items.length])

  const renderRestaurantTable = (title: string, displayItems: typeof filtered, totalItems: typeof filtered, currentPage: number, totalPages: number, setPage: (value: number | ((prev: number) => number)) => void, emptyCount: number) => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6" style={{ display: loading || totalItems.length > 0 ? 'block' : 'none' }}>
      {isMobile ? (
        <div className="px-4 py-3 border-b border-slate-200 bg-indigo-600 text-white">
          <h3 className="text-sm font-semibold">{title} {activeType === 'menu_bundle' ? 'Bundles' : 'Packages'}</h3>
        </div>
      ) : (
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h3 className="text-sm font-semibold">{title} {activeType === 'menu_bundle' ? 'Bundles' : 'Packages'}</h3>
        </div>
      )}
      
      {!isMobile ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="text-xs border-b border-slate-200 uppercase bg-indigo-600 text-white">
              <tr>
                <th className="py-3 px-4 text-left">Name</th>
                <th className="py-3 px-4 text-center">Price</th>
                <th className="py-3 px-4 text-center">Items</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <SkeletonTableRows
                  columns={4}
                  rows={6}
                  columnConfig={[
                    { width: "70%" },
                    { width: "40%" },
                    { width: "30%" },
                    { width: "50%" },
                  ]}
                />
              ) : items.length === 0 ? (
                <tr><td colSpan={4} className="p-6 text-center text-sm text-slate-400">No {activeType === 'menu_bundle' ? 'bundles' : 'packages'} found.</td></tr>
              ) : displayItems.map((pkg) => (
                <tr
                  key={pkg.food_package_id}
                  className={pkg.is_archived ? 'bg-slate-50 opacity-75 cursor-pointer hover:bg-slate-50' : 'cursor-pointer hover:bg-slate-50'}
                  onClick={() => setViewItem(pkg)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setViewItem(pkg)
                    }
                  }}
                >
                  <td className="py-3 px-4 font-medium text-slate-800">{pkg.name}</td>
                  <td className="py-3 px-4 text-center font-mono text-sm text-slate-700">{new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(pkg.price || 0))}</td>
                  <td className="py-3 px-4 text-center text-sm text-slate-600">{pkg.item_count ?? (Array.isArray(pkg.items) ? pkg.items.length : 0)}</td>
                  <td className="py-3 px-4 text-center text-sm" onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center justify-center gap-2">
                      <button type="button" onClick={() => openEdit(pkg)} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"><Pencil size={14} /> Edit</button>
                      <button type="button" onClick={() => openPackageEditor(pkg)} className="text-xs font-medium text-slate-700 hover:text-slate-900 hover:underline flex items-center gap-1"><List size={14} /> Items</button>
                      {pkg.is_archived ? (
                        <button type="button" onClick={() => toggleArchivePackage(pkg)} className="text-xs font-medium text-emerald-600 hover:text-emerald-800 hover:underline flex items-center gap-1"><ArchiveRestore size={14} /> Restore</button>
                      ) : (
                        <button type="button" onClick={() => setArchiveConfirmTarget(pkg)} className="text-xs font-medium text-violet-500 hover:text-violet-600 hover:underline flex items-center gap-1"><Archive size={14} /> Archive</button>
                      )}
                      <button type="button" onClick={() => setDeleteConfirmTarget(pkg)} className="text-xs font-medium text-red-600 hover:text-red-800 hover:underline flex items-center gap-1"><Trash2 size={14} /> Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {emptyCount > 0 && (
                Array.from({ length: emptyCount }).map((_, i) => (
                  <tr key={`empty-${i}`} className="invisible">
                    <td className="py-3 px-4 font-medium text-slate-800">Placeholder</td>
                    <td className="py-3 px-4 text-center font-mono text-sm text-slate-700">PHP 0.00</td>
                    <td className="py-3 px-4 text-center text-sm text-slate-600">0</td>
                    <td className="py-3 px-4 text-center text-sm">
                      <div className="flex items-center justify-center gap-2">
                        <button type="button" className="invisible">Edit</button>
                        <button type="button" className="invisible">Items</button>
                        <button type="button" className="invisible">Archive</button>
                        <button type="button" className="invisible">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div>
          {loading ? (
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
          ) : totalItems.length === 0 ? (
            <div className="p-4 text-sm text-slate-400">No {activeType === 'menu_bundle' ? 'bundles' : 'packages'} found.</div>
          ) : displayItems.map((pkg) => (
            <button
              key={pkg.food_package_id}
              type="button"
              onClick={() => setViewItem(pkg)}
              className="w-full text-left p-3 border-b border-slate-200 hover:bg-slate-50 flex items-center justify-between gap-3"
            >
              <div>
                <div className="font-semibold text-slate-800">{pkg.name}</div>
                <div className="text-xs text-slate-500">{pkg.item_count ?? (Array.isArray(pkg.items) ? pkg.items.length : 0)} items</div>
                
              </div>
              <div className="flex flex-col items-end gap-1 text-xs">
                <div className="mt-1 text-xs font-mono text-slate-600">{new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(pkg.price || 0))}</div>
              </div>
            </button>
          ))}
        </div>
      )}
      <PaginationFooter items={totalItems} page={currentPage} setPage={setPage} pageSize={pageSize} noun="packages" />
    </div>
  )

  const addBundleRow = (foodAndBeverageId: string, quantity: string) => {
    const menuId = Number(foodAndBeverageId)
    const qty = Number(quantity)
    if (!Number.isFinite(menuId) || menuId <= 0 || !Number.isFinite(qty) || qty <= 0) return

    const item = bundleOptionsModal.find((option) => Number(option.food_and_beverage_id) === menuId)
    if (!item) return

    setBundleRowsModal((prev) => {
      const existingIndex = prev.findIndex((row) => Number(row.food_and_beverage_id) === menuId)
      if (existingIndex >= 0) {
        const next = [...prev]
        next[existingIndex] = { ...next[existingIndex], quantity: Number(next[existingIndex].quantity) + qty, name: item.name }
        return next
      }
      return [...prev, { food_and_beverage_id: menuId, quantity: qty, name: item.name }]
    })
  }

  const removeBundleRow = (foodAndBeverageId: number) => {
    setBundleRowsModal((prev) => prev.filter((row) => Number(row.food_and_beverage_id) !== Number(foodAndBeverageId)))
  }

  const addMenuItemRow = (foodAndBeverageId: string, quantity: string) => {
    const menuId = Number(foodAndBeverageId)
    const qty = Number(quantity)
    if (!Number.isFinite(menuId) || menuId <= 0 || !Number.isFinite(qty) || qty <= 0) return

    const item = menuItemsOptionsModal.find((option) => Number(option.food_and_beverage_id) === menuId)
    if (!item) return

    setMenuItemsRowsModal((prev) => {
      const existingIndex = prev.findIndex((row) => Number(row.food_and_beverage_id) === menuId)
      if (existingIndex >= 0) {
        const next = [...prev]
        next[existingIndex] = { ...next[existingIndex], quantity: Number(next[existingIndex].quantity) + qty, name: item.name }
        return next
      }
      return [...prev, { food_and_beverage_id: menuId, quantity: qty, name: item.name }]
    })
  }

  const removeMenuItemRow = (foodAndBeverageId: number) => {
    setMenuItemsRowsModal((prev) => prev.filter((row) => Number(row.food_and_beverage_id) !== Number(foodAndBeverageId)))
  }

  const handleSave = () => {
    if (savingAction) return
    const next = getErrors(form)
    if (Object.keys(next).length) { setErrors(next); return }

    const payload = {
      name: form.name.trim(),
      price: Number(form.price),
      restaurant: form.restaurant,
      type: form.type,
      items: form.type === 'menu_bundle'
        ? bundleRowsModal.map((row) => ({
            food_and_beverage_id: Number(row.food_and_beverage_id),
            quantity: Number(row.quantity),
          }))
        : menuItemsRowsModal.map((row) => ({
            food_and_beverage_id: Number(row.food_and_beverage_id),
            quantity: Number(row.quantity),
          })),
    }
    setSavingAction('save')

    if (editingId) {
      fetch('/api/food_packages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ food_package_id: editingId, ...payload }),
      })
        .then(async (r) => {
          const json = await r.json().catch(() => ({}))
          if (!r.ok) throw new Error(json.error || 'Update failed')
          setItems((prev) => prev.map((item) => item.food_package_id === json.package.food_package_id ? json.package : item))
          showToast({ type: 'success', message: activeType === 'menu_bundle' ? 'Bundle updated' : 'Package updated', description: json.package.name })
          setShowModal(false)
          setEditingId(null)
          setForm(emptyForm(activeType))
        })
        .catch((err) => showToast({ type: 'error', message: activeType === 'menu_bundle' ? 'Failed to update bundle' : 'Failed to update package', description: err.message }))
        .finally(() => setSavingAction(null))
    } else {
      fetch('/api/food_packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(async (r) => {
          const json = await r.json().catch(() => ({}))
          if (!r.ok) throw new Error(json.error || 'Create failed')
          setItems((prev) => [json.package, ...prev])
          showToast({ type: 'success', message: activeType === 'menu_bundle' ? 'Bundle saved' : 'Package saved', description: json.package.name })
          setShowModal(false)
          setForm(emptyForm(activeType))
        })
        .catch((err) => showToast({ type: 'error', message: activeType === 'menu_bundle' ? 'Failed to save bundle' : 'Failed to save package', description: err.message }))
        .finally(() => setSavingAction(null))
    }
  }

  const [pkgOpen, setPkgOpen] = useState(false)
  const [pkgRows, setPkgRows] = useState<any[]>([])
  const [pkgLoading, setPkgLoading] = useState(false)
  const [menuOptions, setMenuOptions] = useState<any[]>([])
  const [activePkg, setActivePkg] = useState<any | null>(null)

  const openPackageEditor = async (pkg: any) => {
    setActivePkg(pkg)
    setPkgOpen(true)
    setPkgLoading(true)
    try {
      const [rRes, mRes] = await Promise.all([
        fetch(`/api/food_package_items?food_package_id=${pkg.food_package_id}`),
        fetch('/api/food_and_beverage'),
      ])
      if (rRes.ok) {
        const jr = await rRes.json()
        setPkgRows(jr.items || [])
      } else {
        setPkgRows([])
      }
      if (mRes.ok) {
        const jm = await mRes.json()
        setMenuOptions(jm.items || [])
      } else {
        setMenuOptions([])
      }
    } catch (err) {
      setPkgRows([])
      setMenuOptions([])
    } finally {
      setPkgLoading(false)
    }
  }

  const addPackageItem = async (foodAndBeverageId: string, quantity: string) => {
    if (!activePkg || !foodAndBeverageId || !quantity) return
    if (savingAction) return
    setSavingAction('add')
    try {
      const res = await fetch('/api/food_package_items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ food_package_id: activePkg.food_package_id, food_and_beverage_id: foodAndBeverageId, quantity: Number(quantity) }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Failed to add item')
      }
      const j = await res.json()
      setPkgRows((prev) => [j.item, ...prev])
      showToast({ type: 'success', message: 'Package item added' })
    } catch (err: any) {
      showToast({ type: 'error', message: 'Failed to add package item', description: err.message })
    } finally {
      setSavingAction(null)
    }
  }

  const removePackageItem = async (id: number) => {
    if (savingAction) return
    setSavingAction('delete')
    try {
      const res = await fetch(`/api/food_package_items?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setPkgRows((prev) => prev.filter((row) => String(row.food_package_item_id) !== String(id)))
      showToast({ type: 'success', message: 'Package item removed' })
    } catch (err: any) {
      showToast({ type: 'error', message: 'Failed to remove package item', description: err.message })
    } finally {
      setSavingAction(null)
    }
  }

  const openEdit = (item: any) => {
    setEditingId(item.food_package_id)
    setForm({
      name: item.name || '',
      price: String(item.price ?? '0.00'),
      restaurant: item.restaurant || 'Lakay Ago',
      type: item.type || activeType,
    })
    if (item.type === 'menu_bundle') {
      setBundleRowsModal((item.items || []).map((row: any) => ({
        food_and_beverage_id: Number(row.food_and_beverage_id),
        quantity: Number(row.quantity ?? 1),
        name: row.name || row.menu_name || 'Menu item',
      })))
      setMenuItemsRowsModal([])
    } else {
      setBundleRowsModal([])
      setMenuItemsRowsModal((item.items || []).map((row: any) => ({
        food_and_beverage_id: Number(row.food_and_beverage_id),
        quantity: Number(row.quantity ?? 1),
        name: row.name || row.menu_name || 'Menu item',
      })))
    }
    setBundleItemSelect('')
    setBundleItemQty('1')
    setMenuItemSelect('')
    setMenuItemQty('1')
    setErrors({})
    setShowModal(true)
  }

  const toggleArchivePackage = async (item: any) => {
    const nextArchived = !item.is_archived
    setSavingAction(nextArchived ? 'archive' : 'restore')
    try {
      const res = await fetch('/api/food_packages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ food_package_id: item.food_package_id, is_archived: nextArchived }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Archive toggle failed')
      setItems((prev) => prev.map((pkg) => pkg.food_package_id === item.food_package_id ? json.package : pkg))
      showToast({ type: 'success', message: nextArchived ? (activeType === 'menu_bundle' ? 'Bundle archived' : 'Package archived') : (activeType === 'menu_bundle' ? 'Bundle restored' : 'Package restored') })
    } catch (err: any) {
      showToast({ type: 'error', message: activeType === 'menu_bundle' ? 'Failed to update bundle status' : 'Failed to update package status', description: err.message })
    } finally {
      setSavingAction(null)
    }
  }

  const confirmArchivePackage = async () => {
    const item = archiveConfirmTarget
    if (!item || savingAction) return
    await toggleArchivePackage(item)
    setArchiveConfirmTarget(null)
  }

  const deletePackage = async () => {
    const item = deleteConfirmTarget
    if (!item || savingAction) return
    setSavingAction('delete')
    try {
      const res = await fetch(`/api/food_packages?id=${item.food_package_id}&hard_delete=true`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Delete failed')
      setItems((prev) => prev.filter((pkg) => pkg.food_package_id !== item.food_package_id))
      showToast({ type: 'success', message: activeType === 'menu_bundle' ? 'Bundle deleted' : 'Package deleted', description: item.name })
      setDeleteConfirmTarget(null)
    } catch (err: any) {
      showToast({ type: 'error', message: activeType === 'menu_bundle' ? 'Failed to delete bundle' : 'Failed to delete package', description: err.message })
    } finally {
      setSavingAction(null)
    }
  }

  const [editingPkgItemId, setEditingPkgItemId] = useState<number | null>(null)
  const [editingPkgItemQty, setEditingPkgItemQty] = useState<string>('')

  const savePkgItemEdit = async (id: number) => {
    if (savingAction) return
    setSavingAction('save')
    try {
      const res = await fetch('/api/food_package_items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ food_package_item_id: id, quantity: Number(editingPkgItemQty) }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Update failed')
      setPkgRows((prev) => prev.map((row) => (String(row.food_package_item_id) === String(id) ? json.item : row)))
      setEditingPkgItemId(null)
      setEditingPkgItemQty('')
      showToast({ type: 'success', message: 'Package item updated' })
    } catch (err: any) {
      showToast({ type: 'error', message: 'Failed to update package item', description: err.message })
    } finally {
      setSavingAction(null)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">{activeType === 'menu_bundle' ? 'Food Bundles' : 'Food Packages'}</h2>
          <p className="text-sm text-slate-500">{activeType === 'menu_bundle' ? 'Create and manage food bundles for menu items' : 'Create and manage food packages for services.'}</p>
        </div>
        <button onClick={() => {
          setForm(emptyForm(activeType));
          setErrors({});
          setEditingId(null);
          setBundleRowsModal([]);
          setMenuItemsRowsModal([]);
          setBundleItemSelect('');
          setBundleItemQty('1');
          setMenuItemSelect('');
          setMenuItemQty('1');
          setShowModal(true)
        }} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm">
          <Plus size={14} /> {activeType === 'menu_bundle' ? 'Add Bundle' : 'Add Package'}
        </button>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div ref={tabContainerRef} className="relative flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <div
            className="absolute inset-y-1 left-0 rounded-lg bg-indigo-600 shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform"
            style={{
              width: tabIndicator.width,
              transform: `translate3d(${tabIndicator.x}px, 0, 0)`,
            }}
          />

          {packageTabs.map((tab) => (
            <button
              key={tab.key}
              ref={(el) => { tabButtonRefs.current[tab.key] = el }}
              type="button"
              onClick={() => setActiveType(tab.key as PackageType)}
              className={`relative z-10 flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-300 ${
                activeType === tab.key ? 'text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-5 flex flex-col md:flex-row gap-3">
        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 flex-1 focus-within:border-indigo-400">
          <Search size={14} className="text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${activeType === 'menu_bundle' ? 'bundle' : 'package'} name...`} className="w-full outline-none text-sm" />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={showArchived ? 'archived' : 'active'}
            onChange={e => setShowArchived(e.target.value === 'archived')}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 font-display text-slate-600"
          >
            <option value="active">Active {activeType === 'menu_bundle' ? 'Bundles' : 'Packages'}</option>
            <option value="archived">Archived {activeType === 'menu_bundle' ? 'Bundles' : 'Packages'}</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {renderRestaurantTable('Lakay Ago', paginatedLakayItems, lakayAgoItems, lakayPage, lakayPageTotal, setLakayPage, lakayEmptyCount)}
        {renderRestaurantTable('Aroo', paginatedArooItems, arooItems, arooPage, arooPageTotal, setArooPage, arooEmptyCount)}
      </div>
      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
          <p className="text-sm text-slate-400">No {activeType === 'menu_bundle' ? 'bundles' : 'packages'} found.</p>
        </div>
      )}

      <Modal
        open={showModal}
        title={editingId ? `Edit ${activeType === 'menu_bundle' ? 'Bundle' : 'Package'}` : `Add ${activeType === 'menu_bundle' ? 'Bundle' : 'Package'}`}
        onClose={() => { setShowModal(false); setEditingId(null); setForm(emptyForm(activeType)); setErrors({}); setBundleRowsModal([]); setMenuItemsRowsModal([]); setBundleOptionsModal([]); setMenuItemsOptionsModal([]); setBundleItemSelect(''); setBundleItemQty('1'); setMenuItemSelect(''); setMenuItemQty('1') }}
        className="max-w-3xl! w-full"
      >
        <div className="w-full flex flex-col max-h-[60vh] px-2">
          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 min-h-0 pr-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 ml-2">
              {/* LEFT COLUMN — form fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">{activeType === 'menu_bundle' ? 'Bundle' : 'Package'} name</label>
                  <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
                </div>

                <div className={`${isMobile ? 'grid grid-cols-2 gap-2' : ''}`}>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Price</label>
                    <input value={form.price} onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                    {errors.price && <p className="mt-1 text-xs text-red-600">{errors.price}</p>}
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Restaurant</label>
                    <select value={form.restaurant} onChange={(e) => {
                      const nextRestaurant = e.target.value
                      setForm((prev) => ({ ...prev, restaurant: nextRestaurant }))
                      fetchBundleOptions(nextRestaurant)
                      setBundleRowsModal([])
                      setMenuItemsRowsModal([])
                    }} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                      <option value="Lakay Ago">Lakay Ago</option>
                      <option value="Aroo">Aroo</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN — bundle items / menu items, own internal scroll */}
              <div className="flex flex-col min-h-0">
                {activeType === 'menu_bundle' && (
                  <div className="flex flex-col min-h-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-slate-700">Bundle items</label>
                      <span className="text-[10px] uppercase tracking-wide text-slate-500">{bundleRowsModal.length} selected</span>
                    </div>

                  {isMobile ? (
                    <div>
                      <div>
                        <select value={bundleItemSelect} onChange={(e) => setBundleItemSelect(e.target.value)} className="w-full flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                          <option value="">Select a menu item</option>
                          {bundleOptionsModal.map((item) => (
                            <option key={item.food_and_beverage_id} value={String(item.food_and_beverage_id)}>{item.name}</option>
                          ))}
                      </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-3 mt-2">
                        <input type="number" min={1} value={bundleItemQty} onChange={(e) => setBundleItemQty(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-2 text-sm" placeholder="Qty" />
                        <button type="button" onClick={() => { if (!bundleItemSelect) return; addBundleRow(bundleItemSelect, bundleItemQty); setBundleItemSelect(''); setBundleItemQty('1') }} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg">Add</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 mb-3">
                      <select value={bundleItemSelect} onChange={(e) => setBundleItemSelect(e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                        <option value="">Select a menu item</option>
                        {bundleOptionsModal.map((item) => (
                          <option key={item.food_and_beverage_id} value={String(item.food_and_beverage_id)}>{item.name}</option>
                        ))}
                      </select>
                      <input type="number" min={1} value={bundleItemQty} onChange={(e) => setBundleItemQty(e.target.value)} className="w-20 border border-slate-200 rounded-lg px-2 py-2 text-sm" placeholder="Qty" />
                      <button type="button" onClick={() => { if (!bundleItemSelect) return; addBundleRow(bundleItemSelect, bundleItemQty); setBundleItemSelect(''); setBundleItemQty('1') }} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg">Add</button>
                    </div>
                  )}

                    <div className="space-y-2 overflow-y-auto max-h-64 pr-1">
                      {bundleRowsModal.length === 0 ? (
                        <div className="text-xs text-slate-400">No menu items selected yet.</div>
                      ) : bundleRowsModal.map((row) => (
                        <div key={row.food_and_beverage_id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <div>
                            <div className="text-sm font-medium text-slate-700">{row.name}</div>
                            <div className="text-xs text-slate-500">Qty: {row.quantity}</div>
                          </div>
                          <button type="button" onClick={() => removeBundleRow(Number(row.food_and_beverage_id))} className="text-red-600 text-xs">Remove</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeType === 'catering_package' && (
                  <div className={`${isMobile ? '' : 'flex flex-col'} min-h-0 rounded-xl border border-slate-200 bg-slate-50 p-3`}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-slate-700">Menu items</label>
                      <span className="text-[10px] uppercase tracking-wide text-slate-500">{menuItemsRowsModal.length} selected</span>
                    </div>
                    
                    {isMobile ? (
                      <div className="border-b border-slate-200 mb-3">
                        <div>
                          <select value={menuItemSelect} onChange={(e) => setMenuItemSelect(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                            <option value="">Select a menu item</option>
                            {menuItemsOptionsModal.map((item) => (
                              <option key={item.food_and_beverage_id} value={String(item.food_and_beverage_id)}>{item.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-3 mt-2">
                          <div className="w-full">
                            <input type="number" min={1} value={menuItemQty} onChange={(e) => setMenuItemQty(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-2 text-sm" placeholder="Qty" />
                          </div>
                          <div className="flex flex-col">
                            <button type="button" onClick={() => { if (!menuItemSelect) return; addMenuItemRow(menuItemSelect, menuItemQty); setMenuItemSelect(''); setMenuItemQty('1') }} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg">Add</button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex gap-2 mb-3">
                          <select value={menuItemSelect} onChange={(e) => setMenuItemSelect(e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                            <option value="">Select a menu item</option>
                            {menuItemsOptionsModal.map((item) => (
                              <option key={item.food_and_beverage_id} value={String(item.food_and_beverage_id)}>{item.name}</option>
                            ))}
                          </select>
                          <input type="number" min={1} value={menuItemQty} onChange={(e) => setMenuItemQty(e.target.value)} className="w-20 border border-slate-200 rounded-lg px-2 py-2 text-sm" placeholder="Qty" />
                          <button type="button" onClick={() => { if (!menuItemSelect) return; addMenuItemRow(menuItemSelect, menuItemQty); setMenuItemSelect(''); setMenuItemQty('1') }} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg">Add</button>
                        </div>
                      </div>
                    )}
                    

                    <div className="space-y-2 overflow-y-auto max-h-64 pr-1">
                      {menuItemsRowsModal.length === 0 ? (
                        <div className="text-xs text-slate-400">No menu items selected yet.</div>
                      ) : menuItemsRowsModal.map((row) => (
                        <div key={row.food_and_beverage_id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <div>
                            <div className="text-sm font-medium text-slate-700">{menuItemsOptionsModal.find((m) => String(m.food_and_beverage_id) === String(row.food_and_beverage_id))?.name || `Item ${row.food_and_beverage_id}`}</div>
                            <div className="text-xs text-slate-500">Qty: {row.quantity}</div>
                          </div>
                          <button type="button" onClick={() => removeMenuItemRow(Number(row.food_and_beverage_id))} className="text-red-600 text-xs">Remove</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer — outside scroll area, always visible */}
          <div className="flex justify-end gap-2 pt-3 mt-3 border-t border-slate-200">
            <button type="button" onClick={() => { setShowModal(false); setEditingId(null); setForm(emptyForm(activeType)); setErrors({}); setBundleRowsModal([]); setMenuItemsRowsModal([]); setBundleOptionsModal([]); setMenuItemsOptionsModal([]); setBundleItemSelect(''); setBundleItemQty('1'); setMenuItemSelect(''); setMenuItemQty('1') }} className="px-4 py-2 text-sm border rounded-lg text-slate-600 hover:bg-slate-200">Cancel</button>
            <button type="button" onClick={handleSave} disabled={Boolean(savingAction)} className={`px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg ${savingAction ? 'opacity-40 cursor-not-allowed' : ''}`}>{savingAction === 'save' ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </Modal>

      <Modal open={pkgOpen} title={activePkg ? `${activePkg.name} items` : 'Package items'} onClose={() => { setPkgOpen(false); setActivePkg(null); setPkgRows([]); setMenuOptions([]) }}>
        <div className="space-y-4 w-full">
          <div className="flex gap-2">
            <select id="package-menu-select" className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white flex-1">
              <option value="">Select menu item</option>
              {menuOptions.map((item) => (
                <option key={item.food_and_beverage_id} value={item.food_and_beverage_id}>{item.name}</option>
              ))}
            </select>
            <input id="package-qty-input" type="number" min={1} className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Qty" />
            <button type="button" onClick={() => {
              const select = document.getElementById('package-menu-select') as HTMLSelectElement | null
              const qty = document.getElementById('package-qty-input') as HTMLInputElement | null
              if (!select || !qty) return
              void addPackageItem(select.value, qty.value)
              qty.value = ''
              select.value = ''
            }} disabled={Boolean(savingAction)} className={`px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg ${savingAction ? 'opacity-40 cursor-not-allowed' : ''}`}>{savingAction === 'add' ? 'Adding…' : 'Add'}</button>
          </div>

          <div className="space-y-2">
            {pkgLoading ? (
              <div className="text-sm text-slate-400">Loading package items...</div>
            ) : pkgRows.length === 0 ? (
              <div className="text-sm text-slate-400">No items in this {activeType === 'menu_bundle' ? 'bundle' : 'package'} yet.</div>
            ) : pkgRows.map((row) => (
              <div key={row.food_package_item_id} className="flex items-center justify-between gap-3 border border-slate-200 rounded-lg px-3 py-2">
                <div>
                  <div className="text-sm font-medium text-slate-700">{menuOptions.find((m) => String(m.food_and_beverage_id) === String(row.food_and_beverage_id))?.name || `Item ${row.food_and_beverage_id}`}</div>
                  <div className="text-xs text-slate-500">{editingPkgItemId === row.food_package_item_id ? (
                    <input value={editingPkgItemQty} onChange={(e) => setEditingPkgItemQty(e.target.value)} className="border border-slate-200 rounded px-2 py-1 mt-1 text-xs" />
                  ) : `Qty: ${row.quantity}`}</div>
                </div>
                <div className="flex items-center gap-2">
                  {editingPkgItemId === row.food_package_item_id ? (
                    <>
                      <button type="button" onClick={() => void savePkgItemEdit(row.food_package_item_id)} disabled={Boolean(savingAction)} className={`text-indigo-600 text-sm ${savingAction ? 'opacity-40 cursor-not-allowed' : ''}`}>{savingAction === 'save' ? 'Saving…' : 'Save'}</button>
                      <button type="button" onClick={() => { setEditingPkgItemId(null); setEditingPkgItemQty('') }} className="text-slate-600 text-sm">Cancel</button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => { setEditingPkgItemId(row.food_package_item_id); setEditingPkgItemQty(String(row.quantity)) }} className="text-slate-600"><Pencil size={14} /></button>
                      <button type="button" onClick={() => void removePackageItem(row.food_package_item_id)} disabled={Boolean(savingAction)} className={`text-red-600 ${savingAction ? 'opacity-40 cursor-not-allowed' : ''}`}>{savingAction === 'delete' ? 'Deleting…' : <Trash2 size={14} />}</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {viewItem && (
        <Modal
          open={!!viewItem}
          title={viewItem.type === 'menu_bundle' ? `${viewItem.name} Bundle` : `Selected ${viewItem.name} Package`}
          onClose={() => setViewItem(null)}
        >
          <div className="w-full p-2">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-slate-800 font-display">{viewItem.name}</h3>
              <div className="text-sm font-mono text-slate-600 mt-0.5">
                {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(viewItem.price || 0))}
              </div>
            </div>

            <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Items</div>
            <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
              {(viewItem.items || []).length === 0 ? (
                <div className="text-sm text-slate-400">No items in this {viewItem.type === 'menu_bundle' ? 'bundle' : 'package'}.</div>
              ) : (
                (viewItem.items || []).map((row: any, idx: number) => (
                  <div key={row.food_and_beverage_id ?? idx} className="flex items-center justify-between gap-3 border border-slate-200 rounded-lg px-3 py-2">
                    <div className="text-sm text-slate-700">{row.name || row.menu_name || `Item ${row.food_and_beverage_id}`}</div>
                    <div className="text-xs text-slate-500 shrink-0">Qty: {row.quantity ?? 1}</div>
                  </div>
                ))
              )}
            </div>

            <div className={`${isMobile ? 'grid grid-cols-3 gap-2' : 'flex flex-wrap gap-3 justify-end'}`}>
              <button
                type="button"
                onClick={() => { const item = viewItem; setViewItem(null); setDeleteConfirmTarget(item) }}
                className={`${isMobile? 'text-xs' : 'text-sm'} px-4 py-2 font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg font-display flex items-center gap-1.5`}
              >
                <Trash2 size={isMobile ? 10 : 16} /> Delete
              </button>
              {viewItem.is_archived ? (
                <button
                  type="button"
                  onClick={() => { const item = viewItem; setViewItem(null); setArchiveConfirmTarget(item) }}
                  className={`${isMobile? 'text-xs' : 'text-sm'} px-4 py-2 font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-display flex items-center gap-1.5`}
                >
                  <ArchiveRestore size={isMobile ? 10 : 16} /> Restore
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { const item = viewItem; setViewItem(null); setArchiveConfirmTarget(item) }}
                  className={`${isMobile? 'text-xs' : 'text-sm'} px-4 py-2 font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-display flex items-center gap-1.5`}
                >
                  <Archive size={isMobile ? 10 : 16} /> Archive
                </button>
              )}
              <button
                type="button"
                onClick={() => { const item = viewItem; setViewItem(null); openEdit(item) }}
                className={`${isMobile? 'text-xs' : 'text-sm'} justify-center px-4 py-2  font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display flex items-center gap-1.5`}
              >
                <Pencil size={isMobile ? 10 : 16} /> Edit
              </button>
            </div>
          </div>
        </Modal>
      )}

      {archiveConfirmTarget && (
        <Modal open={!!archiveConfirmTarget} title="Confirm archive" onClose={() => setArchiveConfirmTarget(null)}>
          <div className="w-full p-2">
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to archive <span className="font-semibold text-slate-700">{archiveConfirmTarget.name}</span>?
            </p>
            <p className="text-xs text-slate-500 mb-4">It will be hidden from the active list and moved to the archived view. You can restore it later.</p>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => { if (!savingAction) setArchiveConfirmTarget(null) }} disabled={Boolean(savingAction)} className={`px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display ${savingAction ? 'opacity-40 cursor-not-allowed' : ''}`}>Cancel</button>
              <button type="button" onClick={confirmArchivePackage} disabled={Boolean(savingAction)} className={`px-4 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-display flex items-center justify-center gap-2 ${savingAction ? 'opacity-40 cursor-not-allowed' : ''}`}>{savingAction === 'archive' ? 'Archiving…' : savingAction === 'restore' ? 'Restoring…' : <><Archive size={14} /> Archive</>}</button>
            </div>
          </div>
        </Modal>
      )}

      {deleteConfirmTarget && (
        <Modal open={!!deleteConfirmTarget} title="Confirm deletion" onClose={() => setDeleteConfirmTarget(null)}>
          <div className="w-full p-2">
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to permanently delete <span className="font-semibold text-slate-700">{deleteConfirmTarget.name}</span>?
            </p>
            <p className="text-xs text-slate-500 mb-4">This action cannot be undone. Packages still referenced by sales or transactions cannot be deleted.</p>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => { if (!savingAction) setDeleteConfirmTarget(null) }} disabled={Boolean(savingAction)} className={`px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display ${savingAction ? 'opacity-40 cursor-not-allowed' : ''}`}>Cancel</button>
              <button type="button" onClick={deletePackage} disabled={Boolean(savingAction)} className={`px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg font-display flex items-center justify-center gap-2 ${savingAction ? 'opacity-40 cursor-not-allowed' : ''}`}>{savingAction === 'delete' ? 'Deleting…' : <><Trash2 size={14} /> Delete</>}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
