'use client'
import { Fragment, useEffect, useMemo, useState, useLayoutEffect, useRef, useCallback } from 'react'
import { Search, Plus, Pencil, Eye, Archive, Trash2, Package, Wallet, ChevronDown } from 'lucide-react'
import Modal from '../components/Modal'
import useIsMobile from '../hooks/isMobile'
import { useApp } from '../App'
import { useRealtimeEntity, type RealtimePayload } from '../hooks/useRealtimeEntity'
import PaginationFooter from '../components/PaginationFooter'
import DateFilter, { dateInRange, defaultDateFilterValue, resolveDateRange, type DateFilterValue } from '../components/DateFilter'

interface ServiceForm { service_type: string; price: string; restaurant: string }
const emptyForm: ServiceForm = { service_type: 'Catering', price: '0.00', restaurant: 'Lakay Ago' }
const SERVICE_TYPE_OPTIONS = ['Catering', 'Photoshoot', 'Accommodation', 'Entrance Fee']

interface SubServiceForm {
  name: string
  price: string
  restaurant: string
  food_package_id?: string
}
const emptySubServiceForm: SubServiceForm = {
  name: '',
  price: '0.00',
  restaurant: 'Lakay Ago',
  food_package_id: undefined,
}

interface TxForm {
  restaurant: string
  service_id: number | undefined
  service_date: string
  price: string
  downpayment: string
  discount: string
  penalty: string
  expenses: string
  status: string | null
}

const emptyTxForm: TxForm = { restaurant: '', service_id: undefined, service_date: '', price: '0', downpayment: '0', discount: '0', penalty: '0', expenses: '0', status: 'Under Reservation' }

const statusColor: Record<string, string> = {
  'Under Reservation': 'bg-amber-200 text-amber-700',
  'Partial Payment': 'bg-blue-200 text-blue-700',
  'Finalized': 'bg-emerald-200 text-emerald-700',
  'Fully Paid': 'bg-teal-200 text-teal-700',
}

const PACKAGE_FETCH_LIMIT = 200

const getErrors = (f: ServiceForm) => {
  const e: Partial<Record<keyof ServiceForm, string>> = {}
  if (!f.service_type) e.service_type = 'Type is required.'
  if (f.price === '' || Number.isNaN(Number(f.price)) || Number(f.price) < 0) e.price = 'Price must be a non-negative number.'
  if (!f.restaurant) e.restaurant = 'Restaurant is required.'
  return e
}

const sanitizeMoneyInput = (value: string) => {
  if (value === '') return ''

  const raw = value.replace(/[^\d.]/g, '')
  if (!raw) return ''

  const [whole, ...rest] = raw.split('.')
  const decimal = rest.join('')

  if (!whole && !decimal) return ''
  if (rest.length === 0) return whole
  return `${whole || '0'}.${decimal.replace(/\./g, '')}`
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
  as?: 'tr' | 'div'
}

function SkeletonTableRows({ columns, rows = 6, columnConfig, as = 'tr' }: SkeletonTableRowsProps) {
  if (as === 'div') {
    return (
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, rowIdx) => (
          <div key={rowIdx} className="border-b border-slate-200 bg-slate-50 p-3 animate-pulse">
            <div className="space-y-2">
              {Array.from({ length: columns }, (_, colIdx) => {
                const config = columnConfig?.[colIdx]
                return (
                  <div key={colIdx} className="w-full">
                    <SkeletonBar
                      width={config?.width ?? "80%"}
                      height={config?.pill ? "1.1rem" : "0.85rem"}
                      rounded={config?.pill ? "" : "rounded-md"}
                    />
                  </div>
                )
              })}
            </div>
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
                  rounded={config?.pill ? "" : "rounded-md"}
                />
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}

const tabs = [
  { key: 'services', label: 'Services' },
  { key: 'transactions', label: 'Transactions' },
] as const

export default function Services() {
  const isMobile = useIsMobile()
  const { showToast } = useApp()
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [serviceTypeDropdownOpen, setServiceTypeDropdownOpen] = useState(false)
  const [form, setForm] = useState<ServiceForm>(emptyForm)
  const [errors, setErrors] = useState<Partial<Record<keyof ServiceForm, string>>>({})
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [packages, setPackages] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'services' | 'transactions'>('services')
  const [assetsOptions, setAssetsOptions] = useState<any[]>([])
  const [serviceAssetRows, setServiceAssetRows] = useState<any[]>([])
  const [assetSelect, setAssetSelect] = useState('')
  const [assetQty, setAssetQty] = useState('1')
  const [serviceEntryMode, setServiceEntryMode] = useState<'service' | 'sub_service'>('service')
  const [allSubServices, setAllSubServices] = useState<any[]>([])
  const [subServiceAttachSelect, setSubServiceAttachSelect] = useState<number | null>(null)
  const [attachedSubServices, setAttachedSubServices] = useState<any[]>([])
  const initialAttachedSubServiceIdsRef = useRef<Set<number>>(new Set())
  const assetModalResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const expenseModalResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [expandedServiceIds, setExpandedServiceIds] = useState<number[]>([])
  const [subServicesByService, setSubServicesByService] = useState<Record<number, any[]>>({})
  const [subServicesLoading, setSubServicesLoading] = useState<Record<number, boolean>>({})
  const [subServicesTableLoading, setSubServicesTableLoading] = useState(true)
  const [showSubServiceModal, setShowSubServiceModal] = useState(false)
  const [showEditSubServiceModal, setShowEditSubServiceModal] = useState(false)
  const [subServiceForm, setSubServiceForm] = useState<SubServiceForm>(emptySubServiceForm)
  const [editingSubServiceId, setEditingSubServiceId] = useState<number | null>(null)
  const [subServiceTargetServiceId, setSubServiceTargetServiceId] = useState<number | null>(null)
  const [availableSubServices, setAvailableSubServices] = useState<any[]>([])
  const [selectedAttachSubServiceId, setSelectedAttachSubServiceId] = useState<number | null>(null)
  const [subServiceSearch, setSubServiceSearch] = useState('')

  // transactions
  const [transactions, setTransactions] = useState<any[]>([])
  const [txLoading, setTxLoading] = useState(false)
  const [showTxModal, setShowTxModal] = useState(false)
  const [txForm, setTxForm] = useState<TxForm>(emptyTxForm)
  const [editingTxId, setEditingTxId] = useState<number | null>(null)
  const [expenseModalTxId, setExpenseModalTxId] = useState<number | null>(null)
  // Live total of each transaction's expense lines (from the Transaction Expenses modal),
  // keyed by service_transaction_id. Used for the table, view modal, and edit modal so the
  // Expenses field always shows the lines total regardless of transaction status.
  const [txExpenseTotals, setTxExpenseTotals] = useState<Record<number, number>>({})
  const [expenseRows, setExpenseRows] = useState<any[]>([])
  const [expenseNameInput, setExpenseNameInput] = useState('')
  const [expenseAmountInput, setExpenseAmountInput] = useState('')
  const [showAssetsModal, setShowAssetsModal] = useState(false)
  const [assetLines, setAssetLines] = useState<any[]>([])
  const [assetTotalPenalty, setAssetTotalPenalty] = useState(0)
  const [currentTxId, setCurrentTxId] = useState<number | null>(null)
  const [currentTxStatus, setCurrentTxStatus] = useState<string>('')
  const [assetModalLoading, setAssetModalLoading] = useState(false)
  const [expenseModalLoading, setExpenseModalLoading] = useState(false)
  const [addPaymentAmount, setAddPaymentAmount] = useState('')
  const [txBalance, setTxBalance] = useState(0)
  const [originalTxStatus, setOriginalTxStatus] = useState<string>('')
  const [servicesPage, setServicesPage] = useState(1)
  const [subServicesPage, setSubServicesPage] = useState(1)
  const [transactionsPage, setTransactionsPage] = useState(1)
  const [txDateFilter, setTxDateFilter] = useState<DateFilterValue>(defaultDateFilterValue)
  const [serviceRestaurantFilter, setServiceRestaurantFilter] = useState('All Restaurants')
  // Archive visibility filters for the Services and Sub Services tables.
  const [serviceArchiveFilter, setServiceArchiveFilter] = useState('Not Archived')
  const [subServiceArchiveFilter, setSubServiceArchiveFilter] = useState('Not Archived')
  const [subServiceRestaurantFilter, setSubServiceRestaurantFilter] = useState('All Restaurants')
  const [txRestaurantFilter, setTxRestaurantFilter] = useState('All Restaurants')
  const [selectedService, setSelectedService] = useState<any | null>(null)
  // Service whose assets are being viewed via the Assets action; separate from
  // selectedService so the Assets button does not open the Selected Service modal.
  const [serviceAssetsTarget, setServiceAssetsTarget] = useState<any | null>(null)
  const [selectedSubService, setSelectedSubService] = useState<any | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null)
  const [showServiceAssetsModal, setShowServiceAssetsModal] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{ type: 'service' | 'sub_service' | 'transaction'; item: any } | null>(null)
  const [pendingArchive, setPendingArchive] = useState<{ type: 'service' | 'sub_service'; item: any; unarchive?: boolean } | null>(null)
  const isFullyPaid = originalTxStatus === 'Fully Paid'

  // tab switch indicator
  const tabContainerRef = useRef<HTMLDivElement>(null)
  const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [tabIndicator, setTabIndicator] = useState({ x: 0, width: 0 })

  const measureTabIndicator = () => {
    const btn = tabButtonRefs.current[activeTab]
    const container = tabContainerRef.current
    if (!btn || !container) return
    const containerRect = container.getBoundingClientRect()
    const btnRect = btn.getBoundingClientRect()
    setTabIndicator({ x: btnRect.left - containerRect.left, width: btnRect.width })
  }

  // Measure synchronously before paint so there's no flash on mount/tab change
  useLayoutEffect(() => {
    measureTabIndicator()
  }, [activeTab])

  // Re-measure on resize (e.g. container width changes responsively)
  useEffect(() => {
    window.addEventListener('resize', measureTabIndicator)
    return () => window.removeEventListener('resize', measureTabIndicator)
  }, [activeTab])

  const serviceRestaurantOptions = useMemo(() => Array.from(new Set(items.map((i: any) => i.restaurant).filter(Boolean))) as string[], [items])
  const txRestaurantOptions = useMemo(() => Array.from(new Set(transactions.map((tx: any) => tx.restaurant || tx.service?.restaurant).filter(Boolean))) as string[], [transactions])

  const filtered = useMemo(() => items.filter(i =>
    i.service_type.toLowerCase().includes(search.toLowerCase()) &&
    (serviceRestaurantFilter === 'All Restaurants' || i.restaurant === serviceRestaurantFilter) &&
    (serviceArchiveFilter === 'All' || (serviceArchiveFilter === 'Archived' ? Boolean(i.is_archived) : !i.is_archived))
  ), [items, search, serviceRestaurantFilter, serviceArchiveFilter])
  const servicesPageSize = 10
  const paginatedServices = useMemo(
    () => filtered.slice((servicesPage - 1) * servicesPageSize, servicesPage * servicesPageSize),
    [filtered, servicesPage],
  )
  const servicePageTotal = Math.max(1, Math.ceil(filtered.length / servicesPageSize))

  const subServiceRestaurantOptions = useMemo(() => Array.from(new Set(allSubServices.map((s: any) => s.restaurant).filter(Boolean))) as string[], [allSubServices])

  const filteredSubServices = useMemo(
    () => allSubServices.filter(s =>
      (subServiceArchiveFilter === 'All' || (subServiceArchiveFilter === 'Archived' ? Boolean(s.is_archived) : !s.is_archived)) &&
      (subServiceRestaurantFilter === 'All Restaurants' || s.restaurant === subServiceRestaurantFilter) &&
      (s.name.toLowerCase().includes(subServiceSearch.toLowerCase()) || s.restaurant.toLowerCase().includes(subServiceSearch.toLowerCase()))
    ),
    [allSubServices, subServiceSearch, subServiceArchiveFilter, subServiceRestaurantFilter],
  )
  const paginatedSubServices = useMemo(
    () => filteredSubServices.slice((subServicesPage - 1) * servicesPageSize, subServicesPage * servicesPageSize),
    [filteredSubServices, subServicesPage],
  )
  const subServicePageTotal = Math.max(1, Math.ceil(filteredSubServices.length / servicesPageSize))

  const txDateRange = useMemo(() => resolveDateRange(txDateFilter), [txDateFilter])

  const filteredTransactions = useMemo(
    () => transactions.filter(tx => {
      const txRestaurant = tx.restaurant || tx.service?.restaurant || ''
      const matchesRestaurant = txRestaurantFilter === 'All Restaurants' || txRestaurant === txRestaurantFilter
      return matchesRestaurant && dateInRange(tx.service_date, txDateRange)
    }),
    [transactions, txDateRange, txRestaurantFilter],
  )

  const paginatedTransactions = useMemo(
    () => filteredTransactions.slice((transactionsPage - 1) * servicesPageSize, transactionsPage * servicesPageSize),
    [filteredTransactions, transactionsPage],
  )
  const transactionPageTotal = Math.max(1, Math.ceil(filteredTransactions.length / servicesPageSize))

  useEffect(() => { setServicesPage(1) }, [search, serviceRestaurantFilter, serviceArchiveFilter, items.length])
  useEffect(() => { setSubServicesPage(1) }, [subServiceSearch, subServiceArchiveFilter, subServiceRestaurantFilter, allSubServices.length])
  useEffect(() => { setTransactionsPage(1) }, [txDateFilter, txRestaurantFilter, transactions.length])
  useEffect(() => {
    if (!subServiceForm.food_package_id) return

    const selectedPackage = packages.find((pkg: any) => String(pkg.food_package_id) === String(subServiceForm.food_package_id))
    if (!selectedPackage) return

    const nextPrice = String(Number(selectedPackage.price || 0).toFixed(2))
    setSubServiceForm(prev => prev.price === nextPrice ? prev : { ...prev, price: nextPrice })
  }, [packages, subServiceForm.food_package_id])

  const closeServiceModal = () => {
    setShowModal(false)
    setServiceTypeDropdownOpen(false)
    // Reset the entry mode and form state only AFTER the modal's close animation
    // finishes, so the content doesn't visibly switch back to "Service" while closing.
    window.setTimeout(() => {
      setEditingId(null)
      setEditingSubServiceId(null)
      setForm(emptyForm)
      setErrors({})
      setServiceAssetRows([])
      setAssetSelect('')
      setAssetQty('1')
      setServiceEntryMode('service')
      setSubServiceForm(emptySubServiceForm)
      setSubServiceAttachSelect(null)
      setAttachedSubServices([])
      initialAttachedSubServiceIdsRef.current = new Set()
    }, 280)
  }

  const openCreate = () => {
    setForm(emptyForm)
    setErrors({})
    setServiceAssetRows([])
    setServiceEntryMode('service')
    setSubServiceForm(emptySubServiceForm)
    setSubServiceAttachSelect(null)
    setAttachedSubServices([])
    initialAttachedSubServiceIdsRef.current = new Set()
    setShowModal(true)
  }

  const fetchSubServices = async (serviceId: number) => {
    setSubServicesLoading((prev) => ({ ...prev, [serviceId]: true }))
    try {
      const res = await fetch(`/api/services/${serviceId}/sub-services?includeArchived=true`)
      if (!res.ok) throw new Error('Failed to load sub-services')
      const json = await res.json().catch(() => ({ subServices: [] }))
      setSubServicesByService((prev) => ({ ...prev, [serviceId]: json.subServices || [] }))
      return json.subServices || []
    } catch (error) {
      setSubServicesByService((prev) => ({ ...prev, [serviceId]: [] }))
      return []
    } finally {
      setSubServicesLoading((prev) => ({ ...prev, [serviceId]: false }))
    }
  }

  const fetchTransactionAssetPenalty = async (txId: number) => {
    if (!txId) return 0
    try {
      const res = await fetch(`/api/service_transaction_assets/${txId}`)
      if (!res.ok) return 0
      const j = await res.json().catch(() => ({ totalPenalty: 0 }))
      return Number(j.totalPenalty || 0)
    } catch (error) {
      return 0
    }
  }

  const toggleServiceExpansion = async (service: any) => {
    const serviceId = Number(service.service_id)
    setExpandedServiceIds((prev) => {
      const exists = prev.includes(serviceId)
      if (exists) return prev.filter((id) => id !== serviceId)
      return [...prev, serviceId]
    })

    if (!subServicesByService[serviceId]) {
      await fetchSubServices(serviceId)
    }
  }

  const openSubServiceModal = async (service: any, existing?: any) => {
    const restaurant = existing?.restaurant || service.restaurant || 'Lakay Ago'
    setSubServiceTargetServiceId(Number(service.service_id))
    setEditingSubServiceId(existing ? Number(existing.sub_service_id) : null)
    setSelectedAttachSubServiceId(null)
    setSubServiceSearch('')
    setSubServiceForm({
      name: existing?.name || '',
      price: existing ? String(existing.price ?? '0') : '0.00',
      restaurant,
      food_package_id: existing?.food_package_id ? String(existing.food_package_id) : (service.food_package_id ? String(service.food_package_id) : undefined),
    })
    try {
      const res = await fetch(`/api/sub-services?restaurant=${encodeURIComponent(restaurant)}&includeArchived=false`)
      const json = await res.json().catch(() => ({ subServices: [] }))
      setAvailableSubServices(json.subServices || [])
    } catch (error) {
      setAvailableSubServices([])
    }
    setShowSubServiceModal(true)
  }

  const saveSubService = async () => {
    if (!subServiceTargetServiceId || selectedAttachSubServiceId == null) {
      showToast({ type: 'error', message: 'Select a sub-service to attach.' })
      return
    }

    const res = await fetch(`/api/services/${subServiceTargetServiceId}/sub-services`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sub_service_id: Number(selectedAttachSubServiceId) }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      showToast({ type: 'error', message: err.error || 'Failed to attach sub-service' })
      return
    }

    const json = await res.json().catch(() => ({ subService: null }))
    const saved = json.subService
    if (saved) {
      setSubServicesByService((prev) => ({
        ...prev,
        [subServiceTargetServiceId]: [saved, ...(prev[subServiceTargetServiceId] || [])],
      }))
    }

    setShowSubServiceModal(false)
    setEditingSubServiceId(null)
    setSubServiceTargetServiceId(null)
    setSelectedAttachSubServiceId(null)
    setSubServiceForm(emptySubServiceForm)
    showToast({ type: 'success', message: 'Sub-service attached' })
  }

  const archiveSubService = async (subServiceId: number, serviceId?: number) => {
    const res = await fetch(`/api/sub-services/${subServiceId}/archive`, { method: 'PATCH' })
    if (!res.ok) {
      showToast({ type: 'error', message: 'Failed to archive sub-service' })
      return
    }

    setAllSubServices(prev => prev.map(s => Number(s.sub_service_id) === Number(subServiceId) ? { ...s, is_archived: true } : s))
    if (serviceId == null) {
      showToast({ type: 'success', message: 'Sub-service archived' })
      return
    }
    const json = await res.json().catch(() => ({ subService: null }))
    setSubServicesByService((prev) => ({
      ...prev,
      [serviceId]: (prev[serviceId] || []).map((item) => item.sub_service_id === subServiceId ? { ...item, ...json.subService } : item),
    }))
    showToast({ type: 'success', message: 'Sub-service archived' })
  }

  const restoreSubService = async (subServiceId: number, serviceId?: number) => {
    const res = await fetch(`/api/sub-services/${subServiceId}/restore`, { method: 'PATCH' })
    if (!res.ok) {
      showToast({ type: 'error', message: 'Failed to restore sub-service' })
      return
    }

    const json = await res.json().catch(() => ({ subService: null }))
    setAllSubServices(prev => prev.map(s => Number(s.sub_service_id) === Number(subServiceId) ? { ...s, is_archived: false, ...(json.subService || {}) } : s))
    if (serviceId != null) {
      setSubServicesByService((prev) => ({
        ...prev,
        [serviceId]: (prev[serviceId] || []).map((item) => item.sub_service_id === subServiceId ? { ...item, ...json.subService } : item),
      }))
    }
    showToast({ type: 'success', message: 'Sub-service restored' })
  }

  const detachSubService = async (serviceId: number, subServiceId: number) => {
    const res = await fetch(`/api/services/${serviceId}/sub-services/${subServiceId}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      showToast({ type: 'error', message: err.error || 'Failed to detach sub-service' })
      return
    }

    setSubServicesByService((prev) => ({
      ...prev,
      [serviceId]: (prev[serviceId] || []).filter((item) => item.sub_service_id !== subServiceId),
    }))
    showToast({ type: 'success', message: 'Sub-service detached' })
  }

  const attachableSubServices = allSubServices.filter(s => {
    if (s.is_archived) return false
    if (s.restaurant === 'Both') return true
    return s.restaurant === form.restaurant
  })

  const attachedSubServiceTotal = useMemo(
    () => attachedSubServices.reduce((sum, s) => sum + Number(s.price || 0), 0),
    [attachedSubServices],
  )

  useEffect(() => {
    if (serviceEntryMode !== 'service') return
    // Only auto-compute the price when the user newly attaches sub-services
    // in this modal session. Sub-services that were already attached (loaded
    // when editing an existing service) must not overwrite the saved price.
    const added = attachedSubServices.filter(s => !initialAttachedSubServiceIdsRef.current.has(Number(s.sub_service_id)))
    if (added.length === 0) return
    const nextPrice = attachedSubServiceTotal.toFixed(2)
    setForm(prev => (prev.price === nextPrice ? prev : { ...prev, price: nextPrice }))
  }, [attachedSubServiceTotal, serviceEntryMode, attachedSubServices])

  const addAttachedSubService = () => {
    if (subServiceAttachSelect == null) return
    const sub = attachableSubServices.find(s => Number(s.sub_service_id) === subServiceAttachSelect)
    if (!sub) return
    if (attachedSubServices.some(s => Number(s.sub_service_id) === Number(sub.sub_service_id))) return
    setAttachedSubServices(prev => [...prev, sub])
    setSubServiceAttachSelect(null)
  }

  const removeAttachedSubService = (subServiceId: number) => {
    setAttachedSubServices(prev => prev.filter(s => Number(s.sub_service_id) !== Number(subServiceId)))
  }

  const attachSelectedSubServices = async (serviceId: number | string) => {
    if (!attachedSubServices.length) return
    for (const sub of attachedSubServices) {
      try {
        await fetch(`/api/services/${serviceId}/sub-services`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sub_service_id: Number(sub.sub_service_id) }),
        })
      } catch (err) {
        console.error('Failed to attach sub-service', err)
      }
    }
    setAttachedSubServices([])
  }

  useEffect(() => {
    const fetchPackages = async () => {
      const res = await fetch(`/api/food_packages?type=catering_package&includeArchived=true&limit=${PACKAGE_FETCH_LIMIT}`)
      if (!res.ok) return
      const json = await res.json().catch(() => ({}))
      setPackages(json.packages || [])
    }
    void fetchPackages()
  }, [])

  // fetch all sub-services for the standalone Sub Services table
  useEffect(() => {
    let mounted = true
    setSubServicesTableLoading(true)
    fetch('/api/sub-services?includeArchived=true')
      .then(r => r.json())
      .then(j => { if (mounted) setAllSubServices(j.subServices || []) })
      .catch(() => {})
      .finally(() => { if (mounted) setSubServicesTableLoading(false) })
    return () => { mounted = false }
  }, [])

  // fetch assets for selected restaurant when modal opens or restaurant changes
  useEffect(() => {
    if (!showModal) return
    const rest = form.restaurant || 'Lakay Ago'
    fetch(`/api/assets_inventory?restaurant=${encodeURIComponent(rest)}&includeArchived=true`)
      .then(r => r.json())
      .then(j => setAssetsOptions(j.assets || []))
      .catch(() => setAssetsOptions([]))
  }, [showModal, form.restaurant])

  useEffect(() => {
    if (!showSubServiceModal) return
    const rest = subServiceForm.restaurant || 'Lakay Ago'
    fetch(`/api/assets_inventory?restaurant=${encodeURIComponent(rest)}&includeArchived=true`)
      .then(r => r.json())
      .then(j => setAssetsOptions(j.assets || []))
      .catch(() => setAssetsOptions([]))
  }, [showSubServiceModal, subServiceForm.restaurant])

  const addAssetRow = (assetId: string, quantity: string) => {
    const id = Number(assetId)
    const qty = Number(quantity)
    if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(qty) || qty <= 0) return

    const item = assetsOptions.find((option) => Number(option.asset_id) === id)
    if (!item) return

    setServiceAssetRows((prev) => {
      const existingIndex = prev.findIndex((row) => Number(row.asset_id) === id)
      if (existingIndex >= 0) {
        const next = [...prev]
        next[existingIndex] = { ...next[existingIndex], assigned_quantity: Number(next[existingIndex].assigned_quantity) + qty, asset_name: item.name }
        return next
      }
      return [...prev, { asset_id: id, assigned_quantity: qty, asset_name: item.name }]
    })
  }

  const removeAssetRow = (assetId: number) => {
    setServiceAssetRows((prev) => prev.filter((row) => Number(row.asset_id) !== Number(assetId)))
  }

  const handleSaveSubService = async () => {
    const payload = {
      name: subServiceForm.name.trim(),
      price: Number(subServiceForm.price || 0),
      restaurant: subServiceForm.restaurant,
      food_package_id: subServiceForm.food_package_id && subServiceForm.food_package_id !== 'null' ? Number(subServiceForm.food_package_id) : null,
    }

    if (!payload.name) {
      showToast({ type: 'error', message: 'Sub-service name is required.' })
      return
    }

    const subServiceId = editingSubServiceId ?? editingId
    const url = subServiceId ? `/api/sub-services/${subServiceId}` : '/api/sub-services'
    const method = subServiceId ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      showToast({ type: 'error', message: err.error || (subServiceId ? 'Failed to update sub-service.' : 'Failed to create sub-service.') })
      return
    }

    const json = await res.json().catch(() => ({ subService: null }))
    const saved = json.subService
    if (saved) {
      setAllSubServices((prev) => {
        if (subServiceId) {
          return prev.map((item) => Number(item.sub_service_id) === Number(subServiceId) ? { ...item, ...saved } : item)
        }
        return [saved, ...prev]
      })
    }
    showToast({ type: 'success', message: subServiceId ? 'Sub-service updated' : 'Sub-service added' })
    setShowModal(false)
    setShowEditSubServiceModal(false)
    // Defer the entry-mode/form reset until after the modal close animation so the
    // content doesn't visibly flip back to the Service form while it's closing.
    window.setTimeout(() => {
      setEditingId(null)
      setEditingSubServiceId(null)
      setServiceEntryMode('service')
      setSubServiceForm(emptySubServiceForm)
    }, 280)
  }

  const handleSave = async () => {
    if (serviceEntryMode === 'sub_service') {
      await handleSaveSubService()
      return
    }

    const next = getErrors(form)
    if (Object.keys(next).length) { setErrors(next); return }
    const payload = { service_type: form.service_type, price: Number(form.price), restaurant: form.restaurant, assets: serviceAssetRows.map(r => ({ asset_id: Number(r.asset_id), quantity: Number(r.assigned_quantity || 0) })) }
    setLoading(true)
    setSavingAction('service')
    try {
      if (editingId) {
        const r = await fetch('/api/services', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ service_id: editingId, ...payload }) })
        if (!r.ok) throw new Error('Update failed')
        const j = await r.json()
        const updated = j.service
        await attachSelectedSubServices(updated.service_id)
        await refetchServices()
        showToast({ type: 'success', message: 'Service updated', description: updated.service_type })
        setShowModal(false)
        setEditingId(null)
      } else {
        const r = await fetch('/api/services', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (!r.ok) throw new Error('Create failed')
        const j = await r.json()
        const created = j.service
        await attachSelectedSubServices(created.service_id)
        await refetchServices()
        showToast({ type: 'success', message: 'Service saved', description: created.service_type })
        setShowModal(false)
      }
    } catch {
      showToast({ type: 'error', message: editingId ? 'Failed to update service' : 'Failed to save service' })
    } finally {
      setLoading(false)
      setSavingAction(null)
    }
  }

  const refetchServices = async () => {
    const res = await fetch('/api/services')
    if (res.ok) {
      const j = await res.json().catch(() => ({ services: [] }))
      setItems(j.services || [])
    }
  }

  const loadTxExpenseTotals = useCallback(async () => {
    try {
      const res = await fetch('/api/service_transaction_expense_totals')
      if (!res.ok) return
      const j = await res.json().catch(() => ({ totals: {} }))
      const totals: Record<number, number> = {}
      for (const [key, value] of Object.entries(j.totals || {})) {
        totals[Number(key)] = Number(value || 0)
      }
      setTxExpenseTotals(totals)
    } catch (error) {
      console.error('Failed to load service transaction expense totals', error)
    }
  }, [])

  // Expenses shown for a transaction = total of its expense lines; falls back to the
  // stored expenses column if the lines total is not loaded yet.
  const getTxExpenses = useCallback((tx: any) => {
    const txId = Number(tx?.service_transaction_id)
    if (txId && Object.prototype.hasOwnProperty.call(txExpenseTotals, txId)) return txExpenseTotals[txId]
    return Number(tx?.expenses || 0)
  }, [txExpenseTotals])

  const refreshServiceSnapshot = useCallback(async () => {
    await refetchServices()

    try {
      const res = await fetch('/api/sub-services?includeArchived=true')
      if (res.ok) {
        const json = await res.json().catch(() => ({ subServices: [] }))
        setAllSubServices(json.subServices || [])
      }
    } catch (error) {
      console.error('Failed to refresh service sub-services', error)
    }

    if (activeTab === 'transactions') {
      try {
        const res = await fetch('/api/service_transactions')
        const j = await res.json().catch(() => ({ transactions: [] }))
        const rows = j.transactions || []
        const hydrated = await Promise.all(rows.map(async (tx: any) => ({
          ...tx,
          asset_penalty: await fetchTransactionAssetPenalty(Number(tx.service_transaction_id)),
        })))
        setTransactions(hydrated)
        await loadTxExpenseTotals()
      } catch (error) {
        console.error('Failed to refresh service transactions', error)
      }
    }
  }, [activeTab, loadTxExpenseTotals])

  // Track the open Assets modal by ref so the realtime handler below can live-reload its
  // lines when another user saves asset returns, without re-creating the Realtime channel
  // on every keystroke in the modal.
  const assetsModalRef = useRef<{ open: boolean; txId: number }>({ open: false, txId: 0 })
  useEffect(() => {
    assetsModalRef.current = { open: showAssetsModal, txId: Number(currentTxId || 0) }
  }, [showAssetsModal, currentTxId])

  // Reload only the per-transaction asset lines (used to keep an open Assets modal live).
  const reloadAssetLines = useCallback(async (transactionId: number) => {
    try {
      const res = await fetch(`/api/service_transaction_assets/${transactionId}`)
      if (!res.ok) return
      const j = await res.json().catch(() => ({}))
      setAssetLines(j.lines || [])
      setAssetTotalPenalty(Number(j.totalPenalty || 0))
    } catch (error) {
      console.error('Failed to reload service transaction assets', error)
    }
  }, [])

  const reloadTransactionExpenseLines = useCallback(async (transactionId: number) => {
    if (!transactionId) {
      setExpenseRows([])
      return
    }

    try {
      const res = await fetch(`/api/service_transaction_expenses/${transactionId}`)
      if (!res.ok) {
        setExpenseRows([])
        return
      }

      const json = await res.json().catch(() => ({ lines: [] }))
      const rows = (json.lines || []).map((line: any) => ({
        service_transaction_expense_id: line.service_transaction_expense_id ?? null,
        name: String(line.name ?? ''),
        amount: String(line.amount ?? '0'),
      }))
      setExpenseRows(rows)
    } catch (error) {
      console.error('Failed to reload service transaction expenses', error)
      setExpenseRows([])
    }
  }, [])

  const expenseTotal = useMemo(
    () => expenseRows.filter((row) => !row._deleted).reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [expenseRows],
  )

  // Tracks which async save/add action is in flight ('service' | 'subService' | 'transaction' |
  // 'payment' | 'assets' | 'expenses'). Used to show "Saving...", set cursor-not-allowed on the
  // triggering button, and disable its companion close/cancel button while the request runs.
  const [savingAction, setSavingAction] = useState<string | null>(null)
  const [confirmingAction, setConfirmingAction] = useState<string | null>(null)

  const expenseModalTx = useMemo(
    () => transactions.find((t) => Number(t.service_transaction_id) === Number(expenseModalTxId)) || null,
    [transactions, expenseModalTxId],
  )
  // Fully Paid transactions are locked: expenses can be viewed but not edited.
  const expenseModalReadOnly = expenseModalTx?.status === 'Fully Paid'

  const resetExpenseModalState = useCallback(() => {
    setExpenseModalTxId(null)
    if (expenseModalResetTimerRef.current) {
      clearTimeout(expenseModalResetTimerRef.current)
    }
    expenseModalResetTimerRef.current = setTimeout(() => {
      setExpenseRows([])
      setExpenseNameInput('')
      setExpenseAmountInput('')
      setExpenseModalLoading(false)
    }, 260)
  }, [])

  const openExpenseModal = useCallback(async (tx: any) => {
    const txId = Number(tx.service_transaction_id)
    if (expenseModalResetTimerRef.current) {
      clearTimeout(expenseModalResetTimerRef.current)
      expenseModalResetTimerRef.current = null
    }
    setExpenseRows([])
    setExpenseNameInput('')
    setExpenseAmountInput('')
    setExpenseModalTxId(txId)
    setExpenseModalLoading(true)
    try {
      await reloadTransactionExpenseLines(txId)
    } finally {
      setExpenseModalLoading(false)
    }
  }, [reloadTransactionExpenseLines])

  const addExpenseRow = useCallback(() => {
    const name = expenseNameInput.trim()
    const amount = Number(expenseAmountInput)

    if (!name) {
      showToast({ type: 'error', message: 'Expense name is required.' })
      return
    }

    if (!Number.isFinite(amount) || amount < 0) {
      showToast({ type: 'error', message: 'Expense amount must be a non-negative number.' })
      return
    }

    setExpenseRows(prev => [...prev, { name, amount: amount.toFixed(2) }])
    setExpenseNameInput('')
    setExpenseAmountInput('')
  }, [expenseAmountInput, expenseNameInput, showToast])

  const removeExpenseRow = useCallback((row: any) => {
    setExpenseRows(prev => {
      const target = prev.find(item => item.service_transaction_expense_id === row.service_transaction_expense_id)
      if (target && row.service_transaction_expense_id) {
        return prev.map(item => item.service_transaction_expense_id === row.service_transaction_expense_id ? { ...item, _deleted: true } : item)
      }
      return prev.filter(item => item !== row)
    })
  }, [])

  const saveExpenseRows = useCallback(async (transactionId: number) => {
    const validRows = expenseRows.filter((row) => !row._deleted)
    const updates = validRows.map((row) => ({
      service_transaction_expense_id: row.service_transaction_expense_id ?? null,
      name: String(row.name || '').trim(),
      amount: Number(row.amount || 0),
    }))

    const deleteRows = expenseRows.filter((row) => row._deleted && row.service_transaction_expense_id).map((row) => ({
      service_transaction_expense_id: row.service_transaction_expense_id,
      _deleted: true,
    }))

    const payloadRows: Array<{ service_transaction_expense_id?: number | null; name?: string; amount?: number; _deleted?: boolean }> = [...updates, ...deleteRows]
    if (payloadRows.length === 0) {
      resetExpenseModalState()
      showToast({ type: 'success', message: 'Expense updates saved.' })
      return
    }

    for (const row of updates) {
      if (!row.name || !row.name.trim() || !Number.isFinite(row.amount) || row.amount < 0) {
        throw new Error('Each expense row requires a non-empty name and a non-negative amount.')
      }
    }

    const res = await fetch(`/api/service_transaction_expenses/${transactionId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates: payloadRows }) })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || 'Failed to save expense rows')
    await reloadTransactionExpenseLines(transactionId)
    void loadTxExpenseTotals()
    resetExpenseModalState()
    showToast({ type: 'success', message: 'Transaction expenses saved.' })
  }, [expenseRows, reloadTransactionExpenseLines, loadTxExpenseTotals, resetExpenseModalState, showToast])

  // A stable handler identity matters: passing a new function on every render makes the
  // hook tear down and re-create the Realtime channel repeatedly, which can silently miss
  // events. All subscriptions below share this one callback.
  const handleRealtimeChange = useCallback((payload: RealtimePayload) => {
    void refreshServiceSnapshot()

    const { open, txId } = assetsModalRef.current
    const changedTxId = Number(payload?.new?.service_transaction_id ?? payload?.old?.service_transaction_id ?? 0)
    if (open && txId && changedTxId === txId) {
      void reloadAssetLines(txId)
    }

    const changedExpenseTxId = Number(payload?.new?.service_transaction_id ?? payload?.old?.service_transaction_id ?? 0)
    if (expenseModalTxId && changedExpenseTxId === expenseModalTxId && payload.table === 'service_transaction_expenses') {
      void reloadTransactionExpenseLines(changedExpenseTxId)
    }
  }, [expenseModalTxId, refreshServiceSnapshot, reloadAssetLines, reloadTransactionExpenseLines])

  useRealtimeEntity('services', {
    onChange: handleRealtimeChange,
  })

  useRealtimeEntity('sub_services', {
    onChange: handleRealtimeChange,
  })

  useRealtimeEntity('service_transactions', {
    onChange: handleRealtimeChange,
  })

  useRealtimeEntity('service_transaction_expenses', {
    onChange: handleRealtimeChange,
  })

  // Asset return saves write ONLY the service_transaction_assets table — the API does not
  // touch the service_transactions row, so no event fires on the subscriptions above.
  // Listening here lets every user refetch the transactions (re-hydrating each row's
  // asset_penalty) and refresh an open Assets modal whenever another user saves returns.
  useRealtimeEntity('service_transaction_assets', {
    onChange: handleRealtimeChange,
  })

  useEffect(() => {
    return () => {
      if (assetModalResetTimerRef.current) {
        clearTimeout(assetModalResetTimerRef.current)
      }
      if (expenseModalResetTimerRef.current) {
        clearTimeout(expenseModalResetTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    refetchServices()
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (activeTab !== 'transactions') return
    let mounted = true
    setTxLoading(true)

    const loadTransactions = async () => {
      try {
        const res = await fetch('/api/service_transactions')
        const j = await res.json().catch(() => ({ transactions: [] }))
        if (!mounted) return

        const rows = j.transactions || []
        const hydrated = await Promise.all(rows.map(async (tx: any) => ({
          ...tx,
          asset_penalty: await fetchTransactionAssetPenalty(Number(tx.service_transaction_id)),
        })))

        setTransactions(hydrated)
      } catch (error) {
        if (mounted) setTransactions([])
      } finally {
        if (mounted) setTxLoading(false)
      }
    }

    loadTransactions()
    void loadTxExpenseTotals()
    return () => { mounted = false }
  }, [activeTab, loadTxExpenseTotals])

  const openCreateTx = () => {
    setEditingTxId(null)
    setTxBalance(0)
    setTxForm({ ...emptyTxForm, restaurant: '', service_id: undefined, status: 'Under Reservation' })
    setAssetTotalPenalty(0)
    setOriginalTxStatus('') // nothing saved yet
    setShowTxModal(true)
  }

  const openEditTx = async (tx: any) => {
    const txId = Number(tx.service_transaction_id)
    const restaurant = tx.service?.restaurant || tx.restaurant || ''
    const assetPenalty = Number(tx.asset_penalty ?? await fetchTransactionAssetPenalty(txId) ?? 0)
    const liveBalance = Number(tx.balance ?? 0)

    setEditingTxId(txId)
    setTxBalance(liveBalance)
    setTxForm({
      restaurant,
      service_id: tx.service_id,
      service_date: tx.service_date?.slice(0,10) ?? '',
      price: String(tx.price),
      downpayment: String(tx.downpayment || '0'),
      discount: String(tx.discount || '0'),
      penalty: String(Number(tx.penalty || 0)),
      expenses: String(getTxExpenses(tx)),
      status: tx.status,
    })
    setOriginalTxStatus(tx.status || '') // the status as-saved in DB
    setAssetTotalPenalty(assetPenalty)
    setShowTxModal(true)
  }

  const resetAssetsModalState = useCallback(() => {
    setShowAssetsModal(false)
    if (assetModalResetTimerRef.current) {
      clearTimeout(assetModalResetTimerRef.current)
    }
    assetModalResetTimerRef.current = setTimeout(() => {
      setAssetLines([])
      setAssetTotalPenalty(0)
      setCurrentTxId(null)
      setCurrentTxStatus('')
      setAssetModalLoading(false)
    }, 260)
  }, [])

  const openAssetsModal = async (tx: any) => {
    if (assetModalResetTimerRef.current) {
      clearTimeout(assetModalResetTimerRef.current)
      assetModalResetTimerRef.current = null
    }
    setAssetLines([])
    setAssetTotalPenalty(0)
    setCurrentTxId(tx.service_transaction_id)
    setCurrentTxStatus(tx.status || '')
    setAssetModalLoading(true)
    setShowAssetsModal(true)

    try {
      const res = await fetch(`/api/service_transaction_assets/${tx.service_transaction_id}`)
      if (!res.ok) { setAssetLines([]); setAssetTotalPenalty(0); return }
      const j = await res.json().catch(() => ({}))
      setAssetLines(j.lines || [])
      setAssetTotalPenalty(Number(j.totalPenalty || 0))
    } finally {
      setAssetModalLoading(false)
    }
  }

  const saveAssets = async (txId: number) => {
    const updates = assetLines.map(l => ({ asset_id: l.asset_id, quantity_returned: Number(l.quantity_returned || 0) }))
    const res = await fetch(`/api/service_transaction_assets/${txId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates }) })
    if (res.ok) {
      setTransactions(prev => prev.map(t => t.service_transaction_id === txId ? { ...t, asset_penalty: assetTotalPenalty } : t))
      resetAssetsModalState()
      showToast({ type: 'success', message: 'Assets updated' })
    } else {
      const err = await res.json().catch(() => ({}))
      showToast({ type: 'error', message: err.error || 'This asset is not assigned to this service' })
    }
  }

  const deleteTransaction = async (tx: any) => {
    try {
      const res = await fetch(`/api/service_transactions/${tx.service_transaction_id}`, { method: 'DELETE' })
      if (res.ok) {
        setTransactions(prev => prev.filter(t => t.service_transaction_id !== tx.service_transaction_id))
        setSelectedTransaction(null)
        showToast({ type: 'success', message: 'Transaction deleted' })
      } else {
        const err = await res.json().catch(() => ({}))
        showToast({ type: 'error', message: err.error || 'Failed to delete transaction' })
      }
    } catch {
      showToast({ type: 'error', message: 'Failed to delete transaction' })
    }
  }

  const confirmPendingDelete = async () => {
    if (!pendingDelete) return
    const { type, item } = pendingDelete
    const key = type === 'service' ? 'delete_service' : type === 'sub_service' ? 'delete_sub_service' : 'delete_transaction'
    setConfirmingAction(key)
    try {
      if (type === 'service') {
        await deleteService(item)
      } else if (type === 'sub_service') {
        await deleteSubService(item)
      } else {
        await deleteTransaction(item)
      }
    } finally {
      setConfirmingAction(null)
      setPendingDelete(null)
    }
  }

  const confirmPendingArchive = async () => {
    if (!pendingArchive) return
    const { type, item, unarchive } = pendingArchive
    const key = unarchive
      ? (type === 'service' ? 'unarchive_service' : 'unarchive_sub_service')
      : (type === 'service' ? 'archive_service' : 'archive_sub_service')
    setConfirmingAction(key)
    try {
      if (type === 'service') {
        if (unarchive) {
          await unarchiveService(item)
        } else {
          await archiveService(item)
        }
      } else {
        if (unarchive) {
          await restoreSubService(Number(item.sub_service_id), item.service_id ? Number(item.service_id) : undefined)
        } else {
          await archiveSubService(Number(item.sub_service_id), item.service_id ? Number(item.service_id) : undefined)
        }
      }
    } finally {
      setConfirmingAction(null)
      setPendingArchive(null)
    }
  }

  const openEditService = (service: any) => {
    setEditingId(service.service_id)
    setForm({ service_type: service.service_type, price: String(service.price), restaurant: service.restaurant || 'Lakay Ago' })
    const rows = (service.assets || []).map((a: any) => ({ id: `a-${a.asset_id}`, asset_id: a.asset_id, asset_name: a.name || '', assigned_quantity: a.quantity_used || 0 }))
    setServiceAssetRows(rows)
    setSubServiceAttachSelect(null)
    setAttachedSubServices([])
    setShowModal(true)
    fetch(`/api/services/${service.service_id}/sub-services?includeArchived=false`)
      .then(r => r.json())
      .then(j => {
        const subs = j.subServices || []
        initialAttachedSubServiceIdsRef.current = new Set(subs.map((s: any) => Number(s.sub_service_id)))
        setAttachedSubServices(subs)
      })
      .catch(() => {})
  }

  const archiveService = async (service: any) => {
    try {
      const res = await fetch(`/api/services?id=${service.service_id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showToast({ type: 'error', message: err.error || 'Failed to archive service' })
        return
      }
    setItems(prev => prev.map(item => Number(item.service_id) === Number(service.service_id) ? { ...item, is_archived: true } : item))
    setSelectedService(null)
    showToast({ type: 'success', message: 'Service archived' })
    } catch (error) {
      showToast({ type: 'error', message: 'Failed to archive service' })
    }
  }

  const unarchiveService = async (service: any) => {
    try {
      const res = await fetch('/api/services', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: service.service_id, is_archived: false }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showToast({ type: 'error', message: err.error || 'Failed to restore service' })
        return
      }
      setItems(prev => prev.map(item => Number(item.service_id) === Number(service.service_id) ? { ...item, is_archived: false } : item))
      setSelectedService(null)
      showToast({ type: 'success', message: 'Service restored' })
    } catch (error) {
      showToast({ type: 'error', message: 'Failed to restore service' })
    }
  }

  const deleteService = async (service: any) => {
    try {
      const res = await fetch(`/api/services?id=${service.service_id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showToast({ type: 'error', message: err.error || 'Failed to delete service' })
        return
      }
      setItems(prev => prev.filter(item => Number(item.service_id) !== Number(service.service_id)))
      setSelectedService(null)
      showToast({ type: 'success', message: 'Service deleted' })
    } catch (error) {
      showToast({ type: 'error', message: 'Failed to delete service' })
    }
  }

  const deleteSubService = async (subService: any) => {
    try {
      const res = await fetch(`/api/sub-services/${subService.sub_service_id}/archive`, { method: 'PATCH' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showToast({ type: 'error', message: err.error || 'Failed to delete sub-service' })
        return
      }
      setAllSubServices(prev => prev.filter(item => Number(item.sub_service_id) !== Number(subService.sub_service_id)))
      setSelectedSubService(null)
      showToast({ type: 'success', message: 'Sub-service deleted' })
    } catch (error) {
      showToast({ type: 'error', message: 'Failed to delete sub-service' })
    }
  }
  
  const handleSaveTx = async () => {
    if (!txForm.restaurant || !txForm.service_id || !txForm.service_date || txForm.price === '') { showToast({ type: 'error', message: 'Missing fields' }); return }

    const autoStatus = Number(txForm.downpayment || 0) > 0 ? 'Partial Payment' : 'Under Reservation'
    const nextStatus = editingTxId ? (txForm.status || autoStatus) : autoStatus
    const payload: any = {
      service_id: Number(txForm.service_id),
      service_date: txForm.service_date,
      price: Number(txForm.price),
      downpayment: Number(txForm.downpayment || 0),
      discount: Number(txForm.discount || 0),
      penalty: Number(txForm.penalty || 0),
      balance: Number(txBalance || 0),
      status: nextStatus,
    }
    try {
      if (editingTxId) {
        const res = await fetch(`/api/service_transactions/${editingTxId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (!res.ok) throw new Error('Update failed')
        const j = await res.json()
        setTxBalance(Number(j.transaction.balance || 0))
        setTransactions(prev => prev.map(t => (t.service_transaction_id === j.transaction.service_transaction_id ? { ...j.transaction, asset_penalty: assetTotalPenalty } : t)))
        showToast({ type: 'success', message: 'Transaction updated' })
      } else {
        const res = await fetch('/api/service_transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (!res.ok) throw new Error('Create failed')
        const j = await res.json()
        setTransactions(prev => [{ ...j.transaction, asset_penalty: 0 }, ...prev])
        showToast({ type: 'success', message: 'Transaction created' })
      }
      setShowTxModal(false)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save transaction'
      showToast({ type: 'error', message })
    }
  }

  const handleAddPayment = async () => {
    const amount = Number(addPaymentAmount || '0')
    if (!editingTxId || amount <= 0) { showToast({ type: 'error', message: 'Enter a valid amount' }); return }
    try {
      const res = await fetch(`/api/service_transactions/${editingTxId}/payment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount }) })
      if (!res.ok) throw new Error('Payment failed')
      const j = await res.json()
      setTxBalance(Number(j.transaction.balance || 0))
      setTransactions(prev => prev.map(t => t.service_transaction_id === editingTxId ? j.transaction : t))
      showToast({ type: 'success', message: `Payment of ₱${amount.toFixed(2)} added` })
      setAddPaymentAmount('')
    } catch (e) {
      showToast({ type: 'error', message: 'Failed to add payment' })
    }
  }

  const updateAssetQuantity = (assetId: number, qty: number) => {
    const next = assetLines.map(l => l.asset_id === assetId ? { ...l, quantity_returned: qty, quantity_missing: Math.max((l.assigned_quantity || 0) - qty, 0), penalty_amount: Math.max((l.assigned_quantity || 0) - qty, 0) * (l.penalty_rate || 0) } : l)
    setAssetLines(next)
    setAssetTotalPenalty(next.reduce((s:any,l:any)=>s+Number(l.penalty_amount||0),0))
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">Services</h2>
          <p className="text-sm text-slate-500">Manage service transactions.</p>
        </div>
        {activeTab === 'services' ? (
            <button onClick={openCreate} disabled={Boolean(savingAction)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-600"><Plus size={14}/> Add Service</button>
          ) : (
            <button onClick={openCreateTx} disabled={Boolean(savingAction)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-600"><Plus size={14}/> Add Transaction</button>
          )}
      </div> 

      <div className="flex items-center gap-3 mb-2">
        <div ref={tabContainerRef} className="relative flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {/* sliding highlight — measured pixel position, GPU composited */}
          <div
            className="absolute inset-y-1 left-0 rounded-lg bg-indigo-600 shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform"
            style={{
              width: tabIndicator.width,
              transform: `translate3d(${tabIndicator.x}px, 0, 0)`,
            }}
          />

          {tabs.map((tab) => (
            <button
              key={tab.key}
              ref={(el) => { tabButtonRefs.current[tab.key] = el }}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`relative z-10 flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-300 ${
                activeTab === tab.key
                  ? 'text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'services' ? (
        <div className="space-y-4 border-none border-slate-200">
          {isMobile ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-indigo-600 text-white flex items-center justify-between gap-3 flex-wrap">
                <h3 className="text-sm font-semibold">Services</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="w-full flex items-center gap-2 border border-slate-200 bg-white rounded-lg px-3 py-2 focus-within:border-indigo-400">
                  <Search size={14} className="text-slate-400" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search services..." className="w-full outline-none text-sm text-black" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select value={serviceRestaurantFilter} onChange={e => setServiceRestaurantFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white outline-none focus:border-indigo-400 font-display text-slate-600">
                    <option value="All Restaurants">All Restaurants</option>
                    {serviceRestaurantOptions.map(restaurant => (
                      <option key={restaurant} value={restaurant}>{restaurant}</option>
                    ))}
                  </select>
                  <select value={serviceArchiveFilter} onChange={e => setServiceArchiveFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white outline-none focus:border-indigo-400 font-display text-slate-600">
                    <option value="Not Archived">Active</option>
                    <option value="Archived">Archived</option>
                    <option value="All">All</option>
                  </select>
                </div>
              </div>
            </div>
          <div>
                {filtered.length === 0 ? <div className="p-4 text-sm text-slate-400">No services.</div> : filtered.map(i => (
                  <button type="button" key={i.service_id} className="w-full p-3 border-b border-slate-200 bg-white flex justify-between items-center text-left cursor-pointer transition-colors duration-150 active:bg-slate-50" onClick={() => setSelectedService(i)}>
                    <div>
                      <div className="font-medium">{i.service_type}</div>
                      <div className="text-xs text-slate-500">{i.restaurant}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="font-mono text-sm text-slate-700">{i.price}</div>
                    </div>
                  </button>
                ))}
              </div>
              <PaginationFooter items={filtered} page={servicesPage} setPage={setServicesPage} pageSize={servicesPageSize} noun="services" />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3 flex-wrap">
                <h3 className="text-sm font-semibold">Services</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <select value={serviceRestaurantFilter} onChange={e => setServiceRestaurantFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 font-display text-slate-600">
                    <option value="All Restaurants">All Restaurants</option>
                    {serviceRestaurantOptions.map(restaurant => (
                      <option key={restaurant} value={restaurant}>{restaurant}</option>
                    ))}
                  </select>
                  <select value={serviceArchiveFilter} onChange={e => setServiceArchiveFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 font-display text-slate-600">
                    <option value="Not Archived">Active</option>
                    <option value="Archived">Archived</option>
                    <option value="All">All</option>
                  </select>
                  <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 focus-within:border-indigo-400">
                    <Search size={14} className="text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search services..." className="w-full outline-none text-sm" />
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full table-fixed">
                  <colgroup>
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '30%' }} />
                  </colgroup>
                  <thead className="text-xs uppercase border-b border-slate-200 bg-indigo-600 text-white">
                    <tr>
                      <th className="py-3 px-4 text-left">Type</th>
                      <th className="py-3 px-4 text-center">Price</th>
                      <th className="py-3 px-4 text-center">Restaurant</th>
                      <th className="py-3 px-4 text-left">Assets</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 border-b border-slate-200">
                    {loading ? (
                      <SkeletonTableRows
                        columns={5}
                        rows={2}
                        columnConfig={[
                          { width: "18%" },
                          { width: "14%" },
                          { width: "16%" },
                          { width: "22%" },
                          { width: "30%" },
                        ]}
                      />
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={5} className="p-6 text-center text-sm text-slate-400">No services.</td></tr>
                    ) : paginatedServices.map(i => {
                      const allSubServices = subServicesByService[i.service_id] || []
                      const activeSubServices = allSubServices.filter((sub) => !sub.is_archived)
                      const archivedSubServices = allSubServices.filter((sub) => sub.is_archived)
                      const expanded = expandedServiceIds.includes(i.service_id)

                      return (
                        <Fragment key={i.service_id}>
                          <tr className="hover:bg-slate-50 cursor-pointer border-b border-slate-200 focus:outline-none focus-visible:bg-slate-100" onClick={() => setSelectedService(i)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedService(i) } }}>
                            <td className="py-3 px-4 font-medium">{i.service_type}</td>
                            <td className="py-3 px-4 text-center font-mono">{i.price}</td>
                            <td className="py-3 px-4 text-center text-sm text-slate-600">{i.restaurant}</td>
                            <td className="py-3 px-4 text-sm text-slate-600">
                              {(i.assets || []).length > 0 ? i.assets.map((a: any) => a.name).join(', ') : 'None'}
                            </td>
                            <td className="py-3 px-4 text-center text-sm" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-2 flex-wrap">
                                <button onClick={(e) => {
                                  e.stopPropagation()
                                  const svc = i
                                  setEditingId(svc.service_id)
                                  setForm({ service_type: svc.service_type, price: String(svc.price), restaurant: svc.restaurant || 'Lakay Ago' })
                                  const rows = (svc.assets || []).map((a: any) => ({ id: `a-${a.asset_id}`, asset_id: a.asset_id, asset_name: a.name || '', assigned_quantity: a.quantity_used || 0 }))
                                  setServiceAssetRows(rows)
                                  setSubServiceAttachSelect(null)
                                  setAttachedSubServices([])
                                  setShowModal(true)
                                  // load existing attached sub-services
                                  fetch(`/api/services/${svc.service_id}/sub-services?includeArchived=false`)
                                    .then(r => r.json())
                                    .then(j => {
                                      const subs = j.subServices || []
                                      initialAttachedSubServiceIdsRef.current = new Set(subs.map((s: any) => Number(s.sub_service_id)))
                                      setAttachedSubServices(subs)
                                    })
                                    .catch(() => {})
                                }} className="text-green-700 hover:underline hover:text-green-500 flex items-center gap-1.5 text-sm"><Pencil size={14}/>Edit</button>
                                <button onClick={(e) => {
                                  e.stopPropagation();
                                  setServiceAssetsTarget(i);
                                  setShowServiceAssetsModal(true);
                                }} className="text-slate-500 hover:underline hover:text-slate-600 flex items-center gap-1.5 text-sm"><Package size={14}/>Assets</button>
                                <button onClick={(e) => {
                                  e.stopPropagation();
                                  setPendingArchive({ type: 'service', item: i, unarchive: Boolean(i.is_archived) });
                                }} className={`${i.is_archived ? 'text-emerald-700 hover:underline hover:text-emerald-500' : 'text-violet-500 hover:underline hover:text-violet-600'} flex items-center gap-1.5 text-sm`}><Archive size={14}/>{i.is_archived ? 'Restore' : 'Archive'}</button>
                                <button onClick={(e) => {
                                  e.stopPropagation();
                                  setPendingDelete({ type: 'service', item: i });
                                }} className="text-red-700 hover:underline hover:text-red-500 flex items-center gap-1.5 text-sm"><Trash2 size={14}/>Delete</button>
                              </div>
                            </td>
                          </tr>
                        </Fragment>
                      )
                    })
                  }
                                    </tbody>
                </table>
              </div>
              <PaginationFooter items={filtered} page={servicesPage} setPage={setServicesPage} pageSize={servicesPageSize} noun="services" />
            </div>
          )}

        {/* Separate Sub Services Table */}
        {isMobile ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-indigo-600 text-white">
              <div className="flex items-center mb-2">
                <h3 className="text-sm font-semibold">Sub Services</h3>
              </div>
              <div className="mb-2">
                <div className="flex items-center gap-2 border border-slate-200 bg-white rounded-lg px-2 py-1.5">
                  <Search size={13} className="text-slate-400 shrink-0" />
                  <input value={subServiceSearch} onChange={e => setSubServiceSearch(e.target.value)} placeholder="Search..." className="bg-transparent text-sm outline-none text-slate-700 w-full min-w-0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <select value={subServiceRestaurantFilter} onChange={e => setSubServiceRestaurantFilter(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs bg-white outline-none focus:border-indigo-400 font-display text-slate-600">
                    <option value="All Restaurants">All Restaurants</option>
                    {subServiceRestaurantOptions.map(restaurant => (
                      <option key={restaurant} value={restaurant}>{restaurant}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <select value={subServiceArchiveFilter} onChange={e => setSubServiceArchiveFilter(e.target.value)} className="w-full border border-slate-200 rounded-lg px-2 py-2 text-xs bg-white outline-none focus:border-indigo-400 font-display text-slate-600">
                    <option value="Not Archived">Active</option>
                    <option value="Archived">Archived</option>
                    <option value="All">All</option>
                  </select>
                </div>
              </div>
            </div>
            {subServicesTableLoading ? (
              <div className="p-4 bg-white">
                <SkeletonTableRows
                  as="div"
                  columns={3}
                  rows={2}
                  columnConfig={[
                    { width: "60%" },
                    { width: "30%" },
                    { width: "30%" },
                  ]}
                />
              </div>
            ) : filteredSubServices.length === 0 ? (
              <div className="p-4 text-sm text-slate-500 bg-white">No sub-services.</div>
            ) : (
              filteredSubServices
                .map(s => (
                  <button type="button" key={s.sub_service_id} className="w-full p-3 border-b border-slate-200 bg-white flex justify-between items-center text-left transition-colors duration-150 hover:bg-slate-50" onClick={() => setSelectedSubService(s)}>
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-slate-500">{s.restaurant} · ₱{Number(s.price || 0).toFixed(2)}</div>
                    </div>
                  </button>
                ))
            )}
            <PaginationFooter items={filteredSubServices} page={subServicesPage} setPage={setSubServicesPage} pageSize={servicesPageSize} noun="sub-services" />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Sub Services</h3>
                <div className="flex items-center gap-2">
                  <select value={subServiceRestaurantFilter} onChange={e => setSubServiceRestaurantFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 font-display text-slate-600">
                    <option value="All Restaurants">All Restaurants</option>
                    {subServiceRestaurantOptions.map(restaurant => (
                      <option key={restaurant} value={restaurant}>{restaurant}</option>
                    ))}
                  </select>
                  <select value={subServiceArchiveFilter} onChange={e => setSubServiceArchiveFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 font-display text-slate-600">
                    <option value="Not Archived">Active</option>
                    <option value="Archived">Archived</option>
                    <option value="All">All</option>
                  </select>
                  <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5 max-w-xs">
                  <Search size={13} className="text-slate-400 shrink-0" />
                  <input value={subServiceSearch} onChange={e => setSubServiceSearch(e.target.value)} placeholder="Search sub-services..." className="bg-transparent text-sm outline-none text-slate-700 w-full" />
                </div>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <colgroup>
                  <col style={{ width: '25%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '25%' }} />
                </colgroup>
                <thead className="text-xs uppercase border-b border-slate-200 text-white bg-indigo-600">
                  <tr>
                    <th className="py-3 px-4 text-left">Name</th>
                    <th className="py-3 px-4 text-center font-mono">Price</th>
                    <th className="py-3 px-4 text-center">Restaurant</th>
                    <th className="py-3 px-4 text-center">Food Package</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 bg-white">
                  {subServicesTableLoading ? (
                    <SkeletonTableRows
                      columns={5}
                      rows={2}
                      columnConfig={[
                        { width: "25%" },
                        { width: "15%" },
                        { width: "15%" },
                        { width: "20%" },
                        { width: "25%" },
                      ]}
                    />
                  ) : filteredSubServices.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">No sub-services.</td>
                    </tr>
                  ) : (
                    <>
                      {paginatedSubServices.map(s => (
                        <tr
                          key={s.sub_service_id}
                          className="hover:bg-slate-50 cursor-pointer border-b border-slate-200 focus:outline-none focus-visible:bg-slate-100"
                          onClick={() => setSelectedSubService(s)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedSubService(s) } }}
                        >
                          <td className="py-3 px-4 text-left">
                            <div className="text-sm font-medium">{s.name}</div>
                            <div className="text-xs text-slate-500">{s.food_package_name ? `(${s.food_package_name})` : ''}</div>
                          </td>
                          <td className="py-3 px-4 text-center font-mono">₱{Number(s.price || 0).toFixed(2)}</td>
                          <td className="py-3 px-4 text-center text-sm text-slate-600">{s.restaurant}</td>
                          <td className="py-3 px-4 text-center text-sm text-slate-500">{s.food_package_name || 'None'}</td>
                          <td className="py-3 px-4 text-center text-sm" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={(e) => {
                                e.stopPropagation()
                                setSubServiceForm({
                                  name: s.name || '',
                                  price: String(s.price || '0'),
                                  restaurant: s.restaurant,
                                  food_package_id: s.food_package_id ? String(s.food_package_id) : undefined,
                                })
                                setEditingSubServiceId(Number(s.sub_service_id))
                                setShowEditSubServiceModal(true)
                              }} className="text-indigo-600 hover:underline flex items-center gap-1 text-sm"><Pencil size={12}/>Edit</button>
                              <button onClick={(e) => {
                                e.stopPropagation();
                                setPendingArchive({ type: 'sub_service', item: s, unarchive: Boolean(s.is_archived) });
                              }} className={`${s.is_archived ? 'text-emerald-500 hover:text-emerald-600' : 'text-violet-500 hover:text-violet-600'} hover:underline flex items-center gap-1 text-sm`}><Archive size={12}/>{s.is_archived ? 'Restore' : 'Archive'}</button>
                              <button onClick={(e) => {
                                e.stopPropagation();
                                setPendingDelete({ type: 'sub_service', item: s });
                              }} className="text-red-600 hover:underline flex items-center gap-1 text-sm"><Trash2 size={12}/>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
            <PaginationFooter items={filteredSubServices} page={subServicesPage} setPage={setSubServicesPage} pageSize={servicesPageSize} noun="sub-services" />
          </div>
        )}
      </div>
      ) : (
        isMobile ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b bg-indigo-600 text-white flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-sm font-semibold">Transactions</h3>
              <div className="flex items-center gap-3 flex-wrap">
                <select value={txRestaurantFilter} onChange={e => setTxRestaurantFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 font-display text-slate-600">
                  <option value="All Restaurants">All Restaurants</option>
                  {txRestaurantOptions.map(restaurant => (
                    <option key={restaurant} value={restaurant}>{restaurant}</option>
                  ))}
                </select>
              </div>
              <div className="w-full">
                <DateFilter value={txDateFilter} onChange={setTxDateFilter} allLabel="All Date" className="justify-end" />
              </div>
            </div>
            <div className="space-y-3">
              {txLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="border border-slate-200 bg-slate-50 p-3 animate-pulse">
                    <div className="h-4 w-28 mb-2 rounded bg-slate-200 " />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-5 rounded bg-slate-200" />
                      <div className="h-5 rounded bg-slate-200" />
                    </div>
                  </div>
                ))
              ) : filteredTransactions.length === 0 ? (
                <div className="p-4 text-sm text-slate-400">No transactions match the selected filters.</div>
              ) : (
                paginatedTransactions.map(tx => {
                  const assetPenalty = Number(tx.asset_penalty || 0)
                  const assetPenaltyApplied = ['Finalized', 'Fully Paid'].includes(tx.status || '') ? assetPenalty : 0
                  const totalPrice = Number(tx.price || 0) + Number(tx.penalty || 0) + assetPenaltyApplied
                  const balance = Number(tx.balance || 0)
                  const unpaidBalance = totalPrice - (Number(tx.downpayment || 0) + Number(tx.discount || 0) + balance)
                  const serviceLabel = tx.service_id ? (items.find(s => s.service_id === tx.service_id)?.service_type || `#${tx.service_id}`) : '-'
                  return (
                    <button
                      type="button"
                      key={tx.service_transaction_id}
                      className="w-full p-2 border-b border-slate-200 flex justify-between items-center text-left cursor-pointer active:bg-slate-50 transition-colors duration-150 bg-white"
                      onClick={() => setSelectedTransaction(tx)}
                    >
                      <div>
                        <div className="font-medium text-slate-800">{serviceLabel}</div>
                        <div className="text-xs text-slate-500">{tx.service_date?.slice(0, 10)} · {tx.status || 'Pending'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor[tx.status] || 'bg-slate-50 text-slate-700'}`}>
                          {tx.status || 'Pending'}
                        </span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
            <PaginationFooter items={filteredTransactions} page={transactionsPage} setPage={setTransactionsPage} pageSize={servicesPageSize} noun="transactions" />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-sm font-semibold">Service Transactions</h3>
              <div className="flex items-center gap-3 flex-wrap">
                <select value={txRestaurantFilter} onChange={e => setTxRestaurantFilter(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-400 font-display text-slate-600">
                  <option value="All Restaurants">All Restaurants</option>
                  {txRestaurantOptions.map(restaurant => (
                    <option key={restaurant} value={restaurant}>{restaurant}</option>
                  ))}
                </select>
                <DateFilter value={txDateFilter} onChange={setTxDateFilter} allLabel="All Date" className="justify-end" />
                <div className="text-xs text-slate-500">{txLoading ? 'Loading...' : `${filteredTransactions.length} transactions`}</div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="text-xs text-white bg-indigo-600 uppercase">
                  <tr>
                    <th className="py-2 px-3 text-left">Date</th>
                    <th className="py-2 px-3 text-left">Service</th>
                    <th className="py-2 px-3 text-right">Expenses</th>
                    <th className="py-2 px-3 text-right">Price</th>
                    <th className="py-2 px-3 text-right">Penalty</th>
                    <th className="py-2 px-3 text-right">Unpaid Balance</th>
                    <th className="py-2 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {txLoading ? (
                    <SkeletonTableRows
                      columns={7}
                      rows={2}
                      columnConfig={[
                        { width: "30%" },
                        { width: "55%" },
                        { width: "35%" },
                        { width: "35%" },
                        { width: "35%" },
                        { width: "40%" },
                        { width: "30%", pill: true },
                      ]}
                    />
                  ) : transactions.length === 0 ? <tr><td colSpan={7} className="p-6 text-center text-sm text-slate-400">No transactions.</td></tr> : filteredTransactions.length === 0 ? <tr><td colSpan={7} className="p-6 text-center text-sm text-slate-400">No transactions match the selected filters.</td></tr> : paginatedTransactions.map(tx => {
                      const assetPenalty = Number(tx.asset_penalty || 0)
                      const assetPenaltyApplied = ['Finalized', 'Fully Paid'].includes(tx.status || '') ? assetPenalty : 0
                      const totalPrice = Number(tx.price || 0) + Number(tx.penalty || 0) + assetPenaltyApplied
                      const balance = Number(tx.balance || 0)
                      const unpaidBalance = totalPrice - (Number(tx.downpayment || 0) + Number(tx.discount || 0) + balance)
                      return (
                        <tr key={tx.service_transaction_id} className="hover:bg-slate-50 cursor-pointer border-b border-slate-200 focus:outline-none focus-visible:bg-slate-100" onClick={() => setSelectedTransaction(tx)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedTransaction(tx) } }}>
                          <td className="py-2 px-3">{tx.service_date?.slice(0,10)}</td>
                          <td className="py-2 px-3">{tx.service_id ? (items.find(s => s.service_id === tx.service_id)?.service_type || `#${tx.service_id}`) : '-'}</td>
                          <td className="py-2 px-3 text-right font-mono">{getTxExpenses(tx).toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-mono">{Number(tx.price || 0).toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-mono text-red-500">{Number((Number(tx.penalty || 0) + assetPenaltyApplied)).toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-mono">{unpaidBalance.toFixed(2)}</td>
                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium font-display whitespace-nowrap ${statusColor[tx.status] || 'bg-slate-50 text-slate-700'}`}>
                                {tx.status || 'Pending'}
                              </span>
                              {tx.deductions_applied === true && (
                                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Stock deducted</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
            </div>
            <PaginationFooter items={filteredTransactions} page={transactionsPage} setPage={setTransactionsPage} pageSize={servicesPageSize} />
          </div>
        )
      )}

      <Modal open={showModal} title={editingId ? 'Edit Service' : 'Add Service'} onClose={closeServiceModal} className="max-h-[50vh] overflow-y-auto">
        <div className={`${isMobile ? 'max-h-[50vh]' : ''} space-y-4`}>
          <div className="space-y-3">
            <label className="block text-xs text-slate-600 mb-1">Entry type</label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="radio" name="service-entry-type" checked={serviceEntryMode === 'service'} onChange={() => setServiceEntryMode('service')} /> Service
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="radio" name="service-entry-type" checked={serviceEntryMode === 'sub_service'} onChange={() => setServiceEntryMode('sub_service')} /> Sub Service
              </label>
            </div>
          </div>

          {serviceEntryMode === 'service' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* LEFT COLUMN — form fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Type</label>
                  <div className="relative">
                    <input
                      value={form.service_type}
                      onChange={e => { setForm(prev => ({ ...prev, service_type: e.target.value })); setServiceTypeDropdownOpen(true) }}
                      onFocus={() => setServiceTypeDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setServiceTypeDropdownOpen(false), 150)}
                      className="w-full border border-slate-200 rounded-l-lg px-3 py-2 text-sm bg-white pr-9"
                      placeholder="Select or type a type (e.g. Catering 1 - Large)"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setServiceTypeDropdownOpen(open => !open)}
                      className="absolute right-0 top-0 h-full px-2 flex items-center justify-center text-slate-400 hover:text-slate-600"
                      aria-label="Toggle type options"
                    >
                      <ChevronDown size={16} />
                    </button>
                    {serviceTypeDropdownOpen && (
                      <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                        {SERVICE_TYPE_OPTIONS.filter(option => option.toLowerCase().includes(form.service_type.trim().toLowerCase())).map(option => (
                          <button
                            type="button"
                            key={option}
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => { setForm(prev => ({ ...prev, service_type: option })); setServiceTypeDropdownOpen(false) }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 ${form.service_type === option ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700'}`}
                          >
                            {option}
                          </button>
                        ))}
                        {form.service_type.trim() !== '' && !SERVICE_TYPE_OPTIONS.some(option => option.toLowerCase() === form.service_type.trim().toLowerCase()) && (
                          <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => setServiceTypeDropdownOpen(false)}
                            className="w-full text-left px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 border-t border-slate-100"
                          >
                            Use "{form.service_type.trim()}"
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {errors.service_type && <div className="text-xs text-red-600 mt-1">{errors.service_type}</div>}
                </div>

                <div>
                  <label className="block text-xs text-slate-600 mb-1">Price</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.price}
                    onChange={e => setForm(prev => ({ ...prev, price: sanitizeMoneyInput(e.target.value) }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="0.00"
                  />
                  {errors.price && <div className="text-xs text-red-600 mt-1">{errors.price}</div>}
                </div>

                <div>
                  <label className="block text-xs text-slate-600 mb-1">Restaurant</label>
                  <select value={form.restaurant} onChange={e => setForm(prev => ({ ...prev, restaurant: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value="Lakay Ago">Lakay Ago</option>
                    <option value="Aroo">Aroo</option>
                  </select>
                  {errors.restaurant && <div className="text-xs text-red-600 mt-1">{errors.restaurant}</div>}
                </div>

                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-slate-600 mb-1">Attach existing sub-service</label>
                    <select value={subServiceAttachSelect ?? ''} onChange={e => setSubServiceAttachSelect(e.target.value ? Number(e.target.value) : null)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                      <option value="">Select a sub-service</option>
                      {attachableSubServices.map((s) => {
                        const alreadySelected = attachedSubServices.some(item => Number(item.sub_service_id) === Number(s.sub_service_id))
                        return (
                          <option
                            key={s.sub_service_id}
                            value={String(s.sub_service_id)}
                            disabled={alreadySelected}
                            style={{ color: alreadySelected ? '#94a3b8' : undefined }}
                          >
                            {s.name} · {s.restaurant} · ₱{Number(s.price || 0).toFixed(2)}
                          </option>
                        )
                      })}
                    </select>
                  </div>
                  <button type="button" onClick={addAttachedSubService} disabled={subServiceAttachSelect == null || Boolean(savingAction)} className="px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
                    {savingAction ? 'Add Sub Service' : 'Add Sub Service'}
                  </button>
                </div>
                {attachedSubServices.length > 0 && (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {attachedSubServices.map(s => (
                      <div key={s.sub_service_id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="text-sm text-slate-700">
                          <span className="font-medium">{s.name}</span>
                          <span className="text-xs text-slate-500 ml-2">{s.restaurant} · ₱{Number(s.price || 0).toFixed(2)}</span>
                        </div>
                        <button type="button" onClick={() => removeAttachedSubService(Number(s.sub_service_id))} className="text-red-600 text-xs">Remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN — assets, own internal scroll */}
              <div className="flex flex-col min-h-0">
                <label className="block text-xs text-slate-600 mb-1">Assets</label>
                <div className="flex flex-col flex-1 min-h-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-medium text-slate-700">Assets</label>
                    <span className="text-[10px] uppercase tracking-wide text-slate-500">{serviceAssetRows.length} selected</span>
                  </div>

                  <div className="flex gap-2 mb-3">
                    <select value={assetSelect} onChange={(e) => setAssetSelect(e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                      <option value="">Select an asset</option>
                      {assetsOptions.map((a) => (
                        <option key={a.asset_id} value={String(a.asset_id)}>{a.name}</option>
                      ))}
                    </select>
                    <input type="number" min={1} value={assetQty} onChange={(e) => setAssetQty(e.target.value)} className="w-20 border border-slate-200 rounded-lg px-2 py-2 text-sm" placeholder="Qty" />
                    <button type="button" onClick={() => { if (!assetSelect) return; addAssetRow(assetSelect, assetQty); setAssetSelect(''); setAssetQty('1') }} disabled={Boolean(savingAction)} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">{savingAction ? 'Add' : 'Add'}</button>
                  </div>

                  {/* Scrollable list — cap height and let it scroll independently */}
                  <div className="space-y-2 overflow-y-auto max-h-80 pr-1">
                    {serviceAssetRows.length === 0 ? (
                      <div className="text-xs text-slate-400">No assets selected yet.</div>
                    ) : serviceAssetRows.map((row) => (
                      <div key={row.asset_id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <div>
                          <div className="text-sm font-medium text-slate-700">{row.asset_name}</div>
                          <div className="text-xs text-slate-500">Qty: {row.assigned_quantity}</div>
                        </div>
                        <button type="button" onClick={() => removeAssetRow(row.asset_id)} className="text-red-600 text-xs">Remove</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Sub Service Name</label>
                  <input value={subServiceForm.name} onChange={e => setSubServiceForm(prev => ({ ...prev, name: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Price</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={subServiceForm.price}
                    onChange={e => setSubServiceForm(prev => ({ ...prev, price: sanitizeMoneyInput(e.target.value) }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Restaurant</label>
                  <select value={subServiceForm.restaurant} onChange={e => setSubServiceForm(prev => ({ ...prev, restaurant: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value="Lakay Ago">Lakay Ago</option>
                    <option value="Aroo">Aroo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Food package</label>
                  <select
                    value={subServiceForm.food_package_id ?? ''}
                    onChange={(e) => {
                      const nextPackageId = e.target.value || undefined
                      const selectedPackage = packages.find((pkg: any) => String(pkg.food_package_id) === String(nextPackageId))

                      setSubServiceForm(prev => ({
                        ...prev,
                        food_package_id: nextPackageId,
                        price: nextPackageId && selectedPackage ? String(Number(selectedPackage.price || 0).toFixed(2)) : prev.price,
                      }))
                    }}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">No package</option>
                    {packages.map(pkg => (
                      <option key={pkg.food_package_id} value={String(pkg.food_package_id)}>{pkg.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button onClick={closeServiceModal} disabled={savingAction === 'service'} className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">Cancel</button>
            <button onClick={() => { setSavingAction('service'); void handleSave().finally(() => setSavingAction(null)) }} disabled={savingAction === 'service'} className="px-4 py-2  bg-indigo-600 text-white rounded-lg disabled:opacity-70 disabled:cursor-not-allowed">{savingAction === 'service' ? 'Saving...' : 'Save'}</button>
          </div>
          {isMobile && (
            <div className="text-xs pt-2 border-slate-100">
            </div>
          )}
        </div>
      </Modal>

      <Modal open={showEditSubServiceModal} title="Edit Sub Service" onClose={() => { setShowEditSubServiceModal(false); setEditingSubServiceId(null); setSubServiceForm(emptySubServiceForm) }} className="max-h-[60vh] overflow-y-auto">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Sub Service Name</label>
              <input value={subServiceForm.name} onChange={e => setSubServiceForm(prev => ({ ...prev, name: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Price</label>
              <input
                type="text"
                inputMode="decimal"
                value={subServiceForm.price}
                onChange={e => setSubServiceForm(prev => ({ ...prev, price: sanitizeMoneyInput(e.target.value) }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Restaurant</label>
              <select value={subServiceForm.restaurant} onChange={e => setSubServiceForm(prev => ({ ...prev, restaurant: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="Lakay Ago">Lakay Ago</option>
                <option value="Aroo">Aroo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Food package</label>
              <select
                value={subServiceForm.food_package_id ?? ''}
                onChange={(e) => {
                  const nextPackageId = e.target.value || undefined
                  const selectedPackage = packages.find((pkg: any) => String(pkg.food_package_id) === String(nextPackageId))

                  setSubServiceForm(prev => ({
                    ...prev,
                    food_package_id: nextPackageId,
                    price: nextPackageId && selectedPackage ? String(Number(selectedPackage.price || 0).toFixed(2)) : prev.price,
                  }))
                }}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">No package</option>
                {packages.map(pkg => (
                  <option key={pkg.food_package_id} value={String(pkg.food_package_id)}>{pkg.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button onClick={() => { setShowEditSubServiceModal(false); setEditingSubServiceId(null); setSubServiceForm(emptySubServiceForm) }} disabled={savingAction === 'subService'} className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">Cancel</button>
            <button onClick={() => { setSavingAction('subService'); void handleSaveSubService().finally(() => setSavingAction(null)) }} disabled={savingAction === 'subService'} className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-70 disabled:cursor-not-allowed">{savingAction === 'subService' ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </div>
      </Modal>

      <Modal open={showTxModal} title={editingTxId ? 'Edit Transaction' : 'Add Transaction'} onClose={() => setShowTxModal(false)}>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto p-3">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Restaurant</label>
            <select value={txForm.restaurant} onChange={e => {
              const val = e.target.value
              setTxForm(prev => ({ ...prev, restaurant: val, service_id: undefined }))
            }} className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm ${isFullyPaid ? 'bg-slate-50 text-slate-700 focus:outline-none cursor-default caret-transparent' : ''}`} disabled={isFullyPaid}>
              <option value="">Select restaurant</option>
              <option value="Lakay Ago">Lakay Ago</option>
              <option value="Aroo">Aroo</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Service</label>
            <select value={txForm.service_id ?? ''} onChange={e => {
              const val = e.target.value
              const svc = items.find(s => String(s.service_id) === val)
              setTxForm(prev => ({ ...prev, service_id: val ? Number(val) : undefined, price: svc ? String(svc.price) : prev.price }))
              if (val) {
                const serviceId = Number(val)
                if (!subServicesByService[serviceId] && !subServicesLoading[serviceId]) {
                  fetchSubServices(serviceId)
                }
              }
            }} className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm ${isFullyPaid ? 'bg-slate-50 text-slate-700 focus:outline-none cursor-default caret-transparent' : !txForm.restaurant ? 'bg-slate-200 text-slate-500' : 'bg-slate-50 text-slate-700'}`} disabled={isFullyPaid || !txForm.restaurant}>
              <option value="">Select service</option>
              {items.filter(s => !txForm.restaurant || s.restaurant === txForm.restaurant).map(s => <option key={s.service_id} value={s.service_id}>{s.service_type}</option>)}
            </select>
          </div>
          {txForm.service_id && (subServicesByService[txForm.service_id] || subServicesLoading[txForm.service_id]) && (
            <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs font-semibold text-slate-600 mb-2">Sub-services</p>
              <div className="space-y-1">
                {subServicesLoading[txForm.service_id] ? (
                  <div className="space-y-1.5">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="flex items-center justify-between gap-3 px-2 py-1">
                        <SkeletonBar width="55%" height="0.8rem" />
                        <SkeletonBar width="20%" height="0.8rem" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {(subServicesByService[txForm.service_id] || []).filter(s => !s.is_archived).map(sub => (
                      <div key={sub.sub_service_id} className="flex items-center justify-between text-xs px-2 py-1 bg-white rounded border border-slate-200">
                        <span className="text-slate-700">{sub.name}</span>
                        <span className="text-slate-500">₱{Number(sub.price || 0).toFixed(2)}</span>
                      </div>
                    ))}
                    {(subServicesByService[txForm.service_id] || []).filter(s => !s.is_archived).length === 0 && (
                      <p className="text-xs text-slate-400">No sub-services</p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs text-slate-600 mb-1">Date</label>
            <input type="date" value={txForm.service_date ?? ''} onChange={e => setTxForm(prev => ({ ...prev, service_date: e.target.value }))} className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm ${isFullyPaid ? 'bg-slate-50 text-slate-700 focus:outline-none cursor-default caret-transparent' : !txForm.restaurant ? 'bg-slate-200 text-slate-500' : 'bg-slate-50 text-slate-700'}`} disabled={isFullyPaid || !txForm.restaurant} readOnly={isFullyPaid} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Price</label>
              <input
                type="text"
                inputMode="decimal"
                value={txForm.price ?? '0'}
                onChange={e => setTxForm(prev => ({ ...prev, price: sanitizeMoneyInput(e.target.value) }))}
                className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm ${isFullyPaid ? 'bg-slate-50 text-slate-700 focus:outline-none cursor-default caret-transparent' : !txForm.restaurant ? 'bg-slate-200 text-slate-500' : 'bg-slate-50 text-slate-700'}`}
                disabled={isFullyPaid || !txForm.restaurant}
                readOnly={isFullyPaid}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Downpayment</label>
              <input
                type="text"
                inputMode="decimal"
                value={txForm.downpayment ?? '0'}
                onChange={e => {
                  const val = sanitizeMoneyInput(e.target.value)
                  let newStatus = txForm.status
                  if (!editingTxId) {
                    const dp = Number(val || '0')
                    newStatus = dp > 0 ? 'Partial Payment' : 'Under Reservation'
                  }
                  setTxForm(prev => ({ ...prev, downpayment: val, status: newStatus }))
                }}
                className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm ${isFullyPaid ? 'bg-slate-50 text-slate-700 focus:outline-none cursor-default caret-transparent' : !txForm.restaurant ? 'bg-slate-200 text-slate-500' : 'bg-slate-50 text-slate-700'}`}
                disabled={isFullyPaid || !txForm.restaurant}
                readOnly={isFullyPaid}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Discount</label>
              <input
                type="text"
                inputMode="decimal"
                value={txForm.discount ?? '0'}
                onChange={e => setTxForm(prev => ({ ...prev, discount: sanitizeMoneyInput(e.target.value) }))}
                className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm ${isFullyPaid ? 'bg-slate-50 text-slate-700 focus:outline-none cursor-default caret-transparent' : !txForm.restaurant ? 'bg-slate-200 text-slate-500' : 'bg-slate-50 text-slate-700'}`}
                disabled={isFullyPaid || !txForm.restaurant}
                readOnly={isFullyPaid}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Other Penalty</label>
              <input
                type="text"
                inputMode="decimal"
                value={txForm.penalty ?? '0'}
                onChange={e => setTxForm(prev => ({ ...prev, penalty: sanitizeMoneyInput(e.target.value) }))}
                className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm ${isFullyPaid ? 'bg-slate-50 text-slate-700 focus:outline-none cursor-default caret-transparent' : !txForm.restaurant ? 'bg-slate-200 text-slate-500' : 'bg-slate-50 text-slate-700'}`}
                disabled={isFullyPaid || !txForm.restaurant}
                readOnly={isFullyPaid || txForm.status !== 'Finalized'}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Expenses</label>
              <input value={txForm.expenses ?? '0'} readOnly className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm ${isFullyPaid ? 'bg-slate-50 text-slate-700 focus:outline-none cursor-default caret-transparent' : !txForm.restaurant ? 'bg-slate-200 text-slate-500' : 'bg-slate-50 text-slate-700'}`} />
            </div>
            {(txForm.status === 'Finalized' || txForm.status === 'Fully Paid') && (
              <div>
                <label className="block text-xs text-slate-600 mb-1">Asset Penalty</label>
                <input value={assetTotalPenalty.toFixed(2)} readOnly className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-700 focus:outline-none cursor-default caret-transparent" />
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Status</label>
            <select
              value={txForm.status ?? ''}
              onChange={e => setTxForm(prev => ({ ...prev, status: e.target.value || null }))}
              className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm ${isFullyPaid ? 'bg-slate-50 text-slate-700 focus:outline-none cursor-default caret-transparent' : !txForm.restaurant ? 'bg-slate-200 text-slate-500' : 'bg-slate-50 text-slate-700'}`}
              disabled={isFullyPaid || !editingTxId || !txForm.restaurant}
            >
              {(editingTxId && originalTxStatus === 'Finalized') ? (
                <>
                  <option value="Finalized">Finalized</option>
                  <option value="Fully Paid">Fully Paid</option>
                </>
              ) : (
                <>
                  <option value="Under Reservation">Under Reservation</option>
                  <option value="Partial Payment">Partial Payment</option>
                  <option value="Finalized">Finalized</option>
                  <option value="Fully Paid">Fully Paid</option>
                </>
              )}
            </select>
          </div>
          <div className="pt-3 border-t border-slate-200">
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="grid grid-cols-2 gap-2 text-sm">
                {(() => {
                  const assetPenaltyApplied = ['Finalized', 'Fully Paid'].includes(txForm.status || '') ? assetTotalPenalty : 0
                  const currentBalance = Number(txBalance || 0)
                  const totalPrice = Number(txForm.price || 0) + Number(txForm.penalty || 0) + assetPenaltyApplied
                  const paidAmount = Number(txForm.downpayment || 0) + Number(txForm.discount || 0) + currentBalance
                  const unpaidBalance = totalPrice - paidAmount
                  return (
                    <>
                      <div>
                        <div className="mb-2">
                          <p className="text-xs text-slate-500">Total Price</p>
                          <p className="font-semibold text-slate-800 font-mono">
                            ₱{totalPrice.toFixed(2)}
                          </p>
                        </div>
                        <div className="mb-2">
                          <p className="text-xs text-slate-500">Paid Amount</p>
                          <p className="font-semibold text-green-600 font-mono">
                            ₱{paidAmount.toFixed(2)}
                          </p>
                        </div>
                        <div className="mb-2">
                          <p className="text-xs text-slate-500">Unpaid Balance</p>
                          <p className="font-bold text-lg text-red-600 font-mono">
                            ₱{unpaidBalance.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </>
                  )
                })()}
              {editingTxId && txForm.status === 'Finalized' && (
                <div className="flex flex-col gap-2">
                  <div className="text-right w-full mb-2">
                    <input type="text" inputMode="decimal" min="0.01" step="0.01" value={addPaymentAmount} onChange={e => { if (e.target.value === '' || /^\d*\.?\d{0,2}$/.test(e.target.value)) setAddPaymentAmount(e.target.value) }} placeholder="Payment amount" className=" border border-slate-200 rounded-lg px-3 py-4 text-sm outline-none text-center" />
                  </div>
                  <div className="text-right w-full">
                    <button onClick={() => { setSavingAction('payment'); void handleAddPayment().finally(() => setSavingAction(null)) }} disabled={savingAction === 'payment' || !addPaymentAmount || Number(addPaymentAmount) <= 0} className="px-3 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">{savingAction === 'payment' ? 'Saving...' : 'Add Payment'}</button>
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button onClick={() => setShowTxModal(false)} disabled={savingAction === 'transaction' || savingAction === 'payment'} className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">Cancel</button>
            {!isFullyPaid && <button onClick={() => { setSavingAction('transaction'); void handleSaveTx().finally(() => setSavingAction(null)) }} disabled={savingAction === 'transaction'} className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-70 disabled:cursor-not-allowed">{savingAction === 'transaction' ? 'Saving...' : 'Save'}</button>}
          </div>
        </div>
      </Modal>

      <Modal open={showAssetsModal} title={`Service Assets`} onClose={resetAssetsModalState}>
        <div className="w-md space-y-3">
          {assetModalLoading ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="text-xs text-slate-500 uppercase border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="py-2 text-left">Asset</th>
                    <th className="py-2 text-left">Used</th>
                    <th className="py-2 text-left">Returned</th>
                    <th className="py-2 text-right">Penalty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  <SkeletonTableRows
                    columns={4}
                    rows={3}
                    columnConfig={[
                      { width: '30%' },
                      { width: '20%' },
                      { width: '25%' },
                      { width: '25%' },
                    ]}
                  />
                </tbody>
              </table>
            </div>
          ) : assetLines.length === 0 ? <div className="text-sm text-slate-500">No assets assigned for this service.</div> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="text-xs text-slate-500 uppercase border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="py-2 text-left">Asset</th>
                    <th className="py-2 text-left">Used</th>
                    <th className="py-2 text-left">Returned</th>
                    <th className="py-2 text-right">Penalty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {assetLines.map(line => (
                    <tr key={line.asset_id} className="hover:bg-slate-50">
                      <td className="py-2 text-sm font-medium text-slate-700">{line.asset_name}</td>
                      <td className="py-2 text-left text-sm text-slate-700">{line.assigned_quantity}</td>
                      {currentTxStatus === 'Finalized' ? (
                        <>
                          <td className="py-2 text-left">
                            <input type="number" min={0} max={line.assigned_quantity} value={String(line.quantity_returned || 0)} onChange={e => { const val = Number(e.target.value || 0); updateAssetQuantity(line.asset_id, val) }} className="w-20 border rounded px-2 py-1 text-sm text-center" />
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2 text-left">
                            <input type="number" min={0} max={line.assigned_quantity} value={String(line.quantity_returned || 0)} onChange={e => { const val = Number(e.target.value || 0); updateAssetQuantity(line.asset_id, val) }} readOnly className="w-20 border rounded px-2 py-1 text-sm text-center focus:outline-none caret-transparent cursor-default" />
                          </td>
                        </>
                      )}
                      <td className="py-2 text-right text-sm">
                        {currentTxStatus === 'Finalized' ? Number(line.penalty_amount || 0).toFixed(2) : currentTxStatus === 'Fully Paid' ? Number(line.penalty_amount || 0).toFixed(2) : Number(line.calculated_penalty || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {currentTxStatus === 'Finalized' ? (
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button onClick={resetAssetsModalState} disabled={savingAction === 'assets'} className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">Cancel</button>
              <button onClick={() => { if (currentTxId) { setSavingAction('assets'); void saveAssets(currentTxId).finally(() => setSavingAction(null)) } }} disabled={savingAction === 'assets'} className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-70 disabled:cursor-not-allowed">{savingAction === 'assets' ? 'Saving...' : 'Save'}</button>
            </div>
          ) : (
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button onClick={resetAssetsModalState} className="px-4 py-2 text-sm border rounded-lg">Close</button>
            </div>
          )}
        </div>
      </Modal>

      {selectedSubService && (
        <Modal open={!!selectedSubService} title={selectedSubService.name || 'Sub Service'} onClose={() => setSelectedSubService(null)}>
          <div className="space-y-3 w-full p-2">
            <div className="w-full grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-400">Name</p>
                <p className="text-sm font-medium">{selectedSubService.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Price</p>
                <p className="text-sm font-medium">₱{Number(selectedSubService.price || 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Restaurant</p>
                <p className="text-sm font-medium">{selectedSubService.restaurant || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Food Package</p>
                <p className="text-sm font-medium">{selectedSubService.food_package_name || 'None'}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => { setSelectedSubService(null); setPendingDelete({ type: 'sub_service', item: selectedSubService }) }} className={`${isMobile ? 'text-xs' : 'text-sm'} px-4 py-2 font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2`}><Trash2 size={isMobile ? 10 : 16}/>Delete</button>
              <button type="button" onClick={() => { setSelectedSubService(null); setPendingArchive({ type: 'sub_service', item: selectedSubService, unarchive: Boolean(selectedSubService.is_archived) }) }} className={`${isMobile ? 'text-xs' : 'text-sm'} px-4 py-2 font-medium text-white border border-slate-200 rounded-lg ${selectedSubService.is_archived ? 'bg-green-600 hover:bg-green-700' : 'bg-violet-600 hover:bg-violet-700'} flex items-center gap-2`}><Archive size={isMobile ? 10 : 16}/>{selectedSubService.is_archived ? 'Restore' : 'Archive'}</button>
              <button type="button" onClick={() => { setSelectedSubService(null); setEditingSubServiceId(Number(selectedSubService.sub_service_id)); setSubServiceForm({ name: selectedSubService.name || '', price: String(selectedSubService.price || '0'), restaurant: selectedSubService.restaurant || 'Lakay Ago', food_package_id: selectedSubService.food_package_id ? String(selectedSubService.food_package_id) : undefined }); setShowEditSubServiceModal(true) }} className={`${isMobile ? 'text-xs' : 'text-sm'} px-4 py-2 font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex justify-center items-center gap-2`}><Pencil size={isMobile ? 10 : 16}/>Edit</button>
            </div>
          </div>
        </Modal>
      )}

      {selectedService && (
        <Modal open={!!selectedService} title={selectedService.service_type || 'Service'} onClose={() => { setSelectedService(null); setShowServiceAssetsModal(false) }}>
          <div className="space-y-3 w-full p-2">
            <div className="w-md grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-400">Service Type</p>
                <p className="text-sm font-medium">{selectedService.service_type}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Price</p>
                <p className="text-sm font-medium">₱{Number(selectedService.price || 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Restaurant</p>
                <p className="text-sm font-medium">{selectedService.restaurant || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Assets</p>
                <button type="button" onClick={() => { setServiceAssetsTarget(selectedService); setShowServiceAssetsModal(true) }} className="text-sm font-medium text-slate-700 hover:underline flex items-center gap-2"><Package size={14}/>Assets List</button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => { setSelectedService(null); setPendingDelete({ type: 'service', item: selectedService }) }} className={`${isMobile ? 'text-xs' : 'text-sm'} px-4 py-2 font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg flex justify-center items-center gap-2`}><Trash2 size={isMobile ? 10 : 16}/>Delete</button>
              <button type="button" onClick={() => { setSelectedService(null); setPendingArchive({ type: 'service', item: selectedService, unarchive: Boolean(selectedService.is_archived) }) }} className={`${isMobile ? 'text-xs' : 'text-sm'} px-4 py-2 font-medium text-white border border-slate-200 rounded-lg bg-violet-600 hover:bg-violet-700 flex justify-center items-center gap-2`}><Archive size={isMobile ? 10 : 16}/>{selectedService.is_archived ? 'Restore' : 'Archive'}</button>
              <button type="button" onClick={() => { setSelectedService(null); openEditService(selectedService) }} className={`${isMobile ? 'text-xs' : 'text-sm'} px-4 py-2  font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex justify-center items-center gap-2`}><Pencil size={isMobile ? 10 : 16}/>Edit</button>
            </div>
          </div>
        </Modal>
      )}

      {serviceAssetsTarget && showServiceAssetsModal && (
        <Modal open={showServiceAssetsModal} title={`${serviceAssetsTarget.service_type || 'Service'} Assets`} onClose={() => setShowServiceAssetsModal(false)} className={`${isMobile ? 'w-full' : 'w-md'}`}>
          <div className="space-y-3 w-full p-2">
            {(serviceAssetsTarget.assets || []).length === 0 ? (
              <div className="text-sm text-slate-500">No assets assigned for this service.</div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {serviceAssetsTarget.assets.map((asset: any) => (
                  <div key={asset.asset_id ?? `${asset.name}-${asset.asset_name}`} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-slate-700">{asset.name || asset.asset_name}</div>
                      <div className="text-xs text-slate-500">Quantity used: {asset.quantity ?? asset.assigned_quantity ?? 1}</div>
                    </div>
                    <span className="text-xs text-slate-500">Asset</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setShowServiceAssetsModal(false)} className="px-4 py-2 text-sm border rounded-lg">Close</button>
            </div>
          </div>
        </Modal>
      )}

      {selectedTransaction && (() => {
        const tx = selectedTransaction
        const canDeleteTransaction = ['Under Reservation', 'Partial Payment'].includes(tx.status || '')
        const txAssetPenaltyApplied = ['Finalized', 'Fully Paid'].includes(tx.status || '') ? Number(tx.asset_penalty || 0) : 0
        const txTotalPrice = Number(tx.price || 0) + Number(tx.penalty || 0) + txAssetPenaltyApplied
        const txUnpaidBalance = txTotalPrice - (Number(tx.downpayment || 0) + Number(tx.discount || 0) + Number(tx.balance || 0))
        return (
          <Modal open={!!selectedTransaction} title={items.find(s => s.service_id === tx.service_id)?.service_type || `Transaction #${tx.service_transaction_id}`} onClose={() => setSelectedTransaction(null)}>
            <div className="space-y-3 w-full p-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-400">Date</p>
                  <p className="text-sm font-medium">{tx.service_date?.slice(0, 10) || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Status</p>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium font-display ${statusColor[tx.status] || 'bg-slate-50 text-slate-700'}`}>{tx.status || 'Pending'}</span>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Restaurant</p>
                  <p className="text-sm font-medium">{tx.restaurant || tx.service?.restaurant || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Service</p>
                  <p className="text-sm font-medium">{tx.service_id ? (items.find(s => s.service_id === tx.service_id)?.service_type || `#${tx.service_id}`) : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Price</p>
                  <p className="text-sm font-medium">₱{Number(tx.price || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Expenses</p>
                  <p className="text-sm font-medium">₱{getTxExpenses(tx).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Penalty</p>
                  <p className="text-sm font-medium">₱{Number(Number(tx.penalty || 0) + txAssetPenaltyApplied).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Unpaid Balance</p>
                  <p className="text-sm font-medium">₱{txUnpaidBalance.toFixed(2)}</p>
                </div>
                <div>
                  <button type="button" onClick={() => { setSelectedTransaction(null); void openExpenseModal(tx) }} className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 font-display flex items-center gap-2">
                    <Wallet size={14}/>Expenses
                  </button>
                </div>
                <div>
                  <button type="button" onClick={() => { setSelectedTransaction(null); openAssetsModal(tx) }} className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 font-display flex items-center gap-2">
                    <Package size={14}/>Assets
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                {canDeleteTransaction && (
                  <button type="button" onClick={() => { setSelectedTransaction(null); setPendingDelete({ type: 'transaction', item: tx }) }} className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg font-display flex justify-center items-center gap-2"><Trash2 size={14}/>Delete</button>
                )}
                {tx.status === 'Finalized' && (
                  <div className="px-4 py-2 text-sm font-medium text-green-600">
                  </div>
                )}
                {tx.status != 'Fully Paid' && (
                  <button type="button" onClick={() => { setSelectedTransaction(null); openEditTx(tx) }} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex justify-center items-center gap-2"><Pencil size={14} /> Edit</button>
                )}
              </div>
            </div>
          </Modal>
        )
      })()}

      <Modal open={expenseModalTxId !== null} title="Transaction Expenses" onClose={resetExpenseModalState}>
        <div className="w-full max-w-md space-y-4">
          {expenseModalLoading ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 items-end">
                <div className="col-span-2">
                  <SkeletonBar width="35%" height="0.75rem" className="mb-1" />
                  <SkeletonBar width="100%" height="2.25rem" />
                </div>
                <div>
                  <SkeletonBar width="35%" height="0.75rem" className="mb-1" />
                  <SkeletonBar width="100%" height="2.25rem" />
                </div>
                <SkeletonBar width="100%" height="2.25rem" />
              </div>
              <div className="space-y-2">
                {[0, 1, 2].map((idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 gap-3">
                    <div className="flex-1 space-y-1.5">
                      <SkeletonBar width="45%" height="0.8rem" />
                      <SkeletonBar width="30%" height="0.7rem" />
                    </div>
                    <SkeletonBar width="20%" height="1.6rem" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {!expenseModalReadOnly && (
              <div className="grid grid-cols-2 gap-2 items-end">
                <div className="col-span-2">
                  <label className="block text-xs text-slate-600 mb-1">Expense name</label>
                  <input value={expenseNameInput} onChange={(e) => setExpenseNameInput(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Flowers, Transportation" />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Amount</label>
                  <input value={expenseAmountInput} onChange={(e) => setExpenseAmountInput(e.target.value)} type="number" min="0" step="0.01" className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm" placeholder="0.00" />
                </div>
                <button type="button" onClick={addExpenseRow} disabled={Boolean(savingAction)} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">{savingAction ? 'Saving...' : 'Add Expense'}</button>
              </div>
              )}

              {expenseRows.filter((row) => !row._deleted).length === 0 ? (
                <div className="text-sm text-slate-400">No expenses yet.</div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {expenseRows.map((row, index) => row._deleted ? null : (
                    <div key={`${row.service_transaction_expense_id ?? 'new'}-${index}`} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <div>
                        <div className="text-sm font-medium text-slate-700">{row.name}</div>
                        <div className="text-xs text-slate-500">₱{Number(row.amount || 0).toFixed(2)}</div>
                      </div>
                      {!expenseModalReadOnly && (
                        <button type="button" onClick={() => removeExpenseRow(row)} className="text-red-600 text-xs">Remove</button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-sm font-medium text-slate-600">Total</span>
                <span className="text-sm font-mono text-slate-800">₱{expenseTotal.toFixed(2)}</span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={resetExpenseModalState} disabled={savingAction === 'expenses'} className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">Close</button>
                {!expenseModalReadOnly && (
                  <button type="button" onClick={() => {
                    if (expenseModalTxId) {
                      setSavingAction('expenses')
                      void saveExpenseRows(expenseModalTxId).catch((error) => {
                        showToast({ type: 'error', message: error instanceof Error ? error.message : 'Failed to save expenses' })
                      }).finally(() => setSavingAction(null))
                    }
                  }} disabled={savingAction === 'expenses'} className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-70 disabled:cursor-not-allowed">{savingAction === 'expenses' ? 'Saving...' : 'Save'}</button>
                )}
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal open={!!pendingArchive} title={pendingArchive?.unarchive ? 'Confirm Unarchive' : 'Confirm Archive'} onClose={() => setPendingArchive(null)}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {pendingArchive ? (pendingArchive.unarchive
              ? (pendingArchive.type === 'service'
                ? `Restore service "${pendingArchive.item?.service_type || 'this service'}" from archive?`
                : `Restore sub-service "${pendingArchive.item?.name || 'this sub-service'}" from archive?`)
              : (pendingArchive.type === 'service'
                ? `Archive service "${pendingArchive.item?.service_type || 'this service'}"?`
                : `Archive sub-service "${pendingArchive.item?.name || 'this sub-service'}"?`))
              : null}
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setPendingArchive(null)} disabled={Boolean(confirmingAction)} className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">Cancel</button>
            <button type="button" onClick={confirmPendingArchive} disabled={Boolean(confirmingAction)} className={`px-4 py-2 text-sm font-medium text-white rounded-lg flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${pendingArchive?.unarchive ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-violet-600 hover:bg-violet-700'}`}>
              <Archive size={14}/>{confirmingAction === 'unarchive_service' || confirmingAction === 'unarchive_sub_service' ? 'Restoring...' : confirmingAction === 'archive_service' || confirmingAction === 'archive_sub_service' ? 'Archiving...' : pendingArchive?.unarchive ? 'Restore' : 'Archive'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!pendingDelete} title="Confirm Delete" onClose={() => setPendingDelete(null)}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {pendingDelete?.type === 'service' && `Delete service "${pendingDelete.item?.service_type || 'this service'}"?`}
            {pendingDelete?.type === 'sub_service' && `Delete sub-service "${pendingDelete.item?.name || 'this sub-service'}"?`}
            {pendingDelete?.type === 'transaction' && `Delete transaction "${pendingDelete.item?.service_id ? `#${pendingDelete.item.service_transaction_id}` : `#${pendingDelete.item?.service_transaction_id}`}"?`}
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setPendingDelete(null)} disabled={Boolean(confirmingAction)} className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">Cancel</button>
            <button type="button" onClick={confirmPendingDelete} disabled={Boolean(confirmingAction)} className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"><Trash2 size={14}/>{confirmingAction === 'delete_service' || confirmingAction === 'delete_sub_service' || confirmingAction === 'delete_transaction' ? 'Deleting...' : 'Delete'}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
