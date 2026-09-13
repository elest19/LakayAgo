'use client'
import { useEffect, useMemo, useState } from 'react'
import { Search, Plus, Pencil, Trash2, Eye } from 'lucide-react'
import Modal from '../components/Modal'
import useIsMobile from '../hooks/isMobile'
import { useApp } from '../App'

interface AssetForm {
  name: string
  quantity: string
  restaurant: string
  penalty_amount?: string
}

const emptyForm: AssetForm = { name: '', quantity: '0', restaurant: 'Lakay Ago', penalty_amount: '0.00' }

const getErrors = (f: AssetForm) => {
  const e: Partial<Record<keyof AssetForm, string>> = {}
  if (!f.name.trim()) e.name = 'Name is required.'
  if (f.quantity === '' || Number.isNaN(Number(f.quantity)) || Number(f.quantity) < 0) e.quantity = 'Quantity must be a non-negative integer.'
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

export default function AssetsCatalog() {
  const isMobile = useIsMobile()
  const { showToast } = useApp()
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<any | null>(null)
  const [selectedItem, setSelectedItem] = useState<any | null>(null)
  const [form, setForm] = useState<AssetForm>(emptyForm)
  const [errors, setErrors] = useState<Partial<Record<keyof AssetForm, string>>>({})
  const [lakayPage, setLakayPage] = useState(1)
  const [arooPage, setArooPage] = useState(1)
  const [addQuantityId, setAddQuantityId] = useState<string | null>(null)
  const [addQuantityValue, setAddQuantityValue] = useState('')
  const [addQuantityLoading, setAddQuantityLoading] = useState(false)

  const filtered = useMemo(() => items.filter(i => i.name.toLowerCase().includes(search.toLowerCase())), [items, search])

  const resetForm = () => {
    setForm(emptyForm)
    setErrors({})
    setEditingItem(null)
  }

  const openCreate = () => { resetForm(); setShowModal(true) }

  const openEdit = (item: any) => {
    setEditingItem(item)
    setForm({ name: item.name, quantity: String(item.quantity), restaurant: item.restaurant || 'Lakay Ago', penalty_amount: String(item.penalty_amount ?? '0.00') })
    setErrors({})
    setShowModal(true)
  }

  const archiveItem = async (id: string) => {
    try {
      const res = await fetch(`/api/assets_inventory/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Archive failed')
      setItems(prev => prev.filter(p => p.asset_id !== id))
      showToast({ type: 'success', message: 'Asset archived' })
    } catch (err) { showToast({ type: 'error', message: 'Failed to archive asset' }) }
  }

  const handleAddStock = async (item: any) => {
    const amount = Number(addQuantityValue)
    if (addQuantityValue === '' || Number.isNaN(amount) || amount <= 0) { showToast({ type: 'error', message: 'Enter a valid amount' }); return }
    const newStock = item.quantity + amount
    setAddQuantityLoading(true)
    try {
      const res = await fetch(`/api/assets_inventory/${item.asset_id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity: newStock }) })
      const body = await res.json().catch(() => ({}))
      setAddQuantityLoading(false)
      if (!res.ok) { showToast({ type: 'error', message: 'Failed to add stock', description: body.error || body.detail || `Status ${res.status}` }); return }
      setItems(prev => prev.map(p => p.asset_id === item.asset_id ? { ...p, quantity: newStock } : p))
      showToast({ type: 'success', message: 'Stock added', description: `Added ${amount} to ${item.name}.` })
      setAddQuantityValue('')
      setAddQuantityId(null)
    } catch (err) {
      setAddQuantityLoading(false)
      showToast({ type: 'error', message: 'Failed to add stock' })
    }
  }

  const handleSave = () => {
    const next = getErrors(form)
    if (Object.keys(next).length) { setErrors(next); return }
    const payload = { name: form.name.trim(), quantity: Number(form.quantity), restaurant: form.restaurant, penalty_amount: Number(form.penalty_amount || 0) }
    setLoading(true)
    const url = editingItem ? `/api/assets_inventory/${editingItem.asset_id}` : '/api/assets_inventory'
    const method = editingItem ? 'PUT' : 'POST'
    fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(async r => {
        setLoading(false)
        if (!r.ok) throw new Error('Save failed')
        const j = await r.json()
        const saved = j.asset
        if (editingItem) {
          setItems(prev => prev.map(p => p.asset_id === editingItem.asset_id ? saved : p))
          showToast({ type: 'success', message: 'Asset updated', description: `${saved.name} updated.` })
        } else {
          setItems(prev => [saved, ...prev])
          showToast({ type: 'success', message: 'Asset saved', description: `${saved.name} saved.` })
        }
        setShowModal(false)
      })
      .catch(err => {
        setLoading(false)
        showToast({ type: 'error', message: editingItem ? 'Failed to update asset' : 'Failed to save asset' })
      })
  }

  // load assets
  useEffect(() => {
    let mounted = true
    setLoading(true)
    fetch('/api/assets_inventory')
      .then(r => r.json())
      .then(j => {
        if (!mounted) return
        setItems(j.assets || j.inventory || [])
      })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const lakayAgoItems = filtered.filter(item => item.restaurant === 'Lakay Ago')
  const arooItems = filtered.filter(item => item.restaurant === 'Aroo')
  const pageSize = 10
  const lakayPageTotal = Math.max(1, Math.ceil(lakayAgoItems.length / pageSize))
  const arooPageTotal = Math.max(1, Math.ceil(arooItems.length / pageSize))
  const paginatedLakayItems = lakayAgoItems.slice((lakayPage - 1) * pageSize, lakayPage * pageSize)
  const paginatedArooItems = arooItems.slice((arooPage - 1) * pageSize, arooPage * pageSize)

  const lakayEmptyCount = paginatedLakayItems.length === 0 ? 0 : Math.max(0, pageSize - paginatedLakayItems.length)
  const arooEmptyCount = paginatedArooItems.length === 0 ? 0 : Math.max(0, pageSize - paginatedArooItems.length)

  useEffect(() => { setLakayPage(1) }, [search, items.length])
  useEffect(() => { setArooPage(1) }, [search, items.length])

  const renderRestaurantTable = (title: string, displayItems: typeof filtered, totalItems: typeof filtered, currentPage: number, totalPages: number, setPage: (value: number | ((prev: number) => number)) => void, emptyCount: number) => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6" style={{ display: loading || totalItems.length > 0 ? 'block' : 'none' }}>
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <h3 className="text-lg font-semibold text-slate-700 font-display">{title}</h3>
      </div>
      {!isMobile ? (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <colgroup>
              <col style={{ width: '20%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '30%' }} />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Name', 'Quantity', 'Restaurant', 'Penalty Amount', 'Actions'].map(column => (
                  <th key={column} className={`${column === 'Actions' ? 'text-center' : 'text-left'} py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display whitespace-nowrap`}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <SkeletonTableRows
                  columns={5}
                  rows={6}
                  columnConfig={[
                    { width: "60%" },
                    { width: "30%" },
                    { width: "30%" },
                    { width: "40%" },
                    { width: "50%" },
                  ]}
                />
              ) : totalItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">No assets found.</td>
                </tr>
              ) : (
                displayItems.map(item => (
                  <tr
                    key={item.asset_id}
                    className="hover:bg-slate-50 group cursor-pointer"
                    onClick={() => setSelectedItem(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedItem(item)
                      }
                    }}
                  >
                    <td className="py-3 px-4 text-sm font-medium text-slate-700 font-display">{item.name}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700">{item.quantity}</td>
                    <td className="py-3 px-4 text-sm text-slate-600 ">{item.restaurant}</td>
                    <td className="py-3 px-4 text-sm text-slate-700">${Number(item.penalty_amount || 0).toFixed(2)}</td>
                    <td className="py-3 px-4 text-sm text-slate-700" onClick={e => e.stopPropagation()}>
                      {addQuantityId === item.asset_id ? (
                        <div className="flex items-center gap-2 justify-center">
                          <input
                            value={addQuantityValue}
                            onChange={e => { if (e.target.value === '' || /^\d*$/.test(e.target.value)) setAddQuantityValue(e.target.value) }}
                            placeholder="Amount"
                            inputMode="numeric"
                            autoFocus
                            className="w-24 border border-slate-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                          />
                          <button type="button" onClick={() => handleAddStock(item)} disabled={addQuantityLoading} className="text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1">{addQuantityLoading ? '...' : 'Add'}</button>
                          <button type="button" onClick={() => { setAddQuantityId(null); setAddQuantityValue('') }} className="text-xs font-medium text-slate-600 border border-slate-200 rounded-lg px-3 py-1 hover:bg-slate-50">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 justify-center">
                          <button type="button" onClick={() => { setAddQuantityId(item.asset_id); setAddQuantityValue('') }} className="text-xs font-medium text-green-600 hover:text-green-800">+ Add Qty</button>
                          <button type="button" onClick={() => openEdit(item)} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"><Pencil size={14} /> Edit</button>
                          <button type="button" onClick={() => archiveItem(item.asset_id)} className="text-xs font-medium text-red-600 hover:text-red-800 flex items-center gap-1"><Trash2 size={14} /> Archive</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
              {emptyCount > 0 && (
                Array.from({ length: emptyCount }).map((_, ii) => (
                  <tr key={`empty-${ii}`} className="invisible">
                    <td className="py-3 px-4 text-sm font-medium text-slate-700 font-display">Placeholder</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700">0</td>
                    <td className="py-3 px-4 text-sm text-slate-600 ">Restaurant</td>
                    <td className="py-3 px-4 text-sm text-slate-700">PHP 0.00</td>
                    <td className="py-3 px-4 text-sm text-slate-700"><div className="invisible">Actions</div></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4">
          {loading ? (
            <SkeletonTableRows
              columns={3}
              rows={6}
              columnConfig={[
                { width: "60%" },
                { width: "30%" },
                { width: "30%" },
              ]}
            />
          ) : items.length === 0 ? (
            <div className="p-4 text-sm text-slate-400">No assets found.</div>
          ) : (
            items.map(item => (
              <button key={item.asset_id} type="button" onClick={() => setSelectedItem(item)} className="text-left p-3 border-b border-slate-50 hover:bg-slate-50 flex items-center justify-between gap-3 w-full">
                <div>
                  <div className="text-sm font-semibold text-slate-700 font-display">{item.name}</div>
                  <div className="text-xs text-slate-400">{item.restaurant}</div>
                </div>
                <div className="text-sm font-mono text-slate-700">{item.quantity}</div>
              </button>
            ))
          )}
        </div>
      )}
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <span>Showing {items.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, items.length)} of {items.length}</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1} className="rounded border border-slate-200 bg-white px-2 py-1 disabled:opacity-40">Prev</button>
          <span>{currentPage}/{totalPages}</span>
          <button type="button" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage >= totalPages} className="rounded border border-slate-200 bg-white px-2 py-1 disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-display">Assets Catalog</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage utensils, equipment, and assets per restaurant.</p>
        </div>
        <button type="button" onClick={openCreate} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg font-display">
          <Plus size={16} /> Add Asset
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 shadow-sm">
        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets..." className="bg-transparent text-sm outline-none text-slate-700 w-full placeholder:text-slate-400" />
        </div>
      </div>

      <div className="space-y-0">
        {renderRestaurantTable('Lakay Ago', paginatedLakayItems, lakayAgoItems, lakayPage, lakayPageTotal, setLakayPage, lakayEmptyCount)}
        {renderRestaurantTable('Aroo', paginatedArooItems, arooItems, arooPage, arooPageTotal, setArooPage, arooEmptyCount)}
        {!loading && filtered.length === 0 && <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center"><p className="text-sm text-slate-400">No assets found.</p></div>}
      </div>

      <Modal open={showModal} title={editingItem ? 'Edit Asset' : 'Add Asset'} onClose={() => { setShowModal(false); resetForm(); }}>
        <div className="space-y-4 w-full">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Name</label>
            <input value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" placeholder="Enter name" />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Quantity</label>
            <input value={form.quantity} onChange={e => { if (/^\d*$/.test(e.target.value)) setForm(prev => ({ ...prev, quantity: e.target.value })) }} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" placeholder="0" inputMode="numeric" />
            {errors.quantity && <p className="mt-1 text-xs text-red-600">{errors.quantity}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Penalty amount (per unit)</label>
            <input value={form.penalty_amount} onChange={e => { if (/^\d*(\.\d{0,2})?$/.test(e.target.value)) setForm(prev => ({ ...prev, penalty_amount: e.target.value })) }} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" placeholder="0.00" inputMode="decimal" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Restaurant</label>
            <select
              value={form.restaurant}
              onChange={e => setForm(prev => ({ ...prev, restaurant: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="Lakay Ago">Lakay Ago</option>
              <option value="Aroo">Aroo</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
            <button type="button" onClick={handleSave} disabled={loading} className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display">{loading ? 'Saving...' : (editingItem ? 'Update' : 'Save')}</button>
          </div>
        </div>
      </Modal>

      {selectedItem && (
        <Modal open={!!selectedItem} title={selectedItem.name} onClose={() => setSelectedItem(null)}>
          <div className="space-y-3 w-full max-w-md">
            <div className="grid grid-cols-2 gap-3 w-md">
              <div>
                <p className="text-xs text-slate-400">Quantity</p>
                <p className="text-sm font-medium">{selectedItem.quantity}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Restaurant</p>
                <p className="text-sm font-medium">{selectedItem.restaurant}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Created</p>
                <p className="text-sm font-medium">{new Date(selectedItem.created_at).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Status</p>
                <p className="text-sm font-medium">{selectedItem.is_archived ? 'Archived' : 'Active'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Penalty</p>
                <p className="text-sm font-medium">{Number(selectedItem.penalty_amount || 0).toFixed(2)}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => { setSelectedItem(null); openEdit(selectedItem) }} className="px-3 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">Edit</button>
              <button type="button" onClick={() => { setSelectedItem(null); archiveItem(selectedItem.asset_id) }} className="px-3 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg">Archive</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}