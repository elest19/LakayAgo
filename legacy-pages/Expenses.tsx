'use client'
import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useApp } from '../App'
import Modal from '../components/Modal'
import useIsMobile from '../hooks/isMobile'
import type { ExpenseRecord } from '../types'

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(value)

interface ExpenseFormState {
  expense: string
  amount: string
}

const emptyForm = (): ExpenseFormState => ({ expense: '', amount: '' })

const getValidationErrors = (form: ExpenseFormState) => {
  const errors: Partial<Record<keyof ExpenseFormState, string>> = {}
  if (!form.expense.trim()) {
    errors.expense = 'Expense name is required.'
  }

  if (form.amount === '' || form.amount.trim() === '') {
    errors.amount = 'Amount is required.'
  } else {
    const parsed = Number(form.amount)
    if (Number.isNaN(parsed) || parsed < 0) {
      errors.amount = 'Amount must be a valid non-negative number.'
    }
  }

  return errors
}

export default function Expenses() {
  const { expenses, setExpenses, showToast } = useApp()
  const isMobile = useIsMobile()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null)
  const [selectedExpenseFilter, setSelectedExpenseFilter] = useState('All Expenses')
  const [form, setForm] = useState<ExpenseFormState>(emptyForm())
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ExpenseFormState, string>>>({})
  const [previewExpense, setPreviewExpense] = useState<ExpenseFormState | null>(null)
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRecord | null>(null)
  const [deleteExpenseTarget, setDeleteExpenseTarget] = useState<ExpenseRecord | null>(null)

  const expenseFilterOptions = ['All Expenses', ...expenses.map(expense => expense.expense)]

  const filteredExpenses = useMemo(
    () => expenses.filter(expense => selectedExpenseFilter === 'All Expenses' || expense.expense === selectedExpenseFilter),
    [expenses, selectedExpenseFilter],
  )

  const totalExpenses = useMemo(
    () => filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    [filteredExpenses],
  )

  const resetForm = () => {
    setForm(emptyForm())
    setFormErrors({})
    setPreviewExpense(null)
    setEditingExpense(null)
  }

  const openCreate = () => {
    resetForm()
    setIsModalOpen(true)
  }

  const openEdit = (expense: ExpenseRecord) => {
    setEditingExpense(expense)
    setForm({
      expense: expense.expense,
      amount: String(expense.amount),
    })
    setFormErrors({})
    setPreviewExpense(null)
    setIsModalOpen(true)
  }

  const handleProceed = () => {
    const nextErrors = getValidationErrors(form)
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors)
      return
    }

    setPreviewExpense({
      expense: form.expense.trim(),
      amount: form.amount,
    })
  }

  const handleConfirm = () => {
    if (!previewExpense) {
      showToast({ type: 'error', message: 'Unable to save expense', description: 'Expense preview is missing.' })
      return
    }

    const amount = Number(previewExpense.amount)
    if (Number.isNaN(amount) || amount < 0) {
      showToast({ type: 'error', message: 'Invalid expense amount', description: 'Please enter a valid non-negative amount.' })
      return
    }

    if (editingExpense) {
      const updatedExpense: ExpenseRecord = {
        ...editingExpense,
        expense: previewExpense.expense,
        amount,
        updatedAt: new Date().toISOString(),
        updatedBy: 'Admin',
      }

      setExpenses(prev => prev.map(expense => (expense.id === editingExpense.id ? updatedExpense : expense)))
      showToast({ type: 'success', message: 'Expense updated', description: `${updatedExpense.expense} has been updated.` })
    } else {
      const newExpense: ExpenseRecord = {
        id: `EXP-${Date.now()}`,
        expense: previewExpense.expense,
        amount,
        createdAt: new Date().toISOString(),
        createdBy: 'Admin',
        updatedAt: new Date().toISOString(),
        updatedBy: 'Admin',
      }

      setExpenses(prev => [newExpense, ...prev])
      showToast({ type: 'success', message: 'Expense added', description: `${newExpense.expense} was added to the expense list.` })
    }

    setIsModalOpen(false)
    setPreviewExpense(null)
    resetForm()
  }

  const handleDelete = (expense: ExpenseRecord) => {
    setDeleteExpenseTarget(expense)
  }

  const tableHeaders = ['Expense', 'Amount', 'Created_At', 'Created_By', 'Updated_At', 'Updated_By']

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
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">No expenses recorded.</td>
                </tr>
              ) : (
                filteredExpenses.map(expense => (
                  <tr
                    key={expense.id}
                    className="hover:bg-slate-50 group cursor-pointer"
                    onClick={() => setSelectedExpense(expense)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedExpense(expense)
                      }
                    }}
                  >
                    <td className="py-3 px-4 text-sm font-medium text-slate-700 font-display">{expense.expense}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 text-center">{formatCurrency(expense.amount)}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 text-center">{new Date(expense.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-sm text-slate-600 text-center">{expense.createdBy}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 text-center">{new Date(expense.updatedAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-sm text-slate-600 text-center">{expense.updatedBy}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col">
            {filteredExpenses.length === 0 ? (
              <div className="p-4 text-sm text-slate-400">No expenses recorded.</div>
            ) : (
              filteredExpenses.map(expense => (
                <button key={expense.id} type="button" onClick={() => setSelectedExpense(expense)} className="text-left p-3 border-b border-slate-50 hover:bg-slate-50 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-700 font-display">{expense.expense}</div>
                    <div className="text-xs text-slate-400">{new Date(expense.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div className="text-sm font-mono text-slate-700">{formatCurrency(expense.amount)}</div>
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
          <h2 className="text-xl font-bold text-slate-800 font-display">Expenses</h2>
          <p className="text-sm text-slate-500 mt-0.5">Track operating and business expenses</p>
        </div>
        <button type="button" onClick={openCreate} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg font-display">
          <Plus size={16} /> Add Expense
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
                <select
                    value={selectedExpenseFilter}
                    onChange={e => setSelectedExpenseFilter(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 font-display text-slate-600"
                >
                    {expenseFilterOptions.map(expense => (
                    <option key={expense} value={expense}>
                        {expense === 'All Expenses' ? 'All Expenses' : expense}
                    </option>
                    ))}
                </select>
            </div>

            {/* Total Expenses */}
            <div className="sm:text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 font-display">
                    Total Expenses
                </p>

                <p className="mt-1 text-2xl font-bold text-slate-800 font-display">
                    {formatCurrency(totalExpenses)}
                </p>
            </div>
        </div>
        </div>

      {renderTable()}

      <Modal open={isModalOpen} title={editingExpense ? 'Edit Expense' : 'Add Expense'} onClose={() => { setIsModalOpen(false); resetForm(); }}>
        {!previewExpense ? (
          <div className="space-y-4">
            <div className="w-md">
              <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Expense</label>
              <input
                value={form.expense}
                onChange={e => setForm(prev => ({ ...prev, expense: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                placeholder="Enter expense name"
              />
              {formErrors.expense && <p className="mt-1 text-xs text-red-600">{formErrors.expense}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Amount</label>
              <input
                value={form.amount}
                onChange={e => {
                  const value = e.target.value
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                    setForm(prev => ({ ...prev, amount: value }))
                  }
                }}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                placeholder="0.00"
                inputMode="decimal"
              />
              {formErrors.amount && <p className="mt-1 text-xs text-red-600">{formErrors.amount}</p>}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => { setIsModalOpen(false); resetForm(); }} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Cancel</button>
              <button type="button" onClick={handleProceed} className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display">Proceed</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 w-full">
            <p className="text-sm text-slate-500">Please confirm the information before proceeding</p>
            <div className="grid gap-3">
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Expense</p>
                <p className="mt-1 text-sm font-semibold text-slate-800 font-display">{previewExpense?.expense}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Amount</p>
                <p className="mt-1 text-sm font-semibold text-slate-800 font-display">{previewExpense ? formatCurrency(Number(previewExpense.amount)) : ''}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Created_At</p>
                <p className="mt-1 text-sm font-semibold text-slate-800 font-display">{new Date().toLocaleString()}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setPreviewExpense(null)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display">Back</button>
              <button type="button" onClick={handleConfirm} className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-display">{editingExpense ? 'Confirm Expense' : 'Add Expense'}</button>
            </div>
          </div>
        )}
      </Modal>

      {selectedExpense && (
        <Modal open={!!selectedExpense} title={selectedExpense.expense} onClose={() => setSelectedExpense(null)}>
          <div className="space-y-3 w-full max-w-md">
            <div className="w-md grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <p className="text-xs text-slate-400">Amount</p>
                <p className="text-sm font-medium">{formatCurrency(selectedExpense.amount)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Created</p>
                <p className="text-sm font-medium">{new Date(selectedExpense.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Created By</p>
                <p className="text-sm font-medium">{selectedExpense.createdBy}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Updated</p>
                <p className="text-sm font-medium">{new Date(selectedExpense.updatedAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Updated By</p>
                <p className="text-sm font-medium">{selectedExpense.updatedBy}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => { setSelectedExpense(null); openEdit(selectedExpense) }} className="px-3 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">Edit</button>
              <button type="button" onClick={() => { setSelectedExpense(null); handleDelete(selectedExpense) }} className="px-3 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg">Delete</button>
            </div>
          </div>
        </Modal>
      )}
      {deleteExpenseTarget && (
        <Modal
            open={!!deleteExpenseTarget}
            title="Confirm deletion"
            onClose={() => setDeleteExpenseTarget(null)}
        >
            <div className="w-full p-2">
            <p className="text-sm text-slate-600 mb-4">
                Are you sure you want to delete{' '}
                <span className="font-semibold text-slate-700">
                {deleteExpenseTarget.expense}
                </span>
                ?
            </p>

            <p className="text-xs text-slate-500 mb-5">
                This action cannot be undone.
            </p>

            <div className="flex gap-3 justify-end">
                <button
                type="button"
                onClick={() => setDeleteExpenseTarget(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 font-display"
                >
                Cancel
                </button>

                <button
                type="button"
                onClick={() => {
                    const expense = deleteExpenseTarget

                    setExpenses(prev =>
                    prev.filter(entry => entry.id !== expense.id)
                    )

                    showToast({
                    type: 'success',
                    message: 'Expense deleted',
                    description: `${expense.expense} was removed.`,
                    })

                    setDeleteExpenseTarget(null)
                }}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg font-display"
                >
                Delete
                </button>
            </div>
            </div>
        </Modal>
        )}
    </div>
  )
}
