'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import useIsMobile from '../hooks/isMobile'
import { useRealtimeEntity } from '../hooks/useRealtimeEntity'
import { AnimatePresence, motion } from 'motion/react'
import PaginationFooter from '../components/PaginationFooter'
import DateFilter, { dateInRange, defaultDateFilterValue, resolveDateRange, type DateFilterValue } from '../components/DateFilter'
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
  }).format(Number.isFinite(value) ? value : 0)

// Label/value pair for the stacked mobile cards. Mirrors the detail modals (small slate-400
// label above a medium-weight value) so the mobile cards show the same columns as the desktop
// tables instead of only the name and one amount.
function CardField({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-sm font-medium text-slate-700 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}

const CustomBarTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; dataKey: string; payload: any }>; label?: string }) => {
  if (!active || !payload || payload.length === 0) return null

  const item = payload[0]
  const data = item.payload
  const count = data.totalCount ?? data.count ?? item.value
  const totalSale = data.totalSale ?? data.totalPrice ?? 0

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-800">{label}</p>
      <div className="mt-1 flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500" />
          <span className="text-slate-600">Sales count: <span className="font-medium text-slate-800">{Number(count).toLocaleString()}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-slate-600">Total sales: <span className="font-medium text-slate-800">{formatCurrency(totalSale)}</span></span>
        </div>
      </div>
    </div>
  )
}

const ServiceBarTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; dataKey: string; payload: any }>; label?: string }) => {
  if (!active || !payload || payload.length === 0) return null

  const item = payload[0]
  const data = item.payload
  const count = data.count ?? item.value
  const totalPrice = data.totalPrice ?? 0

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-800">{label}</p>
      <div className="mt-1 flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-slate-600">Transactions: <span className="font-medium text-slate-800">{Number(count).toLocaleString()}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-slate-600">Total sales: <span className="font-medium text-slate-800">{formatCurrency(totalPrice)}</span></span>
        </div>
      </div>
    </div>
  )
}

type RestaurantFilterValue = 'All Restaurants' | 'Lakay Ago' | 'Aroo'

const RESTAURANT_OPTIONS: RestaurantFilterValue[] = ['All Restaurants', 'Lakay Ago', 'Aroo']

const matchesRestaurantScope = (restaurantValue: string | null | undefined, filter: RestaurantFilterValue) => {
  if (filter === 'All Restaurants') return true

  const normalized = String(restaurantValue ?? 'Both')
  return normalized === filter || normalized === 'Both'
}

const buildSummaryByName = (
  rows: any[],
  getName: (row: any) => string,
  getDiscount: (row: any) => number,
) => {
  const entries = new Map<string, { name: string; totalSale: number; totalCount: number; totalDiscount: number }>()

  for (const row of rows) {
    const name = getName(row)
    const quantity = Number(row.number_of_sales ?? row.numberOfSales ?? 1)
    const unitPrice = Number(row.cost ?? row.totalSale ?? 0)
    const totalSale = unitPrice * quantity

    const current = entries.get(name) ?? { name, totalSale: 0, totalCount: 0, totalDiscount: 0 }

    current.totalSale += totalSale
    current.totalCount += quantity
    current.totalDiscount += Number(getDiscount(row) || 0)
    entries.set(name, current)
  }

  return Array.from(entries.values()).map((entry) => ({
    name: entry.name,
    totalSale: entry.totalSale,
    totalCount: entry.totalCount,
    totalDiscount: entry.totalDiscount,
  }))
}

interface SkeletonBarProps {
  width?: string | number
  height?: string | number
  rounded?: string
  className?: string
}

function SkeletonBar({ width = '100%', height = '1rem', rounded = 'rounded-md', className = '' }: SkeletonBarProps) {
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

// Mirrors the summary/expense value cards: uppercase font-display label on top, big value line below.
function SummaryCardSkeleton({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 font-display">{label}</p>
      <div className="mt-3">
        <SkeletonBar width="55%" height="1.75rem" rounded="rounded-lg" />
      </div>
    </div>
  )
}

// Mirrors the report tables: styled header row (border-b, bg-slate-50) + rows of placeholder cells.
// On mobile the report renders stacked cards instead of a table, so `mobile` swaps to card-shaped
// rows built from divs — a <tr> rendered outside a <table> is invalid HTML and breaks hydration.
function TableSkeleton({ rows = 6, columns = 3, mobile = false }: { rows?: number; columns?: number; mobile?: boolean }) {
  if (mobile) {
    return (
      <div className="flex flex-col">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`skeleton-card-${rowIndex}`} className="flex items-center justify-between gap-3 border-b border-slate-50 p-3 last:border-b-0">
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonBar width="70%" height="0.875rem" />
              <SkeletonBar width="45%" height="0.75rem" />
            </div>
            <SkeletonBar width="28%" height="0.875rem" />
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
            {Array.from({ length: columns }).map((_, index) => (
              <th key={`skeleton-head-${index}`} className="py-3 px-4 text-left">
                <SkeletonBar width="65%" height="0.75rem" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={`skeleton-row-${rowIndex}`}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={`skeleton-cell-${rowIndex}-${colIndex}`} className="py-3 px-4">
                  <SkeletonBar width={colIndex === 0 ? '80%' : '55%'} height="0.875rem" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Mirrors the bar-chart cards: label line on top, placeholder bars in a fixed-height plot area.
function ChartSkeleton({ height = 'h-64' }: { height?: string }) {
  const barHeights = [42, 68, 55, 80, 60, 75, 45, 72, 58]
  return (
    <div className={`${height} flex items-end gap-2 px-1 pb-1`}>
      {barHeights.map((pct, index) => (
        <div key={`skeleton-chart-bar-${index}`} className="flex-1 flex items-end h-full">
          <SkeletonBar width="100%" height={`${pct}%`} rounded="rounded-t-md" />
        </div>
      ))}
    </div>
  )
}

// Mirrors the pie chart card: donut placeholder centered in the plot area with legend lines below.
function PieChartSkeleton() {
  return (
    <div className="h-72 flex flex-col items-center justify-center gap-5">
      <SkeletonBar width="10rem" height="10rem" rounded="rounded-full" />
      <div className="w-full max-w-xs space-y-2">
        <SkeletonBar width="60%" height="0.75rem" />
        <SkeletonBar width="45%" height="0.75rem" />
      </div>
    </div>
  )
}

export default function SalesSummary() {
  const isMobile = useIsMobile()
  const [inventoryItems, setInventoryItems] = useState<any[]>([])
  const [bundlePackages, setBundlePackages] = useState<any[]>([])
  const [salesRecords, setSalesRecords] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [serviceTransactions, setServiceTransactions] = useState<any[]>([])
  // Keep the report's original default of showing the current month; swap the spread
  // for a plain `defaultDateFilterValue` to match the other pages ("All Sales").
  const [dateFilter, setDateFilter] = useState<DateFilterValue>(() => ({ ...defaultDateFilterValue(), mode: 'month' }))
  const [restaurantFilter, setRestaurantFilter] = useState<RestaurantFilterValue>('All Restaurants')
  const [realtimeRefreshTick, setRealtimeRefreshTick] = useState(0)
  const [loading, setLoading] = useState(true)

  useRealtimeEntity('sales', {
    onChange: () => setRealtimeRefreshTick((value) => value + 1),
  })

  useRealtimeEntity('service_transactions', {
    onChange: () => setRealtimeRefreshTick((value) => value + 1),
  })

  // Asset return saves write only the service_transaction_assets table, and Net Sales
  // below subtracts each transaction's asset penalty. Without this subscription those
  // totals stayed stale for every user except the one who saved the asset returns.
  useRealtimeEntity('service_transaction_assets', {
    onChange: () => setRealtimeRefreshTick((value) => value + 1),
  })

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        const [menuRes, packagesRes, salesRes, expensesRes, serviceTxRes] = await Promise.all([
          fetch('/api/food_and_beverage'),
          fetch('/api/food_packages'),
          fetch('/api/sales'),
          fetch('/api/expenses'),
          fetch('/api/service_transactions'),
        ])

        if (!mounted) return

        if (menuRes.ok) {
          const next = await menuRes.json()
          setInventoryItems((next.items || []).map((row: any) => ({
            item: row.name || row.item,
            id: String(row.food_and_beverage_id || row.id),
            restaurant: row.restaurant || 'Both',
            price: Number(row.price || row.cost || 0),
          })))
        }

        if (packagesRes.ok) {
          const next = await packagesRes.json()
          setBundlePackages(next.packages || [])
        }

        if (salesRes.ok) {
          const next = await salesRes.json()
          setSalesRecords((next.sales || []).map((sale: any) => ({
            item: sale.item,
            cost: Number(sale.cost || 0),
            numberOfSales: Number(sale.number_of_sales || sale.numberOfSales || 0),
            discount: Number(sale.discount || 0),
            createdAt: sale.created_at || sale.createdAt,
            restaurant: sale.restaurant || 'Both',
            food_and_beverage_id: sale.food_and_beverage_id ?? sale.foodAndBeverageId,
          })))
        }

        if (expensesRes.ok) {
          const next = await expensesRes.json()
          setExpenses((next.expenses || []).map((expense: any) => ({
            expense: expense.expense || expense.name,
            amount: Number(expense.amount || 0),
            createdAt: expense.created_at || expense.createdAt,
            restaurant: expense.restaurant || 'Both',
          })))
        }

        if (serviceTxRes.ok) {
          const next = await serviceTxRes.json()
          setServiceTransactions((next.transactions || []).map((tx: any) => ({
            service_transaction_id: tx.service_transaction_id || tx.id,
            service_id: tx.service_id,
            serviceType: tx.service_type || 'Service',
            service_date: tx.service_date || tx.serviceDate || tx.created_at || tx.createdAt,
            restaurant: tx.restaurant || 'Both',
            status: tx.status || 'Under Reservation',
            discount: Number(tx.discount || 0),
            expenses: Number(tx.expenses || 0),
            penalty: Number(tx.penalty || 0),
            asset_penalty: Number(tx.asset_penalty || tx.assetPenalty || 0),
            downpayment: Number(tx.downpayment || 0),
            balance: Number(tx.balance || 0),
          })))
        }
      } catch (error) {
        console.error('Failed to load summary data', error)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [realtimeRefreshTick])

  const dateRange = useMemo(() => resolveDateRange(dateFilter), [dateFilter])

  const filteredSales = useMemo(
    () =>
      salesRecords.filter(
        (sale) => matchesRestaurantScope(sale.restaurant, restaurantFilter) && dateInRange(sale.createdAt, dateRange),
      ),
    [dateRange, restaurantFilter, salesRecords],
  )

  const filteredExpenses = useMemo(
    () =>
      expenses.filter(
        (expense) => matchesRestaurantScope(expense.restaurant, restaurantFilter) && dateInRange(expense.createdAt, dateRange),
      ),
    [dateRange, expenses, restaurantFilter],
  )

  const filteredServiceTransactions = useMemo(
    () =>
      serviceTransactions.filter(
        (transaction) =>
          matchesRestaurantScope(transaction.restaurant, restaurantFilter) &&
          dateInRange(transaction.service_date, dateRange),
      ),
    [dateRange, restaurantFilter, serviceTransactions],
  )

  const bundleIds = useMemo(() => {
    const ids = new Set<number>()
    for (const bundle of bundlePackages) {
      const id = Number(bundle.food_package_id ?? bundle.id)
      if (Number.isFinite(id) && id > 0) ids.add(id)
    }
    return ids
  }, [bundlePackages])

  const itemSalesRows = useMemo(
    () => filteredSales.filter((sale) => !bundleIds.has(Number(sale.food_and_beverage_id ?? 0))),
    [bundleIds, filteredSales],
  )

  const bundleSalesRows = useMemo(
    () => filteredSales.filter((sale) => bundleIds.has(Number(sale.food_and_beverage_id ?? 0))),
    [bundleIds, filteredSales],
  )

  const itemSummary = useMemo(
    () => buildSummaryByName(itemSalesRows, (row) => String(row.item || 'Unknown'), (row) => Number(row.discount || 0)),
    [itemSalesRows],
  )

  const bundleSummary = useMemo(
    () => buildSummaryByName(bundleSalesRows, (row) => String(row.item || 'Unknown'), (row) => Number(row.discount || 0)),
    [bundleSalesRows],
  )

  const totalItemSales = useMemo(
    () => itemSummary.reduce((sum, item) => sum + item.totalSale, 0),
    [itemSummary],
  )

  const totalItemDiscount = useMemo(
    () => itemSummary.reduce((sum, item) => sum + item.totalDiscount, 0),
    [itemSummary],
  )

  const totalBundleSales = useMemo(
    () => bundleSummary.reduce((sum, bundle) => sum + bundle.totalSale, 0),
    [bundleSummary],
  )

  const totalBundleDiscount = useMemo(
    () => bundleSummary.reduce((sum, bundle) => sum + bundle.totalDiscount, 0),
    [bundleSummary],
  )

  const ingredientExpenses = useMemo(
    () => filteredExpenses
      .filter((expense) => String(expense.expense).toLowerCase().includes('ingredient'))
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    [filteredExpenses],
  )

  const itemSalesNet = totalItemSales - totalItemDiscount
  const bundleSalesNet = totalBundleSales - totalBundleDiscount
  const itemBundleNet = itemSalesNet + bundleSalesNet - ingredientExpenses

  const fullyPaidTransactions = useMemo(
    () => filteredServiceTransactions.filter((tx) => tx.status === 'Fully Paid'),
    [filteredServiceTransactions],
  )

  const serviceSales = useMemo(
    () => fullyPaidTransactions.reduce((sum, tx) => sum + Number(tx.downpayment || 0) + Number(tx.balance || 0), 0),
    [fullyPaidTransactions],
  )

  const serviceDiscount = useMemo(
    () => fullyPaidTransactions.reduce((sum, tx) => sum + Number(tx.discount || 0), 0),
    [fullyPaidTransactions],
  )

  const serviceExpenses = useMemo(
    () => fullyPaidTransactions.reduce((sum, tx) => sum + Number(tx.expenses || 0), 0),
    [fullyPaidTransactions],
  )

  const servicePenalty = useMemo(
    () => fullyPaidTransactions.reduce((sum, tx) => sum + Number(tx.penalty || 0), 0),
    [fullyPaidTransactions],
  )

  const assetPenalty = useMemo(
    () => fullyPaidTransactions.reduce((sum, tx) => sum + Number(tx.asset_penalty || 0), 0),
    [fullyPaidTransactions],
  )

  const serviceNet = serviceSales - (serviceDiscount + serviceExpenses + servicePenalty + assetPenalty)
  const totalNetSales = itemBundleNet + serviceNet
  const grossSales = totalItemSales + totalBundleSales + serviceSales
  const totalOrderDiscount = totalItemDiscount + totalBundleDiscount + serviceDiscount

  const expenseBreakdown = useMemo(() => {
    const grouped = new Map<string, { name: string; restaurant: string; amount: number }>()

    for (const expense of filteredExpenses) {
      const name = String(expense.expense || 'Expense')
      const restaurant = String(expense.restaurant || 'Both')
      const groupKey = `${name}|${restaurant}`
      const current = grouped.get(groupKey) ?? { name, restaurant, amount: 0 }
      current.amount += Number(expense.amount || 0)
      grouped.set(groupKey, current)
    }

    for (const tx of fullyPaidTransactions) {
      const name = 'Service Transaction Expenses'
      const restaurant = String(tx.restaurant || 'Both')
      const groupKey = `${name}|${restaurant}`
      const current = grouped.get(groupKey) ?? { name, restaurant, amount: 0 }
      current.amount += Number(tx.expenses || 0)
      grouped.set(groupKey, current)
    }

    return Array.from(grouped.values())
      .filter((entry) => entry.amount > 0)
      .sort((a, b) => b.amount - a.amount)
  }, [filteredExpenses, fullyPaidTransactions])

  const totalExpenses = useMemo(
    () => expenseBreakdown.reduce((sum, item) => sum + item.amount, 0),
    [expenseBreakdown],
  )

  const [salesSummaryVisible, setSalesSummaryVisible] = useState(true)
  const PAGE_SIZE = 10
  const [salesPage, setSalesPage] = useState(1)
  const [bundlePage, setBundlePage] = useState(1)
  const [servicePage, setServicePage] = useState(1)

  // Desktop-only table padding. Every page is topped up to PAGE_SIZE rows with invisible rows so
  // the table height — and the pagination controls underneath it — never jump between pages.
  // Mobile renders the stacked cards instead and gets no filler rows. An empty page is padded as
  // well: the "No … found." message row takes the place of the first data row.
  const desktopFillerCount = (rowCount: number) =>
    Math.max(0, PAGE_SIZE - (rowCount === 0 ? 1 : rowCount))

  useEffect(() => setSalesPage(1), [itemSummary])
  useEffect(() => setBundlePage(1), [bundleSummary])
  useEffect(() => setServicePage(1), [fullyPaidTransactions])

  const itemPageData = useMemo(() => {
    const start = (salesPage - 1) * PAGE_SIZE
    return itemSummary.slice(start, start + PAGE_SIZE)
  }, [itemSummary, salesPage])

  const bundlePageData = useMemo(() => {
    const start = (bundlePage - 1) * PAGE_SIZE
    return bundleSummary.slice(start, start + PAGE_SIZE)
  }, [bundleSummary, bundlePage])

  const servicePageData = useMemo(() => {
    const start = (servicePage - 1) * PAGE_SIZE
    return fullyPaidTransactions.slice(start, start + PAGE_SIZE)
  }, [fullyPaidTransactions, servicePage])

  const serviceSummary = useMemo(() => {
    const grouped = new Map<string, { name: string; count: number; totalPrice: number }>()

    for (const tx of fullyPaidTransactions) {
      const name = String(tx.serviceType || 'Service')
      const current = grouped.get(name) ?? { name, count: 0, totalPrice: 0 }
      current.count += 1
      current.totalPrice += Number(tx.downpayment || 0) + Number(tx.balance || 0)
      grouped.set(name, current)
    }

    return Array.from(grouped.values())
  }, [fullyPaidTransactions])

  const summaryCards = [
    { label: 'Gross Sale', value: formatCurrency(grossSales) },
    { label: 'Net Sale', value: formatCurrency(totalNetSales) },
    { label: 'Order Discount', value: formatCurrency(totalOrderDiscount) },
  ]

  const expenseCards = [
    { label: 'Expense Total', value: formatCurrency(totalExpenses) },
    { label: 'Daily Expenses', value: formatCurrency(totalExpenses - serviceExpenses) },
    { label: 'Service Transaction Expenses', value: formatCurrency(serviceExpenses) },
  ]

  const renderItemTable = () => {
    // Mobile uses the stacked card list used by the other report pages instead of a table.
    if (isMobile) {
      return (
        <div className="flex flex-col">
          {itemPageData.length === 0 ? (
            <div className="p-4 text-sm text-slate-400">No item sales found.</div>
          ) : (
            itemPageData.map((item) => (
              <div key={item.name} className="border-b border-slate-200 p-3 last:border-b-0">
                <p className="truncate text-sm font-semibold text-slate-700 font-display">{item.name}</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <CardField label="Total Sale" value={formatCurrency(item.totalSale)} mono />
                  <CardField label="Order Discount" value={formatCurrency(item.totalDiscount)} mono />
                </div>
              </div>
            ))
          )}
        </div>
      )
    }

    // Desktop only filler rows — see desktopFillerCount().
    const itemEmptyCount = desktopFillerCount(itemPageData.length)

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">Item</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">Total Sale</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">Order Discount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {itemPageData.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-400">No item sales found.</td>
              </tr>
            )}
            {itemPageData.map((item) => (
              <tr key={item.name} className="hover:bg-slate-50">
                <td className="py-3 px-4 text-sm font-medium text-slate-700 font-display">{item.name}</td>
                <td className="py-3 px-4 font-mono text-xs text-slate-700">{formatCurrency(item.totalSale)}</td>
                <td className="py-3 px-4 font-mono text-xs text-slate-600">{formatCurrency(item.totalDiscount)}</td>
              </tr>
            ))}
            {itemEmptyCount > 0 && Array.from({ length: itemEmptyCount }).map((_, index) => (
              <tr key={`item-filler-${index}`} className="invisible">
                <td className="py-3 px-4 text-sm font-medium text-slate-700 font-display">Placeholder</td>
                <td className="py-3 px-4 font-mono text-xs text-slate-700">{formatCurrency(0)}</td>
                <td className="py-3 px-4 font-mono text-xs text-slate-600">{formatCurrency(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const renderBundleTable = () => {
    if (isMobile) {
      return (
        <div className="flex flex-col">
          {bundlePageData.length === 0 ? (
            <div className="p-4 text-sm text-slate-400">No bundle sales found.</div>
          ) : (
            bundlePageData.map((bundle) => (
              <div key={bundle.name} className="border-b border-slate-200 p-3 last:border-b-0">
                <p className="truncate text-sm font-semibold text-slate-700 font-display">{bundle.name}</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <CardField label="Total Sale" value={formatCurrency(bundle.totalSale)} mono />
                  <CardField label="Order Discount" value={formatCurrency(bundle.totalDiscount)} mono />
                </div>
              </div>
            ))
          )}
        </div>
      )
    }

    // Desktop only filler rows — see desktopFillerCount().
    const bundleEmptyCount = desktopFillerCount(bundlePageData.length)

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">Food Bundle</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">Total Sale</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">Order Discount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {bundlePageData.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-400">No bundle sales found.</td>
              </tr>
            )}
            {bundlePageData.map((bundle) => (
              <tr key={bundle.name} className="hover:bg-slate-50">
                <td className="py-3 px-4 text-sm font-medium text-slate-700 font-display">{bundle.name}</td>
                <td className="py-3 px-4 font-mono text-xs text-slate-700">{formatCurrency(bundle.totalSale)}</td>
                <td className="py-3 px-4 font-mono text-xs text-slate-600">{formatCurrency(bundle.totalDiscount)}</td>
              </tr>
            ))}
            {bundleEmptyCount > 0 && Array.from({ length: bundleEmptyCount }).map((_, index) => (
              <tr key={`bundle-filler-${index}`} className="invisible">
                <td className="py-3 px-4 text-sm font-medium text-slate-700 font-display">Placeholder</td>
                <td className="py-3 px-4 font-mono text-xs text-slate-700">{formatCurrency(0)}</td>
                <td className="py-3 px-4 font-mono text-xs text-slate-600">{formatCurrency(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const renderServiceTable = () => {
    // Mobile uses the stacked card list used by the other report pages instead of a table.
    if (isMobile) {
      return (
        <div className="flex flex-col">
          {servicePageData.length === 0 ? (
            <div className="p-4 text-sm text-slate-400">No service sales found.</div>
          ) : (
            servicePageData.map((transaction) => {
              const downpaymentPlusBalance = Number(transaction.downpayment || 0) + Number(transaction.balance || 0)

              return (
                <div key={transaction.service_transaction_id} className="border-b border-slate-200 p-3 last:border-b-0">
                  <p className="truncate text-sm font-semibold text-slate-700 font-display">{transaction.serviceType || 'Service'}</p>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <CardField label="Total Sale" value={formatCurrency(downpaymentPlusBalance)} mono />
                    <CardField label="Order Discount" value={formatCurrency(Number(transaction.discount || 0))} mono />
                  </div>
                </div>
              )
            })
          )}
        </div>
      )
    }

    // Desktop only filler rows — see desktopFillerCount().
    const serviceEmptyCount = desktopFillerCount(servicePageData.length)

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">Service</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">Date</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">Total Sale</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">Discount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {servicePageData.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">No service sales found.</td>
              </tr>
            )}
            {servicePageData.map((transaction) => {
              const downpaymentPlusBalance = Number(transaction.downpayment || 0) + Number(transaction.balance || 0)

              return (
                <tr key={transaction.service_transaction_id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 text-sm font-medium text-slate-700 font-display">{transaction.serviceType || 'Service'}</td>
                  <td className="py-3 px-4 text-sm text-slate-700">
                    {transaction.service_date ? new Date(transaction.service_date).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-700">{formatCurrency(downpaymentPlusBalance)}</td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-600">{formatCurrency(Number(transaction.discount || 0))}</td>
                </tr>
              )
            })}
            {serviceEmptyCount > 0 && Array.from({ length: serviceEmptyCount }).map((_, index) => (
              <tr key={`service-filler-${index}`} className="invisible">
                <td className="py-3 px-4 text-sm font-medium text-slate-700 font-display">Placeholder</td>
                <td className="py-3 px-4 text-sm text-slate-700">—</td>
                <td className="py-3 px-4 font-mono text-xs text-slate-700">{formatCurrency(0)}</td>
                <td className="py-3 px-4 font-mono text-xs text-slate-600">{formatCurrency(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const renderExpenseTable = () => {
    // Mobile uses the stacked card list used by the other report pages instead of a table.
    if (isMobile) {
      return (
        <div className="flex flex-col">
          {expenseBreakdown.length === 0 ? (
            <div className="p-4 text-sm text-slate-400">No expenses found.</div>
          ) : (
            expenseBreakdown.map((expense) => (
              <div key={`${expense.name}-${expense.restaurant}`} className="border-b border-slate-200 p-3 last:border-b-0">
                <p className="truncate text-sm font-semibold text-slate-700 font-display">{expense.name}</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <CardField label="Restaurant" value={expense.restaurant} />
                  <CardField label="Total Amount" value={formatCurrency(expense.amount)} mono />
                </div>
              </div>
            ))
          )}
        </div>
      )
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">Expense Category</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">Restaurant</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide font-display">Total Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {expenseBreakdown.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-400">No expenses found.</td>
              </tr>
            )}
            {expenseBreakdown.map((expense) => (
              <tr key={`${expense.name}-${expense.restaurant}`} className="hover:bg-slate-50">
                <td className="py-3 px-4 text-sm font-medium text-slate-700 font-display">{expense.name}</td>
                <td className="py-3 px-4 text-sm text-slate-600">{expense.restaurant}</td>
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

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
              value={restaurantFilter}
              onChange={(event) => setRestaurantFilter(event.target.value as RestaurantFilterValue)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none font-display text-slate-600"
            >
              {RESTAURANT_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          <div>
          <div>
            <DateFilter value={dateFilter} onChange={setDateFilter} allLabel="All Sales" className="justify-end"/>
          </div>
            
          </div>
        </div>
      </div>

        <div className="space-y-6">
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-800 font-display">Sales Summary</h3>
              <button
                type="button"
                onClick={() => setSalesSummaryVisible((previous) => !previous)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                {salesSummaryVisible ? 'Hide' : 'Show'}
              </button>
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
                    {loading
                      ? summaryCards.map((card) => <SummaryCardSkeleton key={card.label} label={card.label} />)
                      : summaryCards.map((card) => (
                          <div key={card.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 font-display">{card.label}</p>
                            <p className={`mt-3 text-2xl ${card.label === 'Gross Sale' ? 'text-green-700' : card.label === 'Net Sale' ? 'text-green-600' : 'text-red-600'} font-bold font-display`}>{card.value}</p>
                          </div>
                        ))}
                  </div>

                  <div className="mt-6 grid gap-4 xl:grid-cols-3">
                    {loading ? (
                      [
                        { label: 'Menu Item Sales', columns: 3 },
                        { label: 'Food Bundles Sales', columns: 3 },
                        { label: 'Service Sales', columns: 4 },
                      ].map((table) => (
                        <div key={table.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 font-display">{table.label}</h4>
                          <TableSkeleton rows={6} columns={table.columns} mobile={isMobile} />
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 font-display">Menu Item Sales</h4>
                          {renderItemTable()}
                          <div className="mt-4">
                            <PaginationFooter items={itemSummary} page={salesPage} setPage={setSalesPage} pageSize={PAGE_SIZE} />
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 font-display">Food Bundles Sales</h4>
                          {renderBundleTable()}
                          <div className="mt-4">
                            <PaginationFooter items={bundleSummary} page={bundlePage} setPage={setBundlePage} pageSize={PAGE_SIZE} />
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 font-display">Service Sales</h4>
                          {renderServiceTable()}
                          <div className="mt-4">
                            <PaginationFooter items={fullyPaidTransactions} page={servicePage} setPage={setServicePage} pageSize={PAGE_SIZE} />
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                 

                  <div className="mt-6 grid gap-4 xl:grid-cols-3">
                    {loading ? (
                      ['Sales Count by Item', 'Sales Count by Bundle', 'Service Totals by Type'].map((label) => (
                        <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 font-display">{label}</p>
                          <div className="h-64">
                            <ChartSkeleton />
                          </div>
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 font-display">Sales Count by Item</p>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={itemSummary} barSize={24}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={52} hide={isMobile} />
                                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <Tooltip content={<CustomBarTooltip />} />
                                <Bar dataKey="totalCount" name="Sales count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 font-display">Sales Count by Bundle</p>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={bundleSummary} barSize={24}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={52} hide={isMobile} />
                                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <Tooltip content={<CustomBarTooltip />} />
                                <Bar dataKey="totalCount" name="Bundle count" fill="#10b981" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 font-display">Service Totals by Type</p>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={serviceSummary} barSize={24}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={52} hide={isMobile} />
                                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <Tooltip content={<ServiceBarTooltip />} />
                                <Bar dataKey="count" name="Transactions" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-lg font-semibold text-slate-800 font-display">Expenses Summary</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {loading
                ? expenseCards.map((card) => <SummaryCardSkeleton key={card.label} label={card.label} />)
                : expenseCards.map((card) => (
                    <div key={card.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 font-display">{card.label}</p>
                      <p className={`mt-3 text-2xl ${card.label === 'Expense Total' ? 'text-red-800' : card.label === 'Daily Expenses' ? 'text-red-700' : 'text-red-600'} font-bold font-display`}>{card.value}</p>
                    </div>
                  ))}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {loading ? (
                <>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <TableSkeleton rows={6} columns={3} mobile={isMobile} />
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 font-display">Expense Distribution</p>
                    <PieChartSkeleton />
                  </div>
                </>
              ) : (
                <>
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      {renderExpenseTable()}
    </div>
    <div className="rounded-xl border border-slate-200 bg-white p-3">
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
            <Tooltip formatter={(value) => formatCurrency(Number(Array.isArray(value) ? value[0] : value ?? 0))} />
            <Legend formatter={(value) => <span className="text-xs text-slate-600">{value}</span>} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
                </>
              )}
  </div>
          </section>
        </div>
    </div>
  )
}
