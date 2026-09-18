'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Search, Pencil, Trash2 } from 'lucide-react'
import { useApp } from '../App'
import Modal from '../components/Modal'
import useIsMobile from '../hooks/isMobile'
import PaginationFooter from '../components/PaginationFooter'
import { useRealtimeEntity } from '../hooks/useRealtimeEntity'
import DateFilter, { dateInRange, defaultDateFilterValue, resolveDateRange, type DateFilterValue } from '../components/DateFilter'
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
  restaurant: string
}

const emptyForm = (): ExpenseFormState => ({ expense: '', amount: '', restaurant: 'Lakay Ago' })

const getValidationErrors = (form: ExpenseFormState) => {
  const errors: Partial<Record<keyof ExpenseFormState, string>> = {}
  if (!form.expense.trim()) {
    errors.expense = 'Expense name is required.'
  }

  if (!form.restaurant) {
    errors.restaurant = 'Restaurant is required.'
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

const PRESET_EXPENSES = ['Salary', 'Internet', 'Electricity', 'Water', 'Rental', 'Parking Fee', 'Ingredients', 'BIR'] as const

export default function Expenses() {
  const { showToast } = useApp()
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([])
  const isMobile = useIsMobile()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null)
  const [selectedExpenseFilter, setSelectedExpenseFilter] = useState('All Expenses')
  const [selectedRestaurantFilter, setSelectedRestaurantFilter] = useState('All Restaurants')
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(defaultDateFilterValue)
  const [searchTerm, setSearchTerm] = useState('')
  const [serviceTransactions, setServiceTransactions] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [expensesLoading, setExpensesLoading] = useState(true)
  const [txLoading, setTxLoading] = useState(true)
  const [dailyExpensePage, setDailyExpensePage] = useState(1)
  const [serviceExpensePage, setServiceExpensePage] = useState(1)
  const [form, setForm] = useState<ExpenseFormState>(emptyForm())
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ExpenseFormState, string>>>({})
  const [previewExpense, setPreviewExpense] = useState<ExpenseFormState | null>(null)
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRecord | null>(null)
  const [deleteExpenseTarget, setDeleteExpenseTarget] = useState<ExpenseRecord | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)

  const allExpenseNames = useMemo(() => {
    const names: string[] = [...PRESET_EXPENSES]
    for (const exp of expenses) {
      if (!names.includes(exp.expense)) names.push(exp.expense)
    }
    return names
  }, [expenses])

  const filteredOptions = useMemo(() => {
    if (!form.expense) return allExpenseNames
    return allExpenseNames.filter(name =>
      name.toLowerCase().includes(form.expense.toLowerCase())
    )
  }, [allExpenseNames, form.expense])

  const refreshExpenseData = useCallback(async () => {
    let mounted = true
    setExpensesLoading(true)
    try {
      const [expensesRes, txRes, servicesRes] = await Promise.all([
        fetch('/api/expenses'),
        fetch('/api/service_transactions'),
        fetch('/api/services'),
      ])

      const expensesJson = await expensesRes.json()
      const txJson = await txRes.json()
      const servicesJson = await servicesRes.json()

      if (!mounted) return
      setExpenses(expensesJson.expenses || [])
      setServiceTransactions((txJson.transactions || []).filter((tx: any) => tx.status === 'Finalized' || tx.status === 'Fully Paid'))
      setServices(servicesJson.services || [])
    } catch {
      if (!mounted) return
      setExpenses([])
      setServiceTransactions([])
      setServices([])
    } finally {
      if (mounted) {
        setExpensesLoading(false)
        setTxLoading(false)
      }
    }

    return () => { mounted = false }
  }, [])

  useEffect(() => {
    void refreshExpenseData()
  }, [refreshExpenseData])

  useRealtimeEntity('expenses', {
    onChange: () => {
      void refreshExpenseData()
    },
  })

  useRealtimeEntity('service_transactions', {
    onChange: () => {
      void refreshExpenseData()
    },
  })

  const serviceNameMap = useMemo(
    () => Object.fromEntries((services || []).map((service: any) => [String(service.service_id), service.service_type || 'Service'])),
    [services],
  )

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

  const expenseFilterOptions = ['All Expenses', ...expenses.map(expense => expense.expense)]
  const restaurantOptions = useMemo(
    () => Array.from(new Set([
      ...expenses.map(expense => (expense as any).restaurant).filter(Boolean),
      ...serviceTransactions.map(tx => tx.restaurant).filter(Boolean),
    ] as string[])).sort(),
    [expenses, serviceTransactions],
  )

  const expenseDateRange = useMemo(() => resolveDateRange(dateFilter), [dateFilter])

  const filteredExpenses = useMemo(
    () => expenses.filter(expense => {
      const matchesExpense = selectedExpenseFilter === 'All Expenses' || expense.expense === selectedExpenseFilter
      const matchesRestaurant = selectedRestaurantFilter === 'All Restaurants' || (expense as any).restaurant === selectedRestaurantFilter
      const matchesDate = dateInRange(expense.createdAt, expenseDateRange)
      const matchesSearch = !searchTerm || [expense.expense, (expense as any).restaurant, expense.createdBy].join(' ').toLowerCase().includes(searchTerm.toLowerCase())
      return matchesExpense && matchesRestaurant && matchesDate && matchesSearch
    }),
    [expenses, selectedExpenseFilter, selectedRestaurantFilter, expenseDateRange, searchTerm],
  )

  const serviceTransactionExpenses = useMemo(
    () => serviceTransactions
      .filter(tx => {
        const isEligibleStatus = tx.status === 'Finalized' || tx.status === 'Fully Paid'
        const matchesRestaurant = selectedRestaurantFilter === 'All Restaurants' || tx.restaurant === selectedRestaurantFilter
        const matchesDate = dateInRange(tx.service_date, expenseDateRange)
        const matchesSearch = !searchTerm || [
          serviceNameMap[String(tx.service_id)],
          tx.restaurant,
          tx.status,
          (tx.service_date || '').slice(0, 10),
        ].join(' ').toLowerCase().includes(searchTerm.toLowerCase())
        return isEligibleStatus && Number(tx.expenses || 0) > 0 && matchesRestaurant && matchesDate && matchesSearch
      })
      .map(tx => ({
        id: `service-transaction-${tx.service_transaction_id}`,
        expense: serviceNameMap[String(tx.service_id)],
        amount: Number(tx.expenses || 0),
        createdAt: tx.service_date,
        createdBy: tx.status,
        restaurant: tx.restaurant,
        service_transaction_id: tx.service_transaction_id,
      })),
    [expenseDateRange, selectedRestaurantFilter, searchTerm, serviceNameMap, serviceTransactions],
  )

  const expenseTableTotal = useMemo(
    () => filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    [filteredExpenses],
  )

  const serviceTransactionTableTotal = useMemo(
    () => serviceTransactionExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    [serviceTransactionExpenses],
  )

  const totalExpenses = useMemo(
    () => expenseTableTotal + serviceTransactionTableTotal,
    [expenseTableTotal, serviceTransactionTableTotal],
  )

  const dailyExpensePageSize = 10
  const serviceExpensePageSize = 10
  const dailyExpensePageCount = Math.max(1, Math.ceil(filteredExpenses.length / dailyExpensePageSize))
  const serviceExpensePageCount = Math.max(1, Math.ceil(serviceTransactionExpenses.length / serviceExpensePageSize))
  const paginatedDailyExpenses = useMemo(
    () => filteredExpenses.slice((dailyExpensePage - 1) * dailyExpensePageSize, dailyExpensePage * dailyExpensePageSize),
    [dailyExpensePage, filteredExpenses],
  )
  const paginatedServiceExpenseRows = useMemo(
    () => serviceTransactionExpenses.slice((serviceExpensePage - 1) * serviceExpensePageSize, serviceExpensePage * serviceExpensePageSize),
    [serviceExpensePage, serviceTransactionExpenses],
  )

  const dailyEmptyCount = paginatedDailyExpenses.length === 0 ? 0 : Math.max(0, dailyExpensePageSize - paginatedDailyExpenses.length)
  const serviceExpenseEmptyCount = paginatedServiceExpenseRows.length === 0 ? 0 : Math.max(0, serviceExpensePageSize - paginatedServiceExpenseRows.length)

  useEffect(() => { setDailyExpensePage(1) }, [selectedExpenseFilter, selectedRestaurantFilter, dateFilter, searchTerm, filteredExpenses.length])
  useEffect(() => { setServiceExpensePage(1) }, [selectedRestaurantFilter, dateFilter, searchTerm, serviceTransactionExpenses.length])

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
      restaurant: (expense as any).restaurant || 'Lakay Ago',
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
      restaurant: form.restaurant,
    })
  }

  const handleConfirm = async () => {
    if (!previewExpense) {
      showToast({ type: 'error', message: 'Unable to save expense', description: 'Expense preview is missing.' })
      return
    }

    const amount = Number(previewExpense.amount)
    if (Number.isNaN(amount) || amount < 0) {
      showToast({ type: 'error', message: 'Invalid expense amount', description: 'Please enter a valid non-negative amount.' })
      return
    }

    try {
      if (editingExpense) {
        const res = await fetch(`/api/expenses/${editingExpense.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expense: previewExpense.expense,
            amount,
            restaurant: previewExpense.restaurant,
          }),
        })

        const payload = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(payload?.error || 'Failed to update expense')
        }

        const updatedExpense = payload.expense || {
          ...editingExpense,
          expense: previewExpense.expense,
          amount,
          restaurant: previewExpense.restaurant,
        }

        setExpenses(prev => prev.map(expense => (expense.id === editingExpense.id ? {
          ...expense,
          expense: updatedExpense.expense,
          amount: Number(updatedExpense.amount ?? amount),
          restaurant: updatedExpense.restaurant || previewExpense.restaurant,
        } : expense)))
        showToast({ type: 'success', message: 'Expense updated', description: `${updatedExpense.expense} has been updated.` })
      } else {
        // submit to API
        const r = await fetch('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expense: previewExpense.expense, amount, restaurant: previewExpense.restaurant }) })
        if (!r.ok) throw new Error('Failed')
        const j = await r.json()
        const created = j.expense
        setExpenses(prev => [created, ...prev])
        showToast({ type: 'success', message: 'Expense added', description: `${created.expense} was added.` })
      }
    } catch (error: any) {
      showToast({ type: 'error', message: editingExpense ? 'Failed to update expense' : 'Failed to add expense', description: error?.message || 'Unable to save expense.' })
      return
    }

    setIsModalOpen(false)
    setPreviewExpense(null)
    resetForm()
  }

  const handleDelete = (expense: ExpenseRecord) => {
    setDeleteExpenseTarget(expense)
  }

  const tableHeaders = ['Expense', 'Restaurant', 'Date Added', 'Amount', 'Actions']

  const renderTable = () => (
    <div className="bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        {!isMobile ? (
          <table className="w-full ">
            <thead>
              <tr className="border-slate-100 bg-indigo-600 text-white">
                {tableHeaders.map(header => (
                  <th key={header} 
                  className={`${header === 'Amount' ? 'text-right' : 'text-center'} py-3 px-5 text-xs font-semibold uppercase tracking-wide font-display whitespace-nowrap`}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {expensesLoading ? (
                <SkeletonTableRows
                  columns={5}
                  rows={dailyExpensePageSize}
                  columnConfig={[
                    { width: '60%' },
                    { width: '20%' },
                    { width: '30%' },
                    { width: '25%', pill: false },
                    { width: '40%' },
                  ]}
                />
              ) : paginatedDailyExpenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">No expenses recorded.</td>
                </tr>
              ) : (
                paginatedDailyExpenses.map((expense, index) => (
                  <tr
                    key={expense.id}
                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-100'} hover:bg-slate-50 group cursor-pointer`}
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
                    <td className="py-3 px-4 text-sm text-slate-600 text-center">{expense.restaurant}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 text-center">{new Date(expense.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 text-right">{formatCurrency(expense.amount)}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => openEdit(expense)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(expense)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-800 hover:underline cursor-pointer"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
              {dailyEmptyCount > 0 && (
                Array.from({ length: dailyEmptyCount }).map((_, ei) => (
                  <tr key={`empty-${ei}`} className="invisible">
                    <td className="py-3 px-4 text-sm font-medium text-slate-700 font-display">Placeholder</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 text-center">2020-01-01</td>
                    <td className="py-3 px-4 text-sm text-slate-600 text-center">Restaurant</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 text-right">PHP 0.00</td>
                    <td className="py-3 px-4 text-center"><div className="invisible">Actions</div></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col">
            {expensesLoading ? (
              Array.from({ length: dailyExpensePageSize }).map((_, idx) => (
                <div key={`skel-mobile-${idx}`} className="text-left p-3 border-b border-slate-50 hover:bg-slate-50 flex items-center justify-between gap-3">
                  <div className="w-full">
                    <div className="mb-2"><SkeletonBar width="60%" height="0.9rem" rounded="rounded-md" /></div>
                    <div className="text-xs text-slate-400"><SkeletonBar width="30%" height="0.7rem" rounded="rounded-md" /></div>
                  </div>
                  <div className="w-24"><SkeletonBar width="90%" height="0.9rem" rounded="rounded-md" /></div>
                </div>
              ))
            ) : (expensesLoading === false && (
              paginatedDailyExpenses.length === 0 ? (
                <div className="p-4 text-sm text-slate-400">No expenses recorded.</div>
              ) : (
                paginatedDailyExpenses.map((expense, index) => (
                  <button key={expense.id} type="button" onClick={() => setSelectedExpense(expense)} className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-100'} text-left p-3 border-b border-slate-50 hover:bg-slate-50 flex items-center justify-between gap-3`}>
                    <div>
                      <div className="text-sm font-semibold text-slate-700 font-display">{expense.expense}</div>
                      <div className="text-xs text-slate-400">{new Date(expense.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div className="text-sm font-mono text-slate-700">{formatCurrency(expense.amount)}</div>
                  </button>
                ))
              )
            ))
            }
          </div>
        )}
      </div>
      <PaginationFooter items={filteredExpenses} page={dailyExpensePage} setPage={setDailyExpensePage} pageSize={dailyExpensePageSize} noun="expenses" />
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
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center"> 
            <div>
              <select
                value={selectedExpenseFilter}
                onChange={e => setSelectedExpenseFilter(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 font-display text-slate-600"
              >
                {expenseFilterOptions.map(expense => (
                  <option key={expense} value={expense}>
                    {expense === 'All Expenses' ? 'All Expenses (Type)' : expense}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={selectedRestaurantFilter}
                onChange={e => setSelectedRestaurantFilter(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 font-display text-slate-600"
              >
                <option value="All Restaurants">All Restaurants</option>
                {restaurantOptions.map(restaurant => (
                  <option key={restaurant} value={restaurant}>{restaurant}</option>
                ))}
              </select>
            </div>

            <div>
              <DateFilter
                value={dateFilter}
                onChange={setDateFilter}
                allLabel="All Expenses (Date)"
                className="w-full"
                controlClassName="w-full"
              />
            </div>

            <div className="relative w-full max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search expenses or restaurant"
                className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 font-display text-slate-600"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 font-display">Total Expenses</p>
          <p className="mt-2 text-2xl font-bold text-slate-800 font-display">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 font-display">Total Service Transaction Expense</p>
          <p className="mt-2 text-2xl font-bold text-slate-800 font-display">{formatCurrency(serviceTransactionTableTotal)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 font-display">Total Daily Expenses</p>
          <p className="mt-2 text-2xl font-bold text-slate-800 font-display">{formatCurrency(expenseTableTotal)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-wide text-slate-600 font-display">Daily Expense</h3>
          </div>
          {renderTable()}
        </div>
          
        <div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-wide text-slate-600 font-display">Service Transaction Expenses</h3>
            </div>
            {isMobile ? (
              <div className="flex flex-col">
                {txLoading ? (
                  Array.from({ length: serviceExpensePageSize }).map((_, idx) => (
                    <div key={`skel-mobile-srv-${idx}`} className="text-left p-3 border-b border-slate-50 flex items-center justify-between gap-3">
                      <div className="w-full">
                        <div className="mb-2"><SkeletonBar width="60%" height="0.9rem" rounded="rounded-md" /></div>
                        <div className="text-xs text-slate-400"><SkeletonBar width="30%" height="0.7rem" rounded="rounded-md" /></div>
                      </div>
                      <div className="w-24"><SkeletonBar width="90%" height="0.9rem" rounded="rounded-md" /></div>
                    </div>
                  ))
                ) : paginatedServiceExpenseRows.length === 0 ? (
                  <div className="p-4 text-sm text-slate-400">No finalized service transaction expenses.</div>
                ) : (
                  paginatedServiceExpenseRows.map(expense => (
                    <div key={expense.id} className="text-left p-3 border-b border-slate-50 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-700 font-display">{expense.expense}</div>
                        <div className="text-xs text-slate-400">{expense.restaurant} · {new Date(expense.createdAt).toLocaleDateString()}</div>
                      </div>
                      <div className="text-sm font-mono text-slate-700">{formatCurrency(expense.amount)}</div>
                    </div>
                  ))
                )}
              </div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-indigo-600 text-white">
                    <th className="text-center py-3 px-4 text-xs font-semibold uppercase tracking-wide font-display whitespace-nowrap">Expense</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold uppercase tracking-wide font-display whitespace-nowrap">Amount</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold uppercase tracking-wide font-display whitespace-nowrap">Date</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold uppercase tracking-wide font-display whitespace-nowrap">Restaurant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {txLoading ? (
                    <SkeletonTableRows
                      columns={4}
                      rows={serviceExpensePageSize}
                      columnConfig={[
                        { width: '50%' },
                        { width: '25%' },
                        { width: '15%' },
                        { width: '25%' },
                      ]}
                    />
                  ) : paginatedServiceExpenseRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">No finalized service transaction expenses.</td>
                    </tr>
                  ) : (
                    paginatedServiceExpenseRows.map(expense => (
                      <tr key={expense.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 text-sm font-medium text-slate-700 font-display text-center">{expense.expense}</td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-700 text-center">{formatCurrency(expense.amount)}</td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 text-center">{new Date(expense.createdAt).toLocaleDateString()}</td>
                        <td className="py-3 px-4 text-sm text-slate-600 text-center">{expense.restaurant}</td>
                      </tr>
                    ))
                  )}
                  {!isMobile && serviceExpenseEmptyCount > 0 && (
                    Array.from({ length: serviceExpenseEmptyCount }).map((_, ei) => (
                      <tr key={`empty-srv-${ei}`} className="invisible">
                        <td className="py-3 px-4 text-sm font-medium text-slate-700 font-display text-center">Placeholder</td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-700 text-center">PHP 0.00</td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 text-center">2020-01-01</td>
                        <td className="py-3 px-4 text-sm text-slate-600 text-center">Restaurant</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            )}
            <PaginationFooter items={serviceTransactionExpenses} page={serviceExpensePage} setPage={setServiceExpensePage} pageSize={serviceExpensePageSize} noun="expenses" />
          </div>
        </div>
      </div>

      <Modal open={isModalOpen} title={editingExpense ? 'Edit Expense' : 'Add Expense'} onClose={() => { setIsModalOpen(false); resetForm(); }}>
        {!previewExpense ? (
          <div className="space-y-4">
            <div className="w-md relative">
              <label className="block text-xs font-medium text-slate-600 mb-1 font-display">Expense</label>
              <input
                value={form.expense}
                onChange={e => {
                  setForm(prev => ({ ...prev, expense: e.target.value }))
                  setShowDropdown(true)
                }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                placeholder="Type or select an expense"
              />
              {showDropdown && filteredOptions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 border border-slate-200 rounded-lg bg-white shadow-lg max-h-[140px] overflow-y-auto">
                  {filteredOptions.map(name => (
                    <button
                      key={name}
                      type="button"
                      onMouseDown={() => {
                        setForm(prev => ({ ...prev, expense: name }))
                        setShowDropdown(false)
                      }}
                      className={`w-full px-3 py-2 text-sm text-left hover:bg-slate-50 ${form.expense === name ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'}`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
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
              {formErrors.restaurant && <p className="mt-1 text-xs text-red-600">{formErrors.restaurant}</p>}
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
                <p className="text-xs text-slate-500">Restaurant</p>
                <p className="mt-1 text-sm font-semibold text-slate-800 font-display">{previewExpense?.restaurant}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Date Added</p>
                <p className="mt-1 text-sm font-semibold text-slate-800 font-display">{new Date().toLocaleDateString()}</p>
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
                 <p className="text-xs text-slate-400">Date Added</p>
                 <p className="text-sm font-medium">{new Date(selectedExpense.createdAt).toLocaleDateString()}</p>
               </div>
               <div>
                 <p className="text-xs text-slate-400">Restaurant</p>
                 <p className="text-sm font-medium">{selectedExpense.restaurant}</p>
               </div>
             </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => { setSelectedExpense(null); openEdit(selectedExpense) }} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer">
                <Pencil size={14} /> Edit
              </button>
              <button type="button" onClick={() => { setSelectedExpense(null); handleDelete(selectedExpense) }} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer">
                <Trash2 size={14} /> Delete
              </button>
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
                onClick={async () => {
                    const expense = deleteExpenseTarget
                    try {
                      const res = await fetch(`/api/expenses/${expense.id}`, { method: 'DELETE' })
                      const payload = await res.json().catch(() => ({}))
                      if (!res.ok) {
                        throw new Error(payload?.error || 'Failed to delete expense')
                      }

                      setExpenses(prev => prev.filter(entry => entry.id !== expense.id))
                      showToast({
                        type: 'success',
                        message: 'Expense deleted',
                        description: `${expense.expense} was removed.`,
                      })
                    } catch (error: any) {
                      showToast({
                        type: 'error',
                        message: 'Delete failed',
                        description: error?.message || 'Unable to delete expense.',
                      })
                      return
                    } finally {
                      setDeleteExpenseTarget(null)
                    }
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
