'use client'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Search, Plus, Pencil, Eye } from 'lucide-react'
import Modal from '../components/Modal'
import useIsMobile from '../hooks/isMobile'
import { useApp } from '../App'
import PaginationFooter from '../components/PaginationFooter'

interface ServiceForm { service_type: string; price: string; restaurant: string }
const emptyForm: ServiceForm = { service_type: 'Catering', price: '0.00', restaurant: 'Lakay Ago' }

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
  expenses: string
  penalty: string
  status: string | null
}

const emptyTxForm: TxForm = { restaurant: '', service_id: undefined, service_date: '', price: '0', downpayment: '0', discount: '0', expenses: '0', penalty: '0', status: 'Under Reservation' }

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

export default function Services() {
  const isMobile = useIsMobile()
  const { showToast } = useApp()
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
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

  const [expandedServiceIds, setExpandedServiceIds] = useState<number[]>([])
  const [subServicesByService, setSubServicesByService] = useState<Record<number, any[]>>({})
  const [subServicesLoading, setSubServicesLoading] = useState<Record<number, boolean>>({})
  const [subServicesTableLoading, setSubServicesTableLoading] = useState(true)
  const [showSubServiceModal, setShowSubServiceModal] = useState(false)
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
  const [showAssetsModal, setShowAssetsModal] = useState(false)
  const [assetLines, setAssetLines] = useState<any[]>([])
  const [assetTotalPenalty, setAssetTotalPenalty] = useState(0)
  const [currentTxId, setCurrentTxId] = useState<number | null>(null)
  const [currentTxStatus, setCurrentTxStatus] = useState<string>('')
  const [addPaymentAmount, setAddPaymentAmount] = useState('')
  const [txBalance, setTxBalance] = useState(0)
  const [originalTxStatus, setOriginalTxStatus] = useState<string>('')
  const [servicesPage, setServicesPage] = useState(1)
  const [subServicesPage, setSubServicesPage] = useState(1)
  const [transactionsPage, setTransactionsPage] = useState(1)
  const isFullyPaid = originalTxStatus === 'Fully Paid'

  const filtered = useMemo(() => items.filter(i => i.service_type.toLowerCase().includes(search.toLowerCase())), [items, search])
  const servicesPageSize = 10
  const paginatedServices = useMemo(
    () => filtered.slice((servicesPage - 1) * servicesPageSize, servicesPage * servicesPageSize),
    [filtered, servicesPage],
  )
  const servicesEmptyCount = paginatedServices.length === 0 ? 0 : Math.max(0, servicesPageSize - paginatedServices.length)
  const servicePageTotal = Math.max(1, Math.ceil(filtered.length / servicesPageSize))

  const filteredSubServices = useMemo(
    () => allSubServices.filter(s => s.name.toLowerCase().includes(subServiceSearch.toLowerCase()) || s.restaurant.toLowerCase().includes(subServiceSearch.toLowerCase())),
    [allSubServices, subServiceSearch],
  )
  const paginatedSubServices = useMemo(
    () => filteredSubServices.slice((subServicesPage - 1) * servicesPageSize, subServicesPage * servicesPageSize),
    [filteredSubServices, subServicesPage],
  )
  const subServicesEmptyCount = paginatedSubServices.length === 0 ? 0 : Math.max(0, servicesPageSize - paginatedSubServices.length)
  const subServicePageTotal = Math.max(1, Math.ceil(filteredSubServices.length / servicesPageSize))

  const paginatedTransactions = useMemo(
    () => transactions.slice((transactionsPage - 1) * servicesPageSize, transactionsPage * servicesPageSize),
    [transactions, transactionsPage],
  )
  const transactionsEmptyCount = paginatedTransactions.length === 0 ? 0 : Math.max(0, servicesPageSize - paginatedTransactions.length)
  const transactionPageTotal = Math.max(1, Math.ceil(transactions.length / servicesPageSize))

  useEffect(() => { setServicesPage(1) }, [search, items.length])
  useEffect(() => { setSubServicesPage(1) }, [subServiceSearch, allSubServices.length])
  useEffect(() => { setTransactionsPage(1) }, [transactions.length])
  const openCreate = () => {
    setForm(emptyForm)
    setErrors({})
    setServiceAssetRows([])
    setServiceEntryMode('service')
    setSubServiceForm(emptySubServiceForm)
    setSubServiceAttachSelect(null)
    setAttachedSubServices([])
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

    setAllSubServices(prev => prev.filter(s => Number(s.sub_service_id) !== Number(subServiceId)))
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

  const restoreSubService = async (subServiceId: number, serviceId: number) => {
    const res = await fetch(`/api/sub-services/${subServiceId}/restore`, { method: 'PATCH' })
    if (!res.ok) {
      showToast({ type: 'error', message: 'Failed to restore sub-service' })
      return
    }

    const json = await res.json().catch(() => ({ subService: null }))
    setSubServicesByService((prev) => ({
      ...prev,
      [serviceId]: (prev[serviceId] || []).map((item) => item.sub_service_id === subServiceId ? { ...item, ...json.subService } : item),
    }))
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
    if (s.restaurant === 'Both') return true
    return s.restaurant === form.restaurant
  })

  const addAttachedSubService = () => {
    if (subServiceAttachSelect == null) return
    const sub = attachableSubServices.find(s => Number(s.sub_service_id) === subServiceAttachSelect)
    if (!sub) return
    if (attachedSubServices.some(s => Number(s.sub_service_id) === Number(sub.sub_service_id))) return
    setAttachedSubServices(prev => [...prev, sub])
    setSubServiceAttachSelect(null)
  }

  const removeAttachedSubService = (subServiceId: number) => {
    setAttachedSubServices(prev => prev.filter(s => Number(s.sub_service_id) !== subServiceId))
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
    fetch('/api/sub-services?includeArchived=false')
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

  const handleSave = async () => {
    if (serviceEntryMode === 'sub_service') {
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

      const res = await fetch('/api/sub-services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        showToast({ type: 'error', message: err.error || 'Failed to create sub-service.' })
        return
      }

      const json = await res.json().catch(() => ({ subService: null }))
      const saved = json.subService
      if (saved && editingId) {
        setSubServicesByService((prev) => ({
          ...prev,
          [editingId]: [saved, ...(prev[editingId] || [])],
        }))
      }
      showToast({ type: 'success', message: 'Sub-service added' })
      setShowModal(false)
      setServiceEntryMode('service')
      setSubServiceForm(emptySubServiceForm)
      return
    }

    const next = getErrors(form)
    if (Object.keys(next).length) { setErrors(next); return }
    const payload = { service_type: form.service_type, price: Number(form.price), restaurant: form.restaurant, assets: serviceAssetRows.map(r => ({ asset_id: Number(r.asset_id), quantity: Number(r.assigned_quantity || 0) })) }
    setLoading(true)
    if (editingId) {
      fetch('/api/services', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ service_id: editingId, ...payload }) })
        .then(async r => {
          setLoading(false)
          if (!r.ok) throw new Error('Update failed')
          const j = await r.json()
          const updated = j.service
          await attachSelectedSubServices(updated.service_id)
          await refetchServices()
          showToast({ type: 'success', message: 'Service updated', description: updated.service_type })
          setShowModal(false)
          setEditingId(null)
        })
        .catch(() => { setLoading(false); showToast({ type: 'error', message: 'Failed to update service' }) })
    } else {
      fetch('/api/services', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then(async r => {
          setLoading(false)
          if (!r.ok) throw new Error('Create failed')
          const j = await r.json()
          const created = j.service
          await attachSelectedSubServices(created.service_id)
          await refetchServices()
          showToast({ type: 'success', message: 'Service saved', description: created.service_type })
          setShowModal(false)
        })
        .catch(() => { setLoading(false); showToast({ type: 'error', message: 'Failed to save service' }) })
    }
  }

  const refetchServices = async () => {
    const res = await fetch('/api/services')
    if (res.ok) {
      const j = await res.json().catch(() => ({ services: [] }))
      setItems(j.services || [])
    }
  }

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
    return () => { mounted = false }
  }, [activeTab])

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
    const assetPenalty = Number(tx.asset_penalty ?? await fetchTransactionAssetPenalty(txId) ?? 0)
    const liveBalance = Number(tx.balance ?? 0)

    setEditingTxId(txId)
    setTxBalance(liveBalance)
    setTxForm({
      restaurant: tx.service?.restaurant || tx.restaurant || '',
      service_id: tx.service_id,
      service_date: tx.service_date?.slice(0,10) ?? '',
      price: String(tx.price),
      downpayment: String(tx.downpayment || '0'),
      discount: String(tx.discount || '0'),
      expenses: String(tx.expenses || '0'),
      penalty: String(Number(tx.penalty || 0)),
      status: tx.status,
    })
    setOriginalTxStatus(tx.status || '') // the status as-saved in DB
    setAssetTotalPenalty(assetPenalty)
    setShowTxModal(true)
  }

  const openAssetsModal = async (tx: any) => {
    setShowAssetsModal(true)
    setCurrentTxId(tx.service_transaction_id)
    setCurrentTxStatus(tx.status || '')
    const res = await fetch(`/api/service_transaction_assets/${tx.service_transaction_id}`)
    if (!res.ok) { setAssetLines([]); setAssetTotalPenalty(0); return }
    const j = await res.json().catch(() => ({}))
    setAssetLines(j.lines || [])
    setAssetTotalPenalty(Number(j.totalPenalty || 0))
  }

  const saveAssets = async (txId: number) => {
    const updates = assetLines.map(l => ({ asset_id: l.asset_id, quantity_returned: Number(l.quantity_returned || 0) }))
    const res = await fetch(`/api/service_transaction_assets/${txId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates }) })
    if (res.ok) {
      setTransactions(prev => prev.map(t => t.service_transaction_id === txId ? { ...t, asset_penalty: assetTotalPenalty } : t))
      setShowAssetsModal(false)
      showToast({ type: 'success', message: 'Assets updated' })
    } else {
      const err = await res.json().catch(() => ({}))
      showToast({ type: 'error', message: err.error || 'This asset is not assigned to this service' })
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
      expenses: Number(txForm.expenses || 0),
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
      showToast({ type: 'error', message: 'Failed to save transaction' })
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
          <p className="text-sm text-slate-500">Manage special services and associated packages/assets.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-slate-50 rounded-md p-1 flex">
            <button onClick={() => setActiveTab('services')} className={`px-3 py-1 text-sm rounded ${activeTab === 'services' ? 'bg-white shadow' : 'text-slate-600'}`}>Services</button>
            <button onClick={() => setActiveTab('transactions')} className={`px-3 py-1 text-sm rounded ${activeTab === 'transactions' ? 'bg-white shadow' : 'text-slate-600'}`}>Transactions</button>
          </div>
          {activeTab === 'services' ? (
            <button onClick={openCreate} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm"><Plus size={14}/> Add Service</button>
          ) : (
            <button onClick={openCreateTx} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm"><Plus size={14}/> Add Transaction</button>
          )}
        </div>
      </div> 

      {activeTab === 'services' ? (
        <div className="space-y-4">
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Services</h3>
            <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 focus-within:border-indigo-400">
              <Search size={14} className="text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search services..." className="w-full outline-none text-sm" />
            </div>
          </div>
          {!isMobile ? (
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <colgroup>
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '30%' }} />
                </colgroup>
                <thead className="text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="py-3 px-4 text-left">Type</th>
                    <th className="py-3 px-4 text-center">Price</th>
                    <th className="py-3 px-4 text-center">Restaurant</th>
                    <th className="py-3 px-4 text-left">Assets</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
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
                        <tr className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-medium">{i.service_type}</td>
                          <td className="py-3 px-4 text-center font-mono">{i.price}</td>
                          <td className="py-3 px-4 text-center text-sm text-slate-600">{i.restaurant}</td>
                          <td className="py-3 px-4 text-sm text-slate-600">
                            {(i.assets || []).length > 0 ? i.assets.map((a: any) => a.name).join(', ') : 'None'}
                          </td>
                          <td className="py-3 px-4 text-center text-sm">
                            <div className="flex items-center justify-center gap-2 flex-wrap">
                              <button onClick={() => toggleServiceExpansion(i)} className="text-indigo-600 hover:underline text-xs">{expanded ? 'Collapse' : 'Expand'}</button>
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
                                  .then(j => setAttachedSubServices(j.subServices || []))
                                  .catch(() => {})
                              }} className="text-slate-700 hover:underline flex items-center gap-2 text-sm"><Pencil size={14}/>Edit</button>
                              <button onClick={(e) => { e.stopPropagation(); fetch(`/api/services?id=${i.service_id}`, { method: 'DELETE' }).then(r => { if (r.ok) setItems(prev => prev.filter(x => x.service_id !== i.service_id)) }) }} className="text-red-600 hover:underline flex items-center gap-2 text-sm">Archive</button>
                            </div>
                          </td>
                        </tr>
                        {expanded && (
                          <tr>
                            <td colSpan={6} className="bg-slate-50 px-4 py-3">
                              <div className="rounded-lg border border-slate-200 bg-white p-3">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sub-services</div>
                                  <button onClick={() => openSubServiceModal(i)} className="text-xs text-indigo-600 hover:underline">Add sub-service</button>
                                </div>
                                {subServicesLoading[i.service_id] ? (
                                  <div className="text-sm text-slate-500">Loading sub-services...</div>
                                ) : (
                                  <div className="space-y-3">
                                    <div>
                                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Active</div>
                                      {activeSubServices.length === 0 ? <div className="text-sm text-slate-400">No active sub-services.</div> : (
                                        <div className="space-y-2">
                                          {activeSubServices.map((sub) => (
                                            <div key={sub.sub_service_id} className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2">
                                              <div>
                                                <div className="text-sm font-medium text-slate-700">{sub.name}</div>
                                                <div className="text-xs text-slate-500">{sub.restaurant} · ₱{Number(sub.price || 0).toFixed(2)}</div>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <button onClick={() => detachSubService(i.service_id, sub.sub_service_id)} className="text-red-600 hover:underline text-xs">Detach</button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    {archivedSubServices.length > 0 && (
                                      <div>
                                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Archived</div>
                                        <div className="space-y-2">
                                          {archivedSubServices.map((sub) => (
                                            <div key={sub.sub_service_id} className="flex items-center justify-between rounded border border-slate-200 bg-slate-100 px-3 py-2 opacity-80">
                                              <div>
                                                <div className="text-sm font-medium text-slate-600">{sub.name}</div>
                                                <div className="text-xs text-slate-500">Archived</div>
                                              </div>
                                              <button onClick={() => restoreSubService(sub.sub_service_id, i.service_id)} className="text-emerald-600 hover:underline text-xs">Restore</button>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })
                }
                {servicesEmptyCount > 0 && (
                  Array.from({ length: servicesEmptyCount }).map((_, ei) => (
                    <tr key={`empty-${ei}`} className="invisible">
                      <td className="py-3 px-4 font-medium">Placeholder</td>
                      <td className="py-3 px-4 text-center font-mono">0.00</td>
                      <td className="py-3 px-4 text-center text-sm text-slate-600">Restaurant</td>
                      <td className="py-3 px-4 text-sm text-slate-600">None</td>
                      <td className="py-3 px-4 text-center text-sm"><div className="invisible">Actions</div></td>
                    </tr>
                  ))
                )}
                </tbody>
               </table>
             </div>
          ) : (
            <div>{filtered.length === 0 ? <div className="p-4 text-sm text-slate-400">No services.</div> : filtered.map(i => (
              <div key={i.service_id} className="p-3 border-b flex justify-between items-center">
                <div>
                  <div className="font-medium">{i.service_type}</div>
                  <div className="text-xs text-slate-500">{i.restaurant}</div>
                </div>
                <div className="font-mono">{i.price}</div>
              </div>
            ))}</div>
          )}
          <PaginationFooter items={filtered} page={servicesPage} setPage={setServicesPage} pageSize={servicesPageSize} />
        </div>

        {/* Separate Sub Services Table */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Sub Services</h3>
              <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5 max-w-xs">
                <Search size={13} className="text-slate-400 shrink-0" />
                <input value={subServiceSearch} onChange={e => setSubServiceSearch(e.target.value)} placeholder="Search sub-services..." className="bg-transparent text-sm outline-none text-slate-700 w-full" />
              </div>
            </div>
          </div>
          {!isMobile ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <colgroup>
                  <col style={{ width: '25%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '25%' }} />
                </colgroup>
                <thead className="text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="py-3 px-4 text-left">Name</th>
                    <th className="py-3 px-4 text-center font-mono">Price</th>
                    <th className="py-3 px-4 text-center">Restaurant</th>
                    <th className="py-3 px-4 text-center">Food Package</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
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
                        <tr key={s.sub_service_id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 text-left">
                            <div className="text-sm font-medium">{s.name}</div>
                            <div className="text-xs text-slate-500">{s.food_package_name ? `(${s.food_package_name})` : ''}</div>
                          </td>
                          <td className="py-3 px-4 text-center font-mono">₱{Number(s.price || 0).toFixed(2)}</td>
                          <td className="py-3 px-4 text-center text-sm text-slate-600">{s.restaurant}</td>
                          <td className="py-3 px-4 text-center text-sm text-slate-500">{s.food_package_name || 'None'}</td>
                          <td className="py-3 px-4 text-center text-sm">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => archiveSubService(Number(s.sub_service_id))} className="text-red-600 hover:underline text-xs">Archive</button>
                              <button onClick={() => {
                                setSubServiceForm({
                                  name: s.name || '',
                                  price: String(s.price || '0'),
                                  restaurant: s.restaurant,
                                  food_package_id: s.food_package_id ? String(s.food_package_id) : undefined,
                                })
                                setEditingSubServiceId(Number(s.sub_service_id))
                                setShowModal(true)
                                setServiceEntryMode('sub_service')
                              }} className="text-indigo-600 hover:underline text-xs">Edit</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {subServicesEmptyCount > 0 && (
                        Array.from({ length: subServicesEmptyCount }).map((_, ei) => (
                          <tr key={`empty-sub-${ei}`} className="invisible">
                            <td className="py-3 px-4 text-left"><div className="text-sm font-medium">Placeholder</div></td>
                            <td className="py-3 px-4 text-center font-mono">0.00</td>
                            <td className="py-3 px-4 text-center text-sm text-slate-600">Restaurant</td>
                            <td className="py-3 px-4 text-center text-sm text-slate-500">None</td>
                            <td className="py-3 px-4 text-center text-sm"><div className="invisible">Actions</div></td>
                          </tr>
                        ))
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col">
              {subServicesTableLoading ? (
                <div className="p-4">
                  <SkeletonTableRows
                    columns={3}
                    rows={2}
                    columnConfig={[
                      { width: "60%" },
                      { width: "30%" },
                      { width: "30%" },
                    ]}
                  />
                </div>
              ) : allSubServices.filter(s => s.name.toLowerCase().includes(subServiceSearch.toLowerCase()) || s.restaurant.toLowerCase().includes(subServiceSearch.toLowerCase())).length === 0 ? (
                <div className="p-4 text-sm text-slate-500">No sub-services.</div>
              ) : (
                allSubServices
                  .filter(s => s.name.toLowerCase().includes(subServiceSearch.toLowerCase()) || s.restaurant.toLowerCase().includes(subServiceSearch.toLowerCase()))
                  .map(s => (
                    <div key={s.sub_service_id} className="p-3 border-b flex justify-between items-center">
                      <div>
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-slate-500">{s.restaurant} · ₱{Number(s.price || 0).toFixed(2)}</div>
                      </div>
                      <button onClick={() => archiveSubService(Number(s.sub_service_id))} className="text-red-600 text-xs">Archive</button>
                    </div>
                  ))
              )}
            </div>
          )}
          <PaginationFooter items={filteredSubServices} page={subServicesPage} setPage={setSubServicesPage} pageSize={servicesPageSize} />
        </div>
      </div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Service Transactions</h3>
            <div className="text-xs text-slate-500">{txLoading ? 'Loading...' : `${transactions.length} transactions`}</div>
          </div>
          <div className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="py-2 px-3 text-left">Date</th>
                    <th className="py-2 px-3 text-left">Service</th>
                    <th className="py-2 px-3 text-right">Expenses</th>                      
                    <th className="py-2 px-3 text-right">Price</th>
                    <th className="py-2 px-3 text-right">Penalty</th>
                    <th className="py-2 px-3 text-right">Unpaid Balance</th>
                    <th className="py-2 px-3 text-center">Status</th>
                    <th className="py-2 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {txLoading ? (
                    <SkeletonTableRows
                      columns={8}
                      rows={2}
                      columnConfig={[
                        { width: "30%" },
                        { width: "55%" },
                        { width: "35%" },
                        { width: "35%" },
                        { width: "35%" },
                        { width: "40%" },
                        { width: "30%", pill: true },
                        { width: "45%" },
                      ]}
                    />
                  ) : transactions.length === 0 ? <tr><td colSpan={8} className="p-6 text-center text-sm text-slate-400">No transactions.</td></tr> : paginatedTransactions.map(tx => {
                      const assetPenalty = Number(tx.asset_penalty || 0)
                      const assetPenaltyApplied = ['Finalized', 'Fully Paid'].includes(tx.status || '') ? assetPenalty : 0
                      const totalPrice = Number(tx.price || 0) + Number(tx.penalty || 0) + assetPenaltyApplied
                      const balance = Number(tx.balance || 0)
                      const unpaidBalance = totalPrice - (Number(tx.downpayment || 0) + Number(tx.discount || 0) + balance)
                      return (
                        <tr key={tx.service_transaction_id} className="hover:bg-slate-50">
                          <td className="py-2 px-3">{tx.service_date?.slice(0,10)}</td>
                          <td className="py-2 px-3">{tx.service_id ? (items.find(s => s.service_id === tx.service_id)?.service_type || `#${tx.service_id}`) : '-'}</td>
                          <td className="py-2 px-3 text-right font-mono">{Number(tx.expenses || 0).toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-mono">{Number(tx.price || 0).toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-mono">{Number((Number(tx.penalty || 0) + assetPenaltyApplied)).toFixed(2)}</td>
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
                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {tx.status === 'Fully Paid' ? (
                                <button onClick={() => openEditTx(tx)} className="text-indigo-600 hover:underline flex items-center gap-2 text-sm"><Eye size={14} />View</button>
                              ) : (
                                <button onClick={() => openEditTx(tx)} className="text-slate-700 hover:underline flex items-center gap-2 text-sm"><Pencil size={14}/>Edit</button>
                              )}
                              <button onClick={() => openAssetsModal(tx)} className="text-indigo-600 hover:underline text-sm">Assets</button>
                              <button onClick={() => { if (!confirm('Delete transaction?')) return; fetch(`/api/service_transactions/${tx.service_transaction_id}`, { method: 'DELETE' }).then(r => { if (r.ok) setTransactions(prev => prev.filter(t => t.service_transaction_id !== tx.service_transaction_id)) }) }} className="text-red-600 hover:underline text-sm">Delete</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  {transactionsEmptyCount > 0 && (
                    Array.from({ length: transactionsEmptyCount }).map((_, ei) => (
                      <tr key={`empty-tx-${ei}`} className="invisible">
                        <td className="py-2 px-3">2020-01-01</td>
                        <td className="py-2 px-3">Service</td>
                        <td className="py-2 px-3 text-right font-mono">0.00</td>
                        <td className="py-2 px-3 text-right font-mono">0.00</td>
                        <td className="py-2 px-3 text-right font-mono">0.00</td>
                        <td className="py-2 px-3 text-right font-mono">0.00</td>
                        <td className="py-2 px-3 text-center"><div className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium">Status</div></td>
                        <td className="py-2 px-3 text-center"><div className="invisible">Actions</div></td>
                      </tr>
                    ))
                  )}
                  </tbody>
                </table>
              </div>
            <PaginationFooter items={transactions} page={transactionsPage} setPage={setTransactionsPage} pageSize={servicesPageSize} />
          </div>
        </div>
      )}

      <Modal open={showModal} title={editingId ? 'Edit Service' : 'Add Service'} onClose={() => { setShowModal(false); setEditingId(null); setForm(emptyForm); setErrors({}); setServiceAssetRows([]); setAssetSelect(''); setAssetQty('1'); setServiceEntryMode('service'); setSubServiceForm(emptySubServiceForm); setSubServiceAttachSelect(null); setAttachedSubServices([]) }} className="max-h-[60vh] overflow-y-auto">
        <div className="space-y-4">
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
                  <select value={form.service_type} onChange={e => setForm(prev => ({ ...prev, service_type: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value="Catering">Catering</option>
                    <option value="Photoshoot">Photoshoot</option>
                    <option value="Accommodation">Accommodation</option>
                    <option value="Entrance Fee">Entrance Fee</option>
                  </select>
                  {errors.service_type && <div className="text-xs text-red-600 mt-1">{errors.service_type}</div>}
                </div>

                <div>
                  <label className="block text-xs text-slate-600 mb-1">Price</label>
                  <input value={form.price} onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
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
                      {attachableSubServices.map(s => (
                        <option key={s.sub_service_id} value={String(s.sub_service_id)}>{s.name} · {s.restaurant} · ₱{Number(s.price || 0).toFixed(2)}</option>
                      ))}
                    </select>
                  </div>
                  <button type="button" onClick={addAttachedSubService} disabled={subServiceAttachSelect == null} className="px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-40">
                    Add Sub Service
                  </button>
                </div>
                {attachedSubServices.length > 0 && (
                  <div className="space-y-1.5">
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
                    <button type="button" onClick={() => { if (!assetSelect) return; addAssetRow(assetSelect, assetQty); setAssetSelect(''); setAssetQty('1') }} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg">Add</button>
                  </div>

                  {/* Scrollable list — cap height and let it scroll independently */}
                  <div className="space-y-2 overflow-y-auto max-h-64 pr-1">
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
                  <input value={subServiceForm.price} onChange={e => setSubServiceForm(prev => ({ ...prev, price: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
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
                  <select value={subServiceForm.food_package_id ?? ''} onChange={e => setSubServiceForm(prev => ({ ...prev, food_package_id: e.target.value || undefined }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
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
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Save</button>
          </div>
        </div>
      </Modal>

      <Modal open={showSubServiceModal} title="Attach Sub-service" onClose={() => { setShowSubServiceModal(false); setEditingSubServiceId(null); setSubServiceTargetServiceId(null); setSelectedAttachSubServiceId(null); setSubServiceSearch(''); setSubServiceForm(emptySubServiceForm) }} className="max-w-xl">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Search sub-services</label>
            <input value={subServiceSearch} onChange={e => setSubServiceSearch(e.target.value)} placeholder="Search by name or restaurant" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">Available sub-services</label>
            <select value={selectedAttachSubServiceId ?? ''} onChange={e => setSelectedAttachSubServiceId(e.target.value ? Number(e.target.value) : null)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="">Select a sub-service</option>
              {availableSubServices
                .filter((item) => item.name.toLowerCase().includes(subServiceSearch.toLowerCase()) || item.restaurant.toLowerCase().includes(subServiceSearch.toLowerCase()))
                .map((item) => (
                  <option key={item.sub_service_id} value={String(item.sub_service_id)}>{item.name} · {item.restaurant} · ₱{Number(item.price || 0).toFixed(2)}</option>
                ))}
            </select>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Attached to this service</div>
            {(subServicesByService[subServiceTargetServiceId ?? -1] || []).length === 0 ? (
              <div className="text-sm text-slate-400">No attached sub-services yet.</div>
            ) : (
              <div className="space-y-2">
                {(subServicesByService[subServiceTargetServiceId ?? -1] || []).map((sub) => (
                  <div key={sub.sub_service_id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div>
                      <div className="text-sm font-medium text-slate-700">{sub.name}</div>
                      <div className="text-xs text-slate-500">{sub.restaurant} · ₱{Number(sub.price || 0).toFixed(2)}</div>
                    </div>
                    <button type="button" onClick={() => { if (subServiceTargetServiceId) detachSubService(subServiceTargetServiceId, sub.sub_service_id) }} className="text-red-600 text-xs">Detach</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button onClick={() => setShowSubServiceModal(false)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button onClick={saveSubService} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Attach</button>
          </div>
        </div>
      </Modal>

      <Modal open={showTxModal} title={editingTxId ? 'Edit Transaction' : 'Add Transaction'} onClose={() => setShowTxModal(false)}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Restaurant</label>
            <select value={txForm.restaurant} onChange={e => {
              const val = e.target.value
              setTxForm(prev => ({ ...prev, restaurant: val, service_id: undefined }))
            }} className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm ${isFullyPaid ? 'bg-slate-50 text-slate-700 focus:outline-none cursor-default caret-transparent' : ''}`} disabled={isFullyPaid || !txForm.restaurant}>
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
            }} className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm ${isFullyPaid ? 'bg-slate-50 text-slate-700 focus:outline-none cursor-default caret-transparent' : ''}`} disabled={isFullyPaid || !txForm.restaurant}>
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
            <input type="date" value={txForm.service_date} onChange={e => setTxForm(prev => ({ ...prev, service_date: e.target.value }))} className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm ${isFullyPaid ? 'bg-slate-50 text-slate-700 focus:outline-none cursor-default caret-transparent' : ''}`} disabled={isFullyPaid || !txForm.restaurant} readOnly={isFullyPaid} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Price</label>
              <input value={txForm.price} onChange={e => setTxForm(prev => ({ ...prev, price: e.target.value }))} className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm ${isFullyPaid ? 'bg-slate-50 text-slate-700 focus:outline-none cursor-default caret-transparent' : ''}`} disabled={isFullyPaid || !txForm.restaurant} readOnly={isFullyPaid} />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Downpayment</label>
              <input value={txForm.downpayment} onChange={e => {
                const val = e.target.value
                let newStatus = txForm.status
                if (!editingTxId) {
                  const dp = Number(val || '0')
                  newStatus = dp > 0 ? 'Partial Payment' : 'Under Reservation'
                }
                setTxForm(prev => ({ ...prev, downpayment: val, status: newStatus }))
              }} className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm ${isFullyPaid ? 'bg-slate-50 text-slate-700 focus:outline-none cursor-default caret-transparent' : ''}`} disabled={isFullyPaid || !txForm.restaurant} readOnly={isFullyPaid} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Discount</label>
              <input value={txForm.discount} onChange={e => setTxForm(prev => ({ ...prev, discount: e.target.value }))} className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm ${isFullyPaid ? 'bg-slate-50 text-slate-700 focus:outline-none cursor-default caret-transparent' : ''}`} disabled={isFullyPaid || !txForm.restaurant} readOnly={isFullyPaid} />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Expenses</label>
              <input value={txForm.expenses} onChange={e => setTxForm(prev => ({ ...prev, expenses: e.target.value }))} className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm ${isFullyPaid ? 'bg-slate-50 text-slate-700 focus:outline-none cursor-default caret-transparent' : ''}`} disabled={isFullyPaid || !txForm.restaurant} readOnly={isFullyPaid} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Other Penalty</label>
              <input value={txForm.penalty} onChange={e => setTxForm(prev => ({ ...prev, penalty: e.target.value }))} className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm ${isFullyPaid ? 'bg-slate-50 text-slate-700 focus:outline-none cursor-default caret-transparent' : ''}`} disabled={isFullyPaid || !txForm.restaurant} readOnly={isFullyPaid} placeholder="0.00" />
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
              className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm ${isFullyPaid ? 'bg-slate-50 text-slate-700 focus:outline-none cursor-default caret-transparent' : ''}`}
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
            <div className="mb-3 p-3 bg-slate-50 rounded-lg">
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
                        <p className="text-xs text-slate-500">Total Price</p>
                        <p className="font-semibold text-slate-800 font-mono">
                          ₱{totalPrice.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Paid Amount</p>
                        <p className="font-semibold text-slate-800 font-mono">
                          ₱{paidAmount.toFixed(2)}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-slate-500">Unpaid Balance</p>
                        <p className="font-bold text-lg text-red-600 font-mono">
                          ₱{unpaidBalance.toFixed(2)}
                        </p>
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
            {editingTxId && txForm.status === 'Finalized' && (
              <div className="flex items-center gap-2 mt-3">
                <input type="number" min="0.01" step="0.01" value={addPaymentAmount} onChange={e => { if (e.target.value === '' || /^\d*\.?\d{0,2}$/.test(e.target.value)) setAddPaymentAmount(e.target.value) }} placeholder="Payment amount" className="w-36 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none text-center" inputMode="decimal" />
                <button onClick={handleAddPayment} disabled={!addPaymentAmount || Number(addPaymentAmount) <= 0} className="px-3 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-40">Add Payment</button>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button onClick={() => setShowTxModal(false)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            {!isFullyPaid && <button onClick={handleSaveTx} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Save</button>}
          </div>
        </div>
      </Modal>

      <Modal open={showAssetsModal} title={`Service Assets`} onClose={() => setShowAssetsModal(false)}>
        <div className="w-md space-y-3">
          {assetLines.length === 0 ? <div className="text-sm text-slate-500">No assets assigned for this service.</div> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="text-xs text-slate-500 uppercase border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="py-2 px-3 text-left">Asset</th>
                    <th className="py-2 px-3 text-center">Used</th>
                    <th className="py-2 px-3 text-center">Returned</th>
                    <th className="py-2 px-3 text-center">Penalty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {assetLines.map(line => (
                    <tr key={line.asset_id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-sm font-medium text-slate-700">{line.asset_name}</td>
                      <td className="py-2 px-3 text-center text-sm text-slate-700">{line.assigned_quantity}</td>
                      <td className="py-2 px-3 text-center">
                        <input type="number" min={0} max={line.assigned_quantity} value={String(line.quantity_returned || 0)} onChange={e => { const val = Number(e.target.value || 0); updateAssetQuantity(line.asset_id, val) }} className="w-20 border rounded px-2 py-1 text-sm text-center" />
                      </td>
                      <td className="py-2 px-3 text-center text-sm">
                        {currentTxStatus === 'Finalized' ? Number(line.penalty_amount || 0).toFixed(2) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button onClick={() => setShowAssetsModal(false)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
            <button onClick={() => { if (currentTxId) saveAssets(currentTxId) }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Save</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
