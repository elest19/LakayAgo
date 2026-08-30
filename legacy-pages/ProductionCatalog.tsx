'use client'
import { useMemo, useState } from 'react'
import { Search, Pencil, Plus, Trash2 } from 'lucide-react'
import { useApp } from '../App'
import Modal from '../components/Modal'
import useIsMobile from '../hooks/isMobile'
import type { ProductionItem } from '../types'

interface ProductionFormState {
  itemName: string
  department: string
  stock: string
}

const emptyForm: ProductionFormState = {
  itemName: '',
  department: 'Production',
  stock: '',
}

const getValidationErrors = (form: ProductionFormState) => {
  const errors: Partial<Record<keyof ProductionFormState, string>> = {}
  const itemName = form.itemName.trim()

  if (!itemName) {
    errors.itemName = 'Item name is required.'
  }

  if (form.stock === '' || form.stock.trim() === '') {
    errors.stock = 'Stock is required.'
  } else {
    const parsed = Number(form.stock)
    if (Number.isNaN(parsed) || parsed < 0) {
      errors.stock = 'Stock must be a valid non-negative number.'
    }
  }

  return errors
}

export default function ProductionCatalog() {
  const { productionStock, setProductionStock, showToast } = useApp()
  const isMobile = useIsMobile()
  const [search, setSearch] = useState('')
  const [selectedItem, setSelectedItem] = useState<ProductionItem | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingItem, setEditingItem] = useState<ProductionItem | null>(null)
  const [form, setForm] = useState<ProductionFormState>(emptyForm)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ProductionFormState, string>>>({})
  const [previewItem, setPreviewItem] = useState<ProductionFormState | null>(null)
  const [deleteItemTarget, setDeleteItemTarget] = useState<ProductionItem | null>(null)

  const filteredItems = useMemo(
    () => productionStock.filter(item => item.itemName.toLowerCase().includes(search.toLowerCase())),
    [productionStock, search],
  )

  const resetForm = () => {
    setForm(emptyForm)
    setFormErrors({})
    setPreviewItem(null)
    setEditingItem(null)
  }

  const openCreate = () => {
    resetForm()
    setForm(prev => ({ ...prev, department: 'Production' }))
    setShowAddModal(true)
  }

  const openEdit = (item: ProductionItem) => {
    setEditingItem(item)
    setForm({
      itemName: item.itemName,
      department: 'Production',
      stock: String(item.stock),
    })
    setFormErrors({})
    setPreviewItem(null)
    setShowAddModal(true)
  }

  const handleProceed = () => {
    const nextErrors = getValidationErrors(form)
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors)
      return
    }

    setPreviewItem({
      itemName: form.itemName.trim(),
      department: form.department.trim(),
      stock: form.stock,
    })
  }

  const handleConfirm = () => {
    if (!previewItem) {
      showToast({ type: 'error', message: 'Unable to save production item', description: 'The preview data is missing.' })
      return
    }

    const parsedStock = Number(previewItem.stock)
    if (Number.isNaN(parsedStock) || parsedStock < 0) {
      showToast({ type: 'error', message: 'Invalid stock value', description: 'Please enter a valid non-negative stock value.' })
      return
    }

    if (editingItem) {
      const updatedItem: ProductionItem = {
        ...editingItem,
        itemName: previewItem.itemName,
        department: previewItem.department,
        stock: parsedStock,
        updatedAt: new Date().toISOString(),
        updatedBy: 'Admin',
      }

      setProductionStock(prev => prev.map(item => (item.id === editingItem.id ? updatedItem : item)))
      showToast({ type: 'success', message: 'Production item updated', description: `${updatedItem.itemName} has been updated.` })
    } else {
      const newItem: ProductionItem = {
        id: `PRO-${Date.now()}`,
        itemName: previewItem.itemName,
        department: previewItem.department,
        stock: parsedStock,
        createdAt: new Date().toISOString(),
        createdBy: 'Admin',
        updatedAt: new Date().toISOString(),
        updatedBy: 'Admin',
      }

      setProductionStock(prev => [newItem, ...prev])
      showToast({ type: 'success', message: 'Production item added', description: `${newItem.itemName} is now in the production catalog.` })
    }

    setShowAddModal(false)
    setPreviewItem(null)
    resetForm()
  }

  const renderTable = () => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-700 font-display">Production Inventory</h3>
      </div>
      {!isMobile ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Item Name', 'Department', 'Stock', 'Created_At', 'Created_By', 'Updated_At', 'Updated_By'].map(column => (
                  <th key={column} className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display whitespace-nowrap">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">No production items found.</td>
                </tr>
              ) : (
                filteredItems.map(item => (
                  <tr
                    key={item.id}
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
                    <td className="py-3 px-4 text-sm font-medium text-slate-700 font-display">{item.itemName}</td>
                    <td className="py-3 px-4 text-sm text-slate-600 text-center">{item.department}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 text-center">{item.stock}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 text-center">{new Date(item.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-sm text-slate-600 text-center">{item.createdBy}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 text-center">{new Date(item.updatedAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-sm text-slate-600 text-center">{item.updatedBy}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col">
          {filteredItems.length === 0 ? (
            <div className="p-4 text-sm text-slate-400">No production items found.</div>
          ) : (
            filteredItems.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedItem(item)}
                className="text-left p-3 border-b border-slate-50 hover:bg-slate-50 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-700 font-display">{item.itemName}</div>
                  <div className="text-xs text-slate-400">{item.department}</div>
                </div>
                <div className="text-sm font-mono text-slate-700">{item.stock}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-display">Production Catalog</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage production stock by item and department</p>
        </div>
        <button type="button" onClick={openCreate} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg font-display">
          <Plus size={16} /> Add Item
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 shadow-sm">
        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search production item..."
            className="bg-transparent text-sm outline-none text-slate-700 w-full placeholder:text-slate-400"
          />
        </div>
      </div>

      {renderTable()}

      <Modal open={showAddModal} title={editingItem ? 'Edit Production Item' : 'Add Production Item'} onClose={() => { setShowAddModal(false); resetForm(); }}>
        <div className="space-y-4 w-full">
          <div className="w-md">
            <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Item Name</label>
            <input
              value={form.itemName}
              onChange={e => setForm(prev => ({ ...prev, itemName: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              placeholder="Enter item name"
            />
            {formErrors.itemName && <p className="mt-1 text-xs text-red-600">{formErrors.itemName}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Department</label>
            <input
              value={form.department}
              readOnly
              disabled
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none bg-slate-50 text-slate-600 cursor-not-allowed"
            />
            {formErrors.department && <p className="mt-1 text-xs text-red-600">{formErrors.department}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Stock</label>
            <input
              value={form.stock}
              onChange={e => {
                const value = e.target.value
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  setForm(prev => ({ ...prev, stock: value }))
                }
              }}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              placeholder="0"
              inputMode="decimal"
            />
            {formErrors.stock && <p className="mt-1 text-xs text-red-600">{formErrors.stock}</p>}
          </div>

          {!previewItem ? (
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => { setShowAddModal(false); resetForm(); }} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
              <button type="button" onClick={handleProceed} className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display">Proceed</button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">Please confirm the production item before continuing.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">Item</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800 font-display">{previewItem.itemName}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">Department</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800 font-display">{previewItem.department}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3 sm:col-span-2">
                  <p className="text-xs text-slate-500">Stock</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800 font-display">{Number(previewItem.stock)}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setPreviewItem(null)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Back</button>
                <button type="button" onClick={handleConfirm} className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display">{editingItem ? 'Confirm Update' : 'Add Item'}</button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {deleteItemTarget && (
        <Modal open={!!deleteItemTarget} title="Confirm deletion" onClose={() => setDeleteItemTarget(null)}>
          <div className="w-full p-2">
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to delete <span className="font-semibold text-slate-700">{deleteItemTarget.itemName}</span>?
            </p>
            <p className="text-xs text-slate-500 mb-5">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setDeleteItemTarget(null)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
              <button
                type="button"
                onClick={() => {
                  const item = deleteItemTarget
                  setProductionStock(prev => prev.filter(entry => entry.id !== item.id))
                  showToast({ type: 'success', message: 'Production item deleted', description: `${item.itemName} was removed from production.` })
                  setDeleteItemTarget(null)
                }}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg font-display"
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}

      {selectedItem && (
        <Modal open={!!selectedItem} title={selectedItem.itemName} onClose={() => setSelectedItem(null)}>
          <div className="space-y-3 w-full max-w-md">
            <div className="grid grid-cols-2 gap-3 w-md">
              <div>
                <p className="text-xs text-slate-400">Department</p>
                <p className="text-sm font-medium">{selectedItem.department}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Stock</p>
                <p className="text-sm font-medium">{selectedItem.stock}</p>
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
              <button type="button" onClick={() => { setSelectedItem(null); setDeleteItemTarget(selectedItem) }} className="px-3 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg">Delete</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
