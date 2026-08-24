import { useMemo, useState } from 'react'
import { Search, Pencil, Trash2, Plus, Package2 } from 'lucide-react'
import { useApp } from '../App'
import Modal from '../components/Modal'
import useIsMobile from '../hooks/isMobile'
import type { InventoryCategory, InventoryItem } from '../types'

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(value)

interface ProductFormState {
  item: string
  cost: string
  stock: string
  category: InventoryCategory
  linkedKitchenItemId: string
}

const emptyForm: ProductFormState = {
  item: '',
  cost: '',
  stock: '',
  category: 'Menu Item',
  linkedKitchenItemId: '',
}

const getValidationErrors = (
  form: ProductFormState,
  inventoryItems: { item: string; id?: string }[],
  kitchenItems: { id: string; itemName: string; stock: number }[],
  editingItemId?: string,
) => {
  const errors: Partial<Record<keyof ProductFormState, string>> = {}
  const selectedKitchenItem = form.linkedKitchenItemId
    ? kitchenItems.find(item => item.id === form.linkedKitchenItemId)
    : null

  const effectiveItemName = selectedKitchenItem ? selectedKitchenItem.itemName.trim() : form.item.trim()
  const effectiveStockValue = selectedKitchenItem ? String(selectedKitchenItem.stock) : form.stock

  if (!['Menu Item', 'Others'].includes(form.category)) {
    errors.category = 'Category is invalid.'
  }

  if (form.category === 'Menu Item') {
    if (!form.linkedKitchenItemId) {
      errors.linkedKitchenItemId = 'Choose a linked kitchen item for menu items.'
    } else if (!selectedKitchenItem) {
      errors.linkedKitchenItemId = 'The selected kitchen item is invalid.'
    }
  } else if (form.category === 'Others' && selectedKitchenItem) {
    // Derived from the kitchen link; skip manual validation.
  } else {
    if (!effectiveItemName) {
      errors.item = 'Item name is required.'
    } else if (
      inventoryItems.some(item => item.item.toLowerCase() === effectiveItemName.toLowerCase() && item.id !== editingItemId)
    ) {
      errors.item = 'An item with this name already exists.'
    }

    if (effectiveStockValue === '' || effectiveStockValue.trim() === '') {
      errors.stock = 'Stock is required.'
    } else {
      const parsed = Number(effectiveStockValue)
      if (Number.isNaN(parsed) || parsed < 0) {
        errors.stock = 'Stock must be a valid non-negative number.'
      }
    }
  }

  if (form.cost === '' || form.cost.trim() === '') {
    errors.cost = 'Cost is required.'
  } else {
    const parsed = Number(form.cost)
    if (Number.isNaN(parsed) || parsed < 0) {
      errors.cost = 'Cost must be a valid non-negative number.'
    }
  }

  if (form.category === 'Others' && !form.linkedKitchenItemId && !effectiveItemName) {
    errors.item = 'Item name is required.'
  }

  if (form.category === 'Others' && !form.linkedKitchenItemId) {
    const parsedStock = Number(effectiveStockValue)
    if (effectiveStockValue === '' || effectiveStockValue.trim() === '') {
      errors.stock = 'Stock is required.'
    } else if (Number.isNaN(parsedStock) || parsedStock < 0) {
      errors.stock = 'Stock must be a valid non-negative number.'
    }
  }

  return errors
}

export default function InventoryCatalog() {
  const { inventoryItems, setInventoryItems, kitchenStock, showToast } = useApp()
  const isMobile = useIsMobile()
  const [search, setSearch] = useState('')
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [form, setForm] = useState<ProductFormState>(emptyForm)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ProductFormState, string>>>({})
  const [previewProduct, setPreviewProduct] = useState<ProductFormState | null>(null)
  const [deleteItemTarget, setDeleteItemTarget] = useState<InventoryItem | null>(null)

  const filteredItems = useMemo(
    () => inventoryItems.filter(item => item.item.toLowerCase().includes(search.toLowerCase())),
    [inventoryItems, search],
  )

  const menuItems = filteredItems.filter(item => item.category === 'Menu Item')
  const otherItems = filteredItems.filter(item => item.category === 'Others')

  const resetForm = () => {
    setForm(emptyForm)
    setFormErrors({})
    setPreviewProduct(null)
    setEditingItem(null)
  }

  const openCreate = () => {
    resetForm()
    setShowAddModal(true)
  }

  const selectedKitchenItem = form.linkedKitchenItemId
    ? kitchenStock.find(item => item.id === form.linkedKitchenItemId) ?? null
    : null

  const isKitchenLinkedSelection = Boolean(selectedKitchenItem)
  const isManualEntryAllowed = form.category === 'Others' && !form.linkedKitchenItemId
  const resolvedItemName = isKitchenLinkedSelection ? selectedKitchenItem!.itemName : form.item
  const resolvedStockValue = isKitchenLinkedSelection ? String(selectedKitchenItem!.stock) : form.stock

  const openEdit = (item: InventoryItem) => {
    setEditingItem(item)
    setForm({
      item: item.item,
      cost: String(item.cost),
      stock: String(item.stock),
      category: item.category,
      linkedKitchenItemId: item.linkedKitchenItemId ?? '',
    })
    setFormErrors({})
    setPreviewProduct(null)
    setShowAddModal(true)
  }

  const handleKitchenLinkChange = (nextValue: string) => {
    const kitchenItem = nextValue ? kitchenStock.find(item => item.id === nextValue) ?? null : null

    setForm(prev => {
      const nextCategory = prev.category

      if (kitchenItem) {
        return {
          ...prev,
          linkedKitchenItemId: kitchenItem.id,
          item: kitchenItem.itemName,
          stock: String(kitchenItem.stock),
        }
      }

      return {
        ...prev,
        linkedKitchenItemId: '',
        item: nextCategory === 'Others' ? '' : prev.item,
        stock: nextCategory === 'Others' ? '' : prev.stock,
      }
    })

    setFormErrors({})
  }

  const handleCategoryChange = (nextCategory: InventoryCategory) => {
    setForm(prev => {
      const nextLinkedKitchenId = nextCategory === 'Menu Item' ? '' : prev.linkedKitchenItemId
      const shouldResetManualFields = nextCategory === 'Menu Item' || prev.linkedKitchenItemId === ''

      return {
        ...prev,
        category: nextCategory,
        linkedKitchenItemId: nextLinkedKitchenId,
        item: shouldResetManualFields ? '' : prev.item,
        stock: shouldResetManualFields ? '' : prev.stock,
      }
    })
    setPreviewProduct(null)
    setFormErrors({})
  }

  const handleProceed = () => {
    const nextErrors = getValidationErrors(form, inventoryItems, kitchenStock, editingItem?.id)
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors)
      return
    }

    setPreviewProduct({
      item: resolvedItemName.trim(),
      cost: form.cost,
      stock: resolvedStockValue,
      category: form.category,
      linkedKitchenItemId: form.linkedKitchenItemId,
    })
  }

  const handleConfirm = () => {
    if (!previewProduct) {
      showToast({ type: 'error', message: 'Unable to save product', description: 'The preview data is missing.' })
      return
    }

    if (editingItem) {
      const updatedItem: InventoryItem = {
        ...editingItem,
        item: previewProduct.item,
        cost: Number(previewProduct.cost),
        category: previewProduct.category,
        stock: Number(previewProduct.stock),
        linkedKitchenItemId: previewProduct.category === 'Menu Item' ? previewProduct.linkedKitchenItemId : null,
        updatedAt: new Date().toISOString(),
        updatedBy: 'Admin',
      }

      setInventoryItems(prev => prev.map(item => (item.id === editingItem.id ? updatedItem : item)))
      showToast({ type: 'success', message: 'Product updated', description: `${updatedItem.item} has been updated.` })
    } else {
      const newItem: InventoryItem = {
        id: `INV-${Date.now()}`,
        item: previewProduct.item,
        cost: Number(previewProduct.cost),
        category: previewProduct.category,
        stock: Number(previewProduct.stock),
        linkedKitchenItemId: previewProduct.category === 'Menu Item' ? previewProduct.linkedKitchenItemId : null,
        createdAt: new Date().toISOString(),
        createdBy: 'Admin',
        updatedAt: new Date().toISOString(),
        updatedBy: 'Admin',
      }

      setInventoryItems(prev => [newItem, ...prev])
      showToast({ type: 'success', message: 'Product added', description: `${newItem.item} is now available in the catalog.` })
    }

    setShowAddModal(false)
    setPreviewProduct(null)
    resetForm()
  }

  const handleDelete = (item: InventoryItem) => {
    setDeleteItemTarget(item)
  }

  const renderTable = (items: InventoryItem[], title: string) => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-700 font-display">{title}</h3>
      </div>
      {!isMobile ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Item', 'Cost', 'Stock', 'Category', 'Kitchen', 'Created_At', 'Created_By', 'Updated_At', 'Updated_By'].map(column => (
                  <th key={column} className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display whitespace-nowrap">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-400">No items found.</td>
                </tr>
              ) : (
                items.map(item => {
                  const linkedKitchen = kitchenStock.find(kitchenItem => kitchenItem.id === item.linkedKitchenItemId)

                  return (
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
                      <td className="py-3 px-4 text-sm font-medium text-slate-700 font-display">{item.item}</td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700 text-center">{formatCurrency(item.cost)}</td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700 text-center">{item.stock}</td>
                      <td className="py-3 px-4 text-sm text-slate-600 text-center">{item.category}</td>
                      <td className="py-3 px-4 text-xs text-slate-600 text-center">{linkedKitchen ? linkedKitchen.itemName : '—'}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500 text-center">{new Date(item.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-sm text-slate-600 text-center">{item.createdBy}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500 text-center">{new Date(item.updatedAt).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-sm text-slate-600 text-center">{item.updatedBy}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col">
          {items.length === 0 ? (
            <div className="p-4 text-sm text-slate-400">No items found.</div>
          ) : (
            items.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedItem(item)}
                className="text-left p-3 border-b border-slate-50 hover:bg-slate-50 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-700 font-display">{item.item}</div>
                  <div className="text-xs text-slate-400">{item.category}</div>
                </div>
                <div className="text-sm font-mono text-slate-700">{formatCurrency(item.cost)}</div>
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
          <h2 className="text-xl font-bold text-slate-800 font-display">Inventory Catalog</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage menu and other item inventory</p>
        </div>
        <button type="button" onClick={openCreate} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg font-display">
          <Plus size={16} /> Add Product
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 shadow-sm">
        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search item name..."
            className="bg-transparent text-sm outline-none text-slate-700 w-full placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="space-y-6">
        {renderTable(menuItems, 'Menu Item')}
        {renderTable(otherItems, 'Others')}
      </div>

      <Modal open={showAddModal} title={editingItem ? 'Edit Product' : 'Add Product'} onClose={() => { setShowAddModal(false); resetForm(); }}>
        <div className="space-y-4 w-full">
          <div className="w-md">
            <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Item</label>
            <input
              value={resolvedItemName}
              onChange={e => {
                if (!isManualEntryAllowed) return
                setForm(prev => ({ ...prev, item: e.target.value }))
              }}
              disabled={!isManualEntryAllowed}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed disabled:border-slate-200"
              placeholder="Enter item name"
            />
            {formErrors.item && <p className="mt-1 text-xs text-red-600">{formErrors.item}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Cost</label>
            <input
              value={form.cost}
              onChange={e => {
                const value = e.target.value
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  setForm(prev => ({ ...prev, cost: value }))
                }
              }}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              placeholder="0.00"
              inputMode="decimal"
            />
            {formErrors.cost && <p className="mt-1 text-xs text-red-600">{formErrors.cost}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Stock</label>
            <input
              value={resolvedStockValue}
              onChange={e => {
                if (!isManualEntryAllowed) return
                const value = e.target.value
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  setForm(prev => ({ ...prev, stock: value }))
                }
              }}
              disabled={!isManualEntryAllowed}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed disabled:border-slate-200"
              placeholder="0"
              inputMode="decimal"
            />
            {formErrors.stock && <p className="mt-1 text-xs text-red-600">{formErrors.stock}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Category</label>
            <select
              value={form.category}
              onChange={e => handleCategoryChange(e.target.value as InventoryCategory)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="Menu Item">Menu Item</option>
              <option value="Others">Others</option>
            </select>
            {formErrors.category && <p className="mt-1 text-xs text-red-600">{formErrors.category}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Kitchen Link</label>
            <select
              value={form.linkedKitchenItemId}
              onChange={e => handleKitchenLinkChange(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">Select Item from Kitchen Catalog</option>
              {kitchenStock.map(item => (
                <option key={item.id} value={item.id}>{item.itemName}</option>
              ))}
            </select>
            {formErrors.linkedKitchenItemId && <p className="mt-1 text-xs text-red-600">{formErrors.linkedKitchenItemId}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => { setShowAddModal(false); resetForm(); }} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
            <button type="button" onClick={handleProceed} className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display">Proceed</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!previewProduct} title="Confirm Product" onClose={() => setPreviewProduct(null)}>
        <div className="space-y-4 w-full">
          <p className="text-sm text-slate-500">Please confirm the information before proceeding</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Item</p>
              <p className="mt-1 text-sm font-semibold text-slate-800 font-display">{previewProduct ? previewProduct.item : ''}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Cost</p>
              <p className="mt-1 text-sm font-semibold text-slate-800 font-display">{previewProduct ? formatCurrency(Number(previewProduct.cost)) : ''}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Stock</p>
              <p className="mt-1 text-sm font-semibold text-slate-800 font-display">{previewProduct ? previewProduct.stock : ''}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Category</p>
              <p className="mt-1 text-sm font-semibold text-slate-800 font-display">{previewProduct?.category}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 sm:col-span-2">
              <p className="text-xs text-slate-500">Linked Kitchen Item</p>
              <p className="mt-1 text-sm font-semibold text-slate-800 font-display">
                {previewProduct?.linkedKitchenItemId ? kitchenStock.find(item => item.id === previewProduct.linkedKitchenItemId)?.itemName ?? 'Unknown kitchen item' : 'None'}
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setPreviewProduct(null)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Back</button>
            <button type="button" onClick={handleConfirm} className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display">{editingItem ? 'Confirm Product' : 'Add Product'}</button>
          </div>
        </div>
      </Modal>

      {selectedItem && (
        <Modal open={!!selectedItem} title={selectedItem.item} onClose={() => setSelectedItem(null)}>
          <div className="space-y-3 w-full max-w-md">
            <div className="w-md grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-400">Cost</p>
                <p className="text-sm font-medium">{formatCurrency(selectedItem.cost)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Stock</p>
                <p className="text-sm font-medium">{selectedItem.stock}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Category</p>
                <p className="text-sm font-medium">{selectedItem.category}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Kitchen Link</p>
                <p className="text-sm font-medium">{selectedItem.linkedKitchenItemId ? kitchenStock.find(item => item.id === selectedItem.linkedKitchenItemId)?.itemName ?? 'Unknown item' : 'None'}</p>
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
              <button type="button" onClick={() => { setSelectedItem(null); handleDelete(selectedItem) }} className="px-3 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg">Delete</button>
            </div>
          </div>
        </Modal>
      )}
      {deleteItemTarget && (
        <Modal open={!!deleteItemTarget} title="Confirm Delete" onClose={() => setDeleteItemTarget(null)}>
          <p className="text-sm text-slate-500">Are you sure you want to delete <span className="font-semibold">{deleteItemTarget.item}</span>?</p>
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={() => setDeleteItemTarget(null)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
            <button type="button" onClick={() => {
              setInventoryItems(prev => prev.filter(entry => entry.id !== deleteItemTarget.id))
              showToast({ type: 'success', message: 'Product deleted', description: `${deleteItemTarget.item} was removed from the catalog.` })
              setDeleteItemTarget(null)
            }} className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg font-display">Delete</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
