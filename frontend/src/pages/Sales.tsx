import { useMemo, useState } from 'react'
import { Search, Plus, Pencil, Trash2 } from 'lucide-react'
import { useApp } from '../App'
import Modal from '../components/Modal'
import useIsMobile from '../hooks/isMobile'
import type { InventoryCategory, InventoryItem, SaleRecord } from '../types'

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(value)

interface SaleFormState {
  itemId: string
  item: string
  foodCost: string
  numberOfSales: string
  category: InventoryCategory
  discount: string
}

const emptyForm = (): SaleFormState => ({
  itemId: '',
  item: '',
  foodCost: '',
  numberOfSales: '',
  category: 'Menu Item',
  discount: '',
})

const getSaleValidationErrors = (form: SaleFormState) => {
  const errors: Partial<Record<keyof SaleFormState, string>> = {}

  if (!form.itemId) {
    errors.itemId = 'Please select an item.'
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

  if (!['Menu Item', 'Others'].includes(form.category)) {
    errors.category = 'Category is invalid.'
  }

  return errors
}

export default function Sales() {
  const { inventoryItems, salesRecords, setSalesRecords, showToast, sellMenuItem } = useApp()
  const isMobile = useIsMobile()
  const [search, setSearch] = useState('')
  const [selectedItemFilter, setSelectedItemFilter] = useState('All Items')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<'All' | InventoryCategory>('All')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSale, setEditingSale] = useState<SaleRecord | null>(null)
  const [form, setForm] = useState<SaleFormState>(emptyForm())
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof SaleFormState, string>>>({})
  const [previewSale, setPreviewSale] = useState<SaleFormState | null>(null)
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null)
  const [deleteSaleTarget, setDeleteSaleTarget] = useState<SaleRecord | null>(null)

  const itemFilterOptions = ['All Items', ...inventoryItems.map(item => item.item)]

  const filteredSales = useMemo(() => {
    return salesRecords.filter(sale => {
      const matchItem = selectedItemFilter === 'All Items' || sale.item === selectedItemFilter
      const matchCategory = selectedCategoryFilter === 'All' || sale.category === selectedCategoryFilter
      const matchSearch = !search || sale.item.toLowerCase().includes(search.toLowerCase())
      return matchItem && matchCategory && matchSearch
    })
  }, [salesRecords, search, selectedCategoryFilter, selectedItemFilter])

  const salesMetrics = useMemo(() => {
    const grandTotalSales = filteredSales.reduce((sum, sale) => sum + sale.cost * sale.numberOfSales, 0)
    const orderDiscount = filteredSales.reduce((sum, sale) => sum + sale.discount, 0)
    const netSales = Math.max(grandTotalSales - orderDiscount, 0)

    return { grandTotalSales, orderDiscount, netSales }
  }, [filteredSales])

  const { grandTotalSales, netSales, orderDiscount } = salesMetrics

  const resetForm = () => {
    setForm(emptyForm())
    setFormErrors({})
    setPreviewSale(null)
    setEditingSale(null)
  }

  const openAddSale = () => {
    resetForm()
    setIsModalOpen(true)
  }

  const openEditSale = (sale: SaleRecord) => {
    const matchedItem = inventoryItems.find(item => item.item === sale.item)
    const initialForm: SaleFormState = {
      itemId: matchedItem?.id ?? '',
      item: sale.item,
      foodCost: String(sale.cost),
      numberOfSales: String(sale.numberOfSales),
      category: sale.category,
      discount: String(sale.discount),
    }

    setEditingSale(sale)
    setForm(initialForm)
    setFormErrors({})
    setPreviewSale(null)
    setIsModalOpen(true)
  }

  const handleItemSelect = (itemId: string) => {
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
      category: selectedItem.category,
    }))
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

    const nextRecord: SaleRecord = {
      id: editingSale ? editingSale.id : `SAL-${Date.now()}`,
      item: previewSale.item,
      cost: parsedCost,
      numberOfSales: parsedSales,
      discount: parsedDiscount,
      category: previewSale.category,
      createdAt: editingSale ? editingSale.createdAt : new Date().toISOString(),
      createdBy: editingSale ? editingSale.createdBy : 'Admin',
      updatedAt: new Date().toISOString(),
      updatedBy: 'Admin',
    }

    if (editingSale) {
      setSalesRecords(prev => prev.map(sale => (sale.id === editingSale.id ? nextRecord : sale)))
      showToast({ type: 'success', message: 'Sale updated', description: `${nextRecord.item} has been updated.` })
    } else {
      setSalesRecords(prev => [nextRecord, ...prev])
      showToast({ type: 'success', message: 'Sale added', description: `${nextRecord.item} was added to sales records.` })
    }

    setIsModalOpen(false)
    setPreviewSale(null)
    resetForm()
  }

  const handleDelete = (sale: SaleRecord) => {
    setDeleteSaleTarget(sale)
  }

  const tableHeaders = ['Item', 'Cost', 'No. of Sales', 'Discount', 'Category', 'Sale Created', 'Created By']

  const renderTable = () => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        {!isMobile ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {tableHeaders.map(header => (
                  <th key={header} className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display whitespace-nowrap">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-sm text-slate-400">No sales records found.</td>
                </tr>
              ) : (
                filteredSales.map(sale => (
                  <tr
                    key={sale.id}
                    className="hover:bg-slate-50 group cursor-pointer"
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
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 text-center">{formatCurrency(sale.cost)}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 text-center">{sale.numberOfSales}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 text-center">{formatCurrency(sale.discount)}</td>
                    <td className="py-3 px-4 text-sm text-slate-600 text-center">{sale.category}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 text-center">{new Date(sale.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-sm text-slate-600 text-center">{sale.createdBy}</td>
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
              filteredSales.map(sale => (
                <button key={sale.id} type="button" onClick={() => setSelectedSale(sale)} className="text-left p-3 border-b border-slate-50 hover:bg-slate-50 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-700 font-display">{sale.item}</div>
                    <div className="text-xs text-slate-400">{sale.category}</div>
                  </div>
                  <div className="text-sm font-mono text-slate-700">{formatCurrency(sale.cost * sale.numberOfSales)}</div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-display">Sales</h2>
          <p className="text-sm text-slate-500 mt-0.5">Track and manage sales activity</p>
        </div>
        <button type="button" onClick={openAddSale} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg font-display">
          <Plus size={16} /> Add Sale
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 shadow-sm flex flex-wrap gap-3">
        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 flex-1 min-w-48 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
          <Search size={14} className="text-slate-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sale item..." className="bg-transparent text-sm outline-none text-slate-700 w-full placeholder:text-slate-400" />
        </div>

        <select value={selectedItemFilter} onChange={e => setSelectedItemFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 font-display text-slate-600">
          {itemFilterOptions.map(item => (
            <option key={item} value={item}>{item === 'All Items' ? 'All Items' : item}</option>
          ))}
        </select>

        <select value={selectedCategoryFilter} onChange={e => setSelectedCategoryFilter(e.target.value as 'All' | InventoryCategory)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 font-display text-slate-600">
          <option value="All">All Categories</option>
          <option value="Menu Item">Menu Item</option>
          <option value="Others">Others</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Grand Total Sales', value: formatCurrency(grandTotalSales) },
          { label: 'Net Sales', value: formatCurrency(netSales) },
          { label: 'Order Discount', value: formatCurrency(orderDiscount) },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 font-display">{card.label}</p>
            <p className="mt-3 text-2xl font-bold text-slate-800 font-display">{card.value}</p>
          </div>
        ))}
      </div>

      {renderTable()}

      <Modal open={isModalOpen} title={editingSale ? 'Edit Sale' : 'Add Sale'} onClose={() => { setIsModalOpen(false); resetForm(); }}>
        {!previewSale ? (
          <div className="space-y-4 w-full">
            <div className="w-md">
              <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Item</label>
              <select
                value={form.itemId}
                onChange={e => handleItemSelect(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">Select item</option>
                {inventoryItems.map(item => (
                  <option key={item.id} value={item.id}>{item.item}</option>
                ))}
              </select>
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
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
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
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                placeholder="1"
                inputMode="numeric"
              />
              {formErrors.numberOfSales && <p className="mt-1 text-xs text-red-600">{formErrors.numberOfSales}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Category</label>
              <input value={form.category} readOnly className="w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-sm text-slate-500 outline-none" />
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
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
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
            <p className="text-xs text-slate-500 mb-5">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setDeleteSaleTarget(null)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
              <button
                type="button"
                onClick={() => {
                  const sale = deleteSaleTarget
                  setSalesRecords(prev => prev.filter(entry => entry.id !== sale.id))
                  showToast({ type: 'success', message: 'Sale deleted', description: `${sale.item} was removed.` })
                  setDeleteSaleTarget(null)
                }}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg font-display"
              >
                Delete
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

                <div>
                <p className="text-xs text-slate-400">Updated</p>
                <p className="text-sm font-medium">
                    {new Date(selectedSale.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Created By</p>
                <p className="text-sm font-medium">{selectedSale.createdBy}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Updated By</p>
                <p className="text-sm font-medium">{selectedSale.updatedBy}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => { setSelectedSale(null); openEditSale(selectedSale) }} className="px-3 py-2 text-sm text-white bg-green-700 hover:bg-green-600 rounded-lg">Edit</button>
              <button type="button" onClick={() => { setSelectedSale(null); setDeleteSaleTarget(selectedSale) }} className="px-3 py-2 text-sm text-white bg-red-700 hover:bg-red-600 rounded-lg">Delete</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
