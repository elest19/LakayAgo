'use client'
import { useEffect, useMemo, useState } from 'react'
import { Trash2, Pencil, Search, Plus } from 'lucide-react'
import Modal from '../components/Modal'
import PaginationFooter from '../components/PaginationFooter'
import useIsMobile from '../hooks/isMobile'
import { useApp } from '../App'

const PACKAGE_TYPES = ['catering_package', 'menu_bundle'] as const

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

export default function FoodPackages() {
  const isMobile = useIsMobile()
  const { showToast } = useApp()
  const [activeType, setActiveType] = useState<PackageType>('catering_package')
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [items, setItems] = useState<any[]>([])
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

  const filtered = useMemo(() => {
    return items.filter((pkg) => {
      const matchesType = (pkg.type ?? activeType) === activeType
      const matchesSearch = pkg.name.toLowerCase().includes(search.toLowerCase())
      const matchesArchive = showArchived || !pkg.is_archived
      return matchesType && matchesSearch && matchesArchive
    })
  }, [items, search, showArchived, activeType])

  const loadPackages = async () => {
    let mounted = true
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('type', activeType)
      if (showArchived) params.set('includeArchived', 'true')
      const res = await fetch(`/api/food_packages?${params.toString()}`)
      if (!res.ok) throw new Error('Load failed')
      const j = await res.json()
      if (mounted) setItems(j.packages || [])
    } catch (err) {
      console.error('Failed to load packages', err)
      if (mounted) setItems([])
    } finally {
      if (mounted) setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    void loadPackages()
    return () => { mounted = false }
  }, [showArchived, activeType])

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
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <h3 className="text-sm font-semibold">{title} — {activeType === 'menu_bundle' ? 'Bundles' : 'Packages'}</h3>
      </div>
      {!isMobile ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="text-xs text-slate-500 uppercase">
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
                <tr key={pkg.food_package_id} className={pkg.is_archived ? 'bg-slate-50 opacity-75' : ''}>
                  <td className="py-3 px-4 font-medium text-slate-800">{pkg.name}</td>
                  <td className="py-3 px-4 text-center font-mono text-sm text-slate-700">{new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(pkg.price || 0))}</td>
                  <td className="py-3 px-4 text-center text-sm text-slate-600">{pkg.item_count ?? (Array.isArray(pkg.items) ? pkg.items.length : 0)}</td>
                  <td className="py-3 px-4 text-center text-sm">
                    <div className="flex items-center justify-center gap-2">
                      <button type="button" onClick={() => openEdit(pkg)} className="text-indigo-600 hover:text-indigo-800">Edit</button>
                      <button type="button" onClick={() => openPackageEditor(pkg)} className="text-slate-700 hover:text-slate-900">Items</button>
                      <button type="button" onClick={() => toggleArchivePackage(pkg)} className={pkg.is_archived ? 'text-emerald-600 hover:text-emerald-800' : 'text-red-600 hover:text-red-800'}>
                        {pkg.is_archived ? 'Restore' : 'Archive'}
                      </button>
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
            <div key={pkg.food_package_id} className="p-3 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-slate-800">{pkg.name}</div>
                <div className="text-xs text-slate-500">{pkg.item_count ?? (Array.isArray(pkg.items) ? pkg.items.length : 0)} items</div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => openEdit(pkg)} className="text-indigo-600 text-sm">Edit</button>
                <button type="button" onClick={() => toggleArchivePackage(pkg)} className="text-red-600 text-sm">{pkg.is_archived ? 'Restore' : 'Archive'}</button>
              </div>
            </div>
          ))}
          {emptyCount > 0 && (
            Array.from({ length: emptyCount }).map((_, i) => (
              <div key={`empty-mobile-${i}`} className="p-3 border-b border-slate-200 flex items-center justify-between gap-3 invisible">
                <div>
                  <div className="font-medium text-slate-800">Placeholder</div>
                  <div className="text-xs text-slate-500">0 items</div>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="invisible">Edit</button>
                  <button type="button" className="invisible">Archive</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
      <PaginationFooter items={totalItems} page={currentPage} setPage={setPage} pageSize={pageSize} />
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
    setLoading(true)

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
        .finally(() => setLoading(false))
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
        .finally(() => setLoading(false))
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
    }
  }

  const removePackageItem = async (id: number) => {
    try {
      const res = await fetch(`/api/food_package_items?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setPkgRows((prev) => prev.filter((row) => String(row.food_package_item_id) !== String(id)))
      showToast({ type: 'success', message: 'Package item removed' })
    } catch (err: any) {
      showToast({ type: 'error', message: 'Failed to remove package item', description: err.message })
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
    }
  }

  const [editingPkgItemId, setEditingPkgItemId] = useState<number | null>(null)
  const [editingPkgItemQty, setEditingPkgItemQty] = useState<string>('')

  const savePkgItemEdit = async (id: number) => {
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
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">{activeType === 'menu_bundle' ? 'Food Bundles' : 'Food Packages'}</h2>
          <p className="text-sm text-slate-500">{activeType === 'menu_bundle' ? 'Create and manage menu bundles for the regular menu.' : 'Create and manage catering packages.'}</p>
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

      <div className="mb-4 flex gap-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {PACKAGE_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setActiveType(type)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${activeType === type ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {type === 'menu_bundle' ? 'Food Bundles' : 'Food Packages'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-5 flex flex-col md:flex-row gap-3">
        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 flex-1 focus-within:border-indigo-400">
          <Search size={14} className="text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${activeType === 'menu_bundle' ? 'bundle' : 'package'} name...`} className="w-full outline-none text-sm" />
        </div>

        <button type="button" onClick={() => setShowArchived((prev) => !prev)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
          {showArchived ? 'Hide archived' : 'Show archived'}
        </button>
      </div>

      {renderRestaurantTable('Lakay Ago', paginatedLakayItems, lakayAgoItems, lakayPage, lakayPageTotal, setLakayPage, lakayEmptyCount)}
      {renderRestaurantTable('Aroo', paginatedArooItems, arooItems, arooPage, arooPageTotal, setArooPage, arooEmptyCount)}
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
        <div className="w-full flex flex-col max-h-[60vh]">
          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 min-h-0 pr-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* LEFT COLUMN — form fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">{activeType === 'menu_bundle' ? 'Bundle' : 'Package'} name</label>
                  <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
                </div>

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
                    <option value="Both">Both</option>
                  </select>
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
                  <div className="flex flex-col min-h-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-slate-700">Menu items</label>
                      <span className="text-[10px] uppercase tracking-wide text-slate-500">{menuItemsRowsModal.length} selected</span>
                    </div>

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
            <button type="button" onClick={() => { setShowModal(false); setEditingId(null); setForm(emptyForm(activeType)); setErrors({}); setBundleRowsModal([]); setMenuItemsRowsModal([]); setBundleOptionsModal([]); setMenuItemsOptionsModal([]); setBundleItemSelect(''); setBundleItemQty('1'); setMenuItemSelect(''); setMenuItemQty('1') }} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600">Cancel</button>
            <button type="button" onClick={handleSave} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg">Save</button>
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
            }} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg">Add</button>
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
                      <button type="button" onClick={() => void savePkgItemEdit(row.food_package_item_id)} className="text-indigo-600 text-sm">Save</button>
                      <button type="button" onClick={() => { setEditingPkgItemId(null); setEditingPkgItemQty('') }} className="text-slate-600 text-sm">Cancel</button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => { setEditingPkgItemId(row.food_package_item_id); setEditingPkgItemQty(String(row.quantity)) }} className="text-slate-600"><Pencil size={14} /></button>
                      <button type="button" onClick={() => void removePackageItem(row.food_package_item_id)} className="text-red-600"><Trash2 size={14} /></button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  )
}
