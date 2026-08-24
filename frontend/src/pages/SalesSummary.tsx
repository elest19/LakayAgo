import { useMemo, useState } from 'react'
import { CalendarRange, DollarSign, ReceiptText, TrendingUp } from 'lucide-react'
import { useApp } from '../App'
import useIsMobile from '../hooks/isMobile'
import { AnimatePresence, motion } from 'motion/react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(value)

type DatePreset = 'today' | 'week' | 'month' | 'year' | 'custom'
type CustomMode = 'range' | 'single'

const toStartOfDay = (date: Date) => {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

const toEndOfDay = (date: Date) => {
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next
}

const startOfWeek = (date: Date) => {
  const next = new Date(date)
  const day = next.getDay()
  const diff = (day + 6) % 7
  next.setDate(next.getDate() - diff)
  return toStartOfDay(next)
}

const endOfWeek = (date: Date) => {
  const next = new Date(startOfWeek(date))
  next.setDate(next.getDate() + 6)
  return toEndOfDay(next)
}

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1)
const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0)
const startOfYear = (date: Date) => new Date(date.getFullYear(), 0, 1)
const endOfYear = (date: Date) => new Date(date.getFullYear(), 11, 31)

const isWithinRange = (value: string, start: Date, end: Date) => {
  const parsed = new Date(value)
  return parsed >= start && parsed <= end
}

const resolveDateWindow = (filter: DatePreset, customMode: CustomMode, rangeStart: string, rangeEnd: string, singleDate: string) => {
  const now = new Date()

  if (filter === 'today') {
    return { start: toStartOfDay(now), end: toEndOfDay(now), error: '' }
  }

  if (filter === 'week') {
    return { start: startOfWeek(now), end: endOfWeek(now), error: '' }
  }

  if (filter === 'month') {
    return { start: startOfMonth(now), end: toEndOfDay(endOfMonth(now)), error: '' }
  }

  if (filter === 'year') {
    return { start: startOfYear(now), end: toEndOfDay(endOfYear(now)), error: '' }
  }

  if (customMode === 'range') {
    if (!rangeStart || !rangeEnd) {
      return { start: null, end: null, error: 'Please choose both start and end dates.' }
    }

    const start = toStartOfDay(new Date(rangeStart))
    const end = toEndOfDay(new Date(rangeEnd))

    if (start > end) {
      return { start: null, end: null, error: 'Start date cannot be later than end date.' }
    }

    return { start, end, error: '' }
  }

  if (!singleDate) {
    return { start: null, end: null, error: 'Please select a date.' }
  }

  const start = toStartOfDay(new Date(singleDate))
  const end = toEndOfDay(new Date(singleDate))

  return { start, end, error: '' }
}

export default function SalesSummary() {
  const { inventoryItems, salesRecords, expenses } = useApp()
  const isMobile = useIsMobile()
  const [dateFilter, setDateFilter] = useState<DatePreset>('month')
  const [customMode, setCustomMode] = useState<CustomMode>('range')
  const [rangeStart, setRangeStart] = useState('2026-08-01')
  const [rangeEnd, setRangeEnd] = useState('2026-08-30')
  const [singleDate, setSingleDate] = useState('2026-08-21')

  const dateWindow = useMemo(
    () => resolveDateWindow(dateFilter, customMode, rangeStart, rangeEnd, singleDate),
    [dateFilter, customMode, rangeStart, rangeEnd, singleDate],
  )

  const filteredSales = useMemo(() => {
    if (!dateWindow.start || !dateWindow.end) return []
    return salesRecords.filter(sale => isWithinRange(sale.createdAt, dateWindow.start, dateWindow.end))
  }, [salesRecords, dateWindow])

  const filteredExpenses = useMemo(() => {
    if (!dateWindow.start || !dateWindow.end) return []
    return expenses.filter(expense => isWithinRange(expense.createdAt, dateWindow.start, dateWindow.end))
  }, [expenses, dateWindow])

  const itemSummary = useMemo(() => {
    return inventoryItems.map(item => {
      const matches = filteredSales.filter(sale => sale.item === item.item)
      const grandTotalSale = matches.reduce((sum, sale) => sum + sale.cost * sale.numberOfSales, 0)
      const orderDiscount = matches.reduce((sum, sale) => sum + sale.discount, 0)
      const netSale = Math.max(grandTotalSale - orderDiscount, 0)

      return {
        item: item.item,
        grandTotalSale,
        netSale,
        orderDiscount,
      }
    })
  }, [filteredSales, inventoryItems])

  const totalGrandSales = useMemo(
    () => itemSummary.reduce((sum, item) => sum + item.grandTotalSale, 0),
    [itemSummary],
  )

  const totalNetSales = useMemo(
    () => itemSummary.reduce((sum, item) => sum + item.netSale, 0),
    [itemSummary],
  )

  const totalOrderDiscount = useMemo(
    () => itemSummary.reduce((sum, item) => sum + item.orderDiscount, 0),
    [itemSummary],
  )

  const totalExpenses = useMemo(
    () => filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    [filteredExpenses],
  )

  const salesChartData = useMemo(
    () => itemSummary.map(item => ({ name: item.item, grandTotalSale: item.grandTotalSale, netSale: item.netSale, orderDiscount: item.orderDiscount })),
    [itemSummary],
  )

  const expenseBreakdown = useMemo(() => {
    const grouped = filteredExpenses.reduce<Record<string, number>>((acc, expense) => {
      acc[expense.expense] = (acc[expense.expense] ?? 0) + expense.amount
      return acc
    }, {})

    return Object.entries(grouped)
      .map(([expense, amount]) => ({ name: expense, amount }))
      .sort((a, b) => b.amount - a.amount)
  }, [filteredExpenses])

  const showReport = !dateWindow.error && !!dateWindow.start && !!dateWindow.end
  const [salesSummaryVisible, setSalesSummaryVisible] = useState(true)

  const summaryCards = [
    { label: 'Grand Total Sale', value: formatCurrency(totalGrandSales) },
    { label: 'Net Sale', value: formatCurrency(totalNetSales) },
    { label: 'Order Discount', value: formatCurrency(totalOrderDiscount) },
  ]

  const renderTable = () => {
    if (isMobile) {
      return (
        <div className="space-y-3">
          {itemSummary.map(item => (
            <div key={item.item} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-800 font-display">{item.item}</p>
                <span className="text-xs text-slate-500">{formatCurrency(item.grandTotalSale)}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div className="rounded-lg bg-white p-2">
                  <p className="text-slate-400">Net Sale</p>
                  <p className="mt-1 font-semibold text-slate-700">{formatCurrency(item.netSale)}</p>
                </div>
                <div className="rounded-lg bg-white p-2">
                  <p className="text-slate-400">Discount</p>
                  <p className="mt-1 font-semibold text-slate-700">{formatCurrency(item.orderDiscount)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">Item</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">Grand Total Sale</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">Net Sale</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">Order Discount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {itemSummary.map(item => (
              <tr key={item.item} className="hover:bg-slate-50">
                <td className="py-3 px-4 text-sm font-medium text-slate-700 font-display">{item.item}</td>
                <td className="py-3 px-4 font-mono text-xs text-slate-700">{formatCurrency(item.grandTotalSale)}</td>
                <td className="py-3 px-4 font-mono text-xs text-slate-700">{formatCurrency(item.netSale)}</td>
                <td className="py-3 px-4 font-mono text-xs text-slate-600">{formatCurrency(item.orderDiscount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const renderExpenseTable = () => {
    if (isMobile) {
      return (
        <div className="space-y-3">
          {expenseBreakdown.map(expense => (
            <div key={expense.name} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-800 font-display">{expense.name}</p>
                <span className="text-xs text-slate-500">{formatCurrency(expense.amount)}</span>
              </div>
            </div>
          ))}
        </div>
      )
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">Expense Category</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">Total Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {expenseBreakdown.map(expense => (
              <tr key={expense.name} className="hover:bg-slate-50">
                <td className="py-3 px-4 text-sm font-medium text-slate-700 font-display">{expense.name}</td>
                <td className="py-3 px-4 font-mono text-xs text-slate-700">{formatCurrency(expense.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-display">Summary Report</h2>
          <p className="text-sm text-slate-500 mt-0.5">Sales and expense performance overview</p>
        </div>

        <div className="flex gap-2 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
            <CalendarRange size={14} className="text-slate-400" />
            <select
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value as DatePreset)}
              className="bg-transparent outline-none text-sm font-medium text-slate-700 font-display"
            >
              <option value="today">Today</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="year">Year</option>
              <option value="custom">Custom Date</option>
            </select>
          </label>
        </div>
      </div>

      {dateFilter === 'custom' && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="radio"
                name="customMode"
                checked={customMode === 'range'}
                onChange={() => setCustomMode('range')}
              />
              Date Range
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="radio"
                name="customMode"
                checked={customMode === 'single'}
                onChange={() => setCustomMode('single')}
              />
              Single Date
            </label>
          </div>

          {customMode === 'range' ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="flex flex-col text-sm text-slate-600">
                <span className="mb-1 font-medium">Start Date</span>
                <input
                  type="date"
                  value={rangeStart}
                  onChange={e => setRangeStart(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-indigo-400"
                />
              </label>
              <label className="flex flex-col text-sm text-slate-600">
                <span className="mb-1 font-medium">End Date</span>
                <input
                  type="date"
                  value={rangeEnd}
                  onChange={e => setRangeEnd(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-indigo-400"
                />
              </label>
            </div>
          ) : (
            <div className="mt-4 max-w-sm">
              <label className="flex flex-col text-sm text-slate-600">
                <span className="mb-1 font-medium">Select Date</span>
                <input
                  type="date"
                  value={singleDate}
                  onChange={e => setSingleDate(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-indigo-400"
                />
              </label>
            </div>
          )}
        </div>
      )}

      {!showReport && dateWindow.error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {dateWindow.error}
        </div>
      ) : null}

      {!showReport ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400 shadow-sm">
          Select a valid date filter to view the report.
        </div>
      ) : (
        <div className="space-y-6">
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-800 font-display">Sales Summary</h3>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSalesSummaryVisible(prev => !prev)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  {salesSummaryVisible ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {salesSummaryVisible && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.28, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {summaryCards.map(card => (
                      <div key={card.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 font-display">{card.label}</p>
                        <p className="mt-3 text-2xl font-bold text-slate-800 font-display">{card.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 font-display">Sales by Item</h4>
                    {renderTable()}
                  </div>

                  <div className="mt-6 grid gap-4 xl:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 font-display">Grand Total Sales by Item</p>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={salesChartData} barSize={24}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={52} hide={isMobile} />
                            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={value => `₱${(value / 1000).toFixed(0)}k`} />
                            <Tooltip formatter={(value) => [`${Number(value).toLocaleString()} sales`, 'Sales']} labelFormatter={(label) => `${label}`} />
                            <Bar dataKey="grandTotalSale" name="Sales" fill="#6366f1" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 font-display">Net Sales by Item</p>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={salesChartData} barSize={24}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={52} hide={isMobile} />
                            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={value => `₱${(value / 1000).toFixed(0)}k`} />
                            <Tooltip formatter={(value) => [`${Number(value).toLocaleString()} sales`, 'Sales']} labelFormatter={(label) => `Item: ${label}`} />
                            <Bar dataKey="netSale" fill="#10b981" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 font-display">Order Discount by Item</p>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={salesChartData} barSize={24}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={52} hide={isMobile} />
                            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={value => `₱${(value / 1000).toFixed(0)}k`} />
                            <Tooltip formatter={(value) => formatCurrency(Number(Array.isArray(value) ? value[0] : value))} />
                            <Bar dataKey="orderDiscount" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-lg font-semibold text-slate-800 font-display">Expenses Summary</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 font-display">Expense Total</p>
                <p className="mt-3 text-2xl font-bold text-slate-800 font-display">{formatCurrency(totalExpenses)}</p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              {renderExpenseTable()}
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 font-display">Expense Distribution</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseBreakdown}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {expenseBreakdown.map((entry, index) => (
                        <Cell
                          key={`${entry.name}-${index}`}
                          fill={['#14b8a6', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981'][index % 6]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(Array.isArray(value) ? value[0] : value))} />
                    <Legend formatter={(value) => <span className="text-xs text-slate-600">{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}