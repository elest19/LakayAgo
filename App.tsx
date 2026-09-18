'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react'
import type {
  Page,
  Toast,
  AppContextType,
  InventoryItem,
  SaleRecord,
  ExpenseRecord,
  PayrollPeriod,
  ProductionItem,
  KitchenItem,
  StockTransaction,
} from './types'
import useIsMobile from './hooks/isMobile'
import {
  LayoutDashboard, Users, ClipboardList, Upload, History,
  CalendarDays, Cog, FileText, LogOut, ChevronDown, ChevronRight,
  Bell, Search, Menu, X, CheckCircle, AlertCircle, AlertTriangle, Info,
  CreditCard, BookOpen, Settings, ClipboardCheck, UserCheck, BarChart3, ShoppingCart, Wallet, Package2,
  Factory, CookingPot,
} from 'lucide-react'

const Login = dynamic(() => import('./legacy-pages/Login').then((mod) => mod.default), {
  ssr: false,
  loading: () => <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700">Loading…</div>,
})
const Dashboard = dynamic(() => import('./legacy-pages/Dashboard').then((mod) => mod.default), { ssr: false })
const Employees = dynamic(() => import('./legacy-pages/Employees').then((mod) => mod.default), { ssr: false })
const AttendanceRecords = dynamic(() => import('./legacy-pages/AttendanceRecords').then((mod) => mod.default), { ssr: false })
const ImportAttendance = dynamic(() => import('./legacy-pages/ImportAttendance').then((mod) => mod.default), { ssr: false })
const ImportHistory = dynamic(() => import('./legacy-pages/ImportHistory').then((mod) => mod.default), { ssr: false })
const PayrollPeriods = dynamic(() => import('./legacy-pages/PayrollPeriods').then((mod) => mod.default), { ssr: false })
const PayrollHistory = dynamic(() => import('./legacy-pages/PayrollHistory').then((mod) => mod.default), { ssr: false })
const CashAdvance = dynamic(() => import('./legacy-pages/CashAdvance').then((mod) => mod.default), { ssr: false })
const ProcessPayroll = dynamic(() => import('./legacy-pages/ProcessPayroll').then((mod) => mod.default), { ssr: false })
const Payslips = dynamic(() => import('./legacy-pages/Payslips').then((mod) => mod.default), { ssr: false })
const LeaveManagement = dynamic(() => import('./legacy-pages/LeaveManagement').then((mod) => mod.default), { ssr: false })
const Reports = dynamic(() => import('./legacy-pages/Reports').then((mod) => mod.default), { ssr: false })
const SettingsPage = dynamic(() => import('./legacy-pages/Settings').then((mod) => mod.default), { ssr: false })
const AuditLogs = dynamic(() => import('./legacy-pages/AuditLogs').then((mod) => mod.default), { ssr: false })
const SalesSummary = dynamic(() => import('./legacy-pages/SalesSummary.tsx').then((mod) => mod.default), { ssr: false })
const Sales = dynamic(() => import('./legacy-pages/Sales').then((mod) => mod.default), { ssr: false })
const AssetsCatalog = dynamic(() => import('./legacy-pages/AssetsCatalog').then((mod) => mod.default), { ssr: false })
const ProductionCatalog = dynamic(() => import('./legacy-pages/ProductionCatalog').then((mod) => mod.default), { ssr: false })
const FoodAndBeverageCatalog = dynamic(() => import('./legacy-pages/FoodAndBeverageCatalog').then((mod) => mod.default), { ssr: false })
const FoodPackages = dynamic(() => import('./legacy-pages/FoodPackages').then((mod) => mod.default), { ssr: false })
const ServicesPage = dynamic(() => import('./legacy-pages/Services').then((mod) => mod.default), { ssr: false })
const Expenses = dynamic(() => import('./legacy-pages/Expenses').then((mod) => mod.default), { ssr: false })
import { authClient } from './lib/auth-client'
import Modal from './components/Modal'
import isMobile from './hooks/isMobile'
import { useRealtimeConnectionStatus } from './hooks/useRealtimeEntity'

const AppContext = createContext<AppContextType>({
  currentPage: 'dashboard',
  navigate: () => {},
  showToast: () => {},
  inventoryItems: [],
  setInventoryItems: () => {},
  productionStock: [],
  setProductionStock: () => {},
  kitchenStock: [],
  setKitchenStock: () => {},
  salesRecords: [],
  setSalesRecords: () => {},
  expenses: [],
  setExpenses: () => {},
  stockTransactions: [],
  transferToKitchen: () => false,
  kitchenSelfProduce: () => false,
  sellMenuItem: () => false,
  activePayrollPeriod: null,
  setActivePayrollPeriod: () => {},
  appMode: 'lakayAgo',
  setAppMode: () => {},
  logoSrc: '/logo.jpg',
  openEmployee: () => {},
  clearOpenEmployee: () => {},
  openEmployeeId: null,
})

export const useApp = () => useContext(AppContext)

const normalizeAppUser = (value: any) => {
  if (!value) return null
  const userId = value.user_id ?? value.id ?? null
  return {
    ...value,
    id: value.id ?? userId,
    user_id: userId,
    username: value.username ?? '',
    role: value.role ?? 'Staff',
    restaurant: value.restaurant ?? 'Both',
  }
}

interface NavItem {
  id: Page
  label: string
  icon: React.ReactNode
}

interface NavGroup {
  label: string
  icon: React.ReactNode
  items: NavItem[]
}

type NavEntry = NavItem | ({ type: 'group' } & NavGroup)

const navItems: NavEntry[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { id: 'employees', label: 'Employees', icon: <Users size={18} /> },
  {
    type: 'group',
    label: 'Attendance',
    icon: <ClipboardList size={18} />,
    items: [
      { id: 'attendance-records', label: 'Attendance Records', icon: <ClipboardCheck size={16} /> },
      { id: 'import-attendance', label: 'Import Attendance', icon: <Upload size={16} /> },
      { id: 'import-history', label: 'Import History', icon: <History size={16} /> },
    ],
  },
  {
    type: 'group',
    label: 'Payroll',
    icon: <CreditCard size={18} />,
    items: [
      { id: 'payroll-periods', label: 'Payroll Periods', icon: <CalendarDays size={16} /> },
      { id: 'cash-advance', label: 'Cash Advance', icon: <Wallet size={16} /> },
      { id: 'process-payroll', label: 'Process Payroll', icon: <Cog size={16} /> },
      { id: 'payslips', label: 'Payslips', icon: <FileText size={16} /> },
    ],
  },
  {
    type: 'group',
    label: 'Inventory Management',
    icon: <ShoppingCart size={18} />,
    items: [
      { id: 'sales-summary', label: 'Summary Report', icon: <BarChart3 size={16} /> },
      { id: 'sales', label: 'Sales', icon: <Wallet size={16} /> },
      { id: 'services', label: 'Services', icon: <FileText size={16} /> },
      { id: 'food-and-beverage-catalog', label: 'Food & Beverage', icon: <CookingPot size={16} /> },
      { id: 'food-packages', label: 'Food Packages', icon: <Package2 size={16} /> },
      { id: 'assets-catalog', label: 'Assets', icon: <Package2 size={16} /> },
      { id: 'production-catalog', label: 'Ingredients', icon: <Factory size={16} /> },
      { id: 'expenses', label: 'Expenses', icon: <CreditCard size={16} /> },
    ],
  },
  { id: 'leave-management', label: 'Leave Management', icon: <UserCheck size={18} /> },
  { id: 'reports', label: 'Reports', icon: <BarChart3 size={18} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={18} /> },
  { id: 'audit-logs', label: 'Audit Logs', icon: <BookOpen size={18} /> },
]

const pageMeta: Record<Page, { title: string; breadcrumbs: string[] }> = {
  login: { title: 'Sign in', breadcrumbs: ['Sign in'] },
  dashboard: { title: 'Dashboard', breadcrumbs: ['Dashboard'] },
  employees: { title: 'Employees', breadcrumbs: ['Employees'] },
  'attendance-records': { title: 'Attendance Records', breadcrumbs: ['Attendance', 'Records'] },
  'import-attendance': { title: 'Import Attendance', breadcrumbs: ['Attendance', 'Import'] },
  'import-history': { title: 'Import History', breadcrumbs: ['Attendance', 'Import History'] },
  'payroll-periods': { title: 'Payroll Periods', breadcrumbs: ['Payroll', 'Periods'] },
  'payroll-history': { title: 'Payroll History', breadcrumbs: ['Payroll', 'History'] },
  'cash-advance': { title: 'Cash Advance', breadcrumbs: ['Payroll', 'Cash Advance'] },
  'process-payroll': { title: 'Process Payroll', breadcrumbs: ['Payroll', 'Process'] },
  payslips: { title: 'Payslips', breadcrumbs: ['Payroll', 'Payslips'] },
  'leave-management': { title: 'Leave Management', breadcrumbs: ['Leave Management'] },
  'sales-summary': { title: 'Inventory Management', breadcrumbs: ['Inventory Management', 'Summary Report'] },
  sales: { title: 'Inventory Management', breadcrumbs: ['Inventory Management', 'Sales'] },
  'assets-catalog': { title: 'Inventory Management', breadcrumbs: ['Inventory Management', 'Assets Catalog'] },
  'food-and-beverage-catalog': { title: 'Inventory Management', breadcrumbs: ['Inventory Management', 'Food & Beverage Catalog'] },
  'production-catalog': { title: 'Inventory Management', breadcrumbs: ['Inventory Management', 'Production Catalog'] },
  'food-packages': { title: 'Inventory Management', breadcrumbs: ['Inventory Management', 'Food Packages'] },
  'services': { title: 'Inventory Management', breadcrumbs: ['Inventory Management', 'Services'] },
  expenses: { title: 'Inventory Management', breadcrumbs: ['Inventory Management', 'Expenses'] },
  reports: { title: 'Reports', breadcrumbs: ['Reports'] },
  settings: { title: 'Settings', breadcrumbs: ['Settings'] },
  'audit-logs': { title: 'Audit Logs', breadcrumbs: ['Audit Logs'] },
}

function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  const icons = {
    success: <CheckCircle size={18} className="text-emerald-500" />,
    error: <AlertCircle size={18} className="text-red-500" />,
    warning: <AlertTriangle size={18} className="text-amber-500" />,
    info: <Info size={18} className="text-blue-500" />,
  }
  const bars = {
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
  }

  return (
    <div className="fixed inset-x-3 bottom-4 z-999 flex flex-col gap-3 sm:right-6 sm:left-auto sm:w-88 sm:max-w-sm sm:bottom-6">
      {toasts.map(t => (
        <div key={t.id} className="bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden flex items-start gap-3 p-4 toast-enter">
          <div className="mt-0.5 shrink-0">{icons[t.type]}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 font-display">{t.message}</p>
            {t.description && <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>}
          </div>
          <button onClick={() => removeToast(t.id)} className="shrink-0 text-slate-400 hover:text-slate-600 ml-1 cursor-pointer">
            <X size={14} />
          </button>
          <div className={`absolute bottom-0 left-0 h-0.5 ${bars[t.type]} w-full`} />
        </div>
      ))}
    </div>
  )
}

const routePageMap: Record<string, Page> = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/employees': 'employees',
  '/attendance/records': 'attendance-records',
  '/attendance/import': 'import-attendance',
  '/attendance/import-history': 'import-history',
  '/payroll/periods': 'payroll-periods',
  '/payroll/history': 'payroll-history',
  '/payroll/cash-advance': 'cash-advance',
  '/payroll/process': 'process-payroll',
  '/payroll/payslips': 'payslips',
  '/leave-management': 'leave-management',
  '/sales-summary': 'sales-summary',
  '/sales': 'sales',
  '/inventory/assets': 'assets-catalog',
  '/inventory/production': 'production-catalog',
  '/inventory/food-and-beverage': 'food-and-beverage-catalog',
  '/inventory/food-packages': 'food-packages',
  '/inventory/services': 'services',
  '/expenses': 'expenses',
  '/reports': 'reports',
  '/settings': 'settings',
  '/audit-logs': 'audit-logs',
  '/login': 'login',
}

function RealtimeStatusPill() {
  const status = useRealtimeConnectionStatus('employees', 'Both')
  const isLive = status === 'connected'

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
        isLive
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-amber-200 bg-amber-50 text-amber-700'
      }`}
    >
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          isLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
        }`}
      />
      {isLive ? 'Live' : status === 'connecting' ? 'Connecting' : status === 'channel_error' ? 'Error' : 'Offline'}
    </div>
  )
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [user, setUser] = useState<any | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const isMobileView = useIsMobile()
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [productionStock, setProductionStock] = useState<ProductionItem[]>([])
  const [kitchenStock, setKitchenStock] = useState<KitchenItem[]>([])
  const [salesRecords, setSalesRecords] = useState<SaleRecord[]>([])
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([])
  const [stockTransactions, setStockTransactions] = useState<StockTransaction[]>([])
  const [activePayrollPeriod, setActivePayrollPeriod] = useState<PayrollPeriod | null>(null)
  const [appMode, setAppMode] = useState<'aroo' | 'lakayAgo'>('lakayAgo')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const themeToggleRef = useRef<HTMLButtonElement>(null)
  const logoSrc = appMode === 'aroo' ? '/Aroo_Logo.jpg' : '/logo.jpg'
  const [toasts, setToasts] = useState<Toast[]>([])
  const [notifications, setNotifications] = useState<Array<{ id: string; msg: string; time?: string; type?: 'info'|'success'|'warning'|'error'; read?: boolean; href?: string }>>([])
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifMounted, setNotifMounted] = useState(false)
  const [notifVisible, setNotifVisible] = useState(false)
  const [showModeConfirmation, setShowModeConfirmation] = useState(false)
  const [modeLocked, setModeLocked] = useState(false)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    contactNumber: '',
    role: '',
    email: '',
    password: '',
  })

  useEffect(() => {
    const path = window.location.pathname.replace(/\/+$/, '') || '/'
    const page = routePageMap[path] ?? 'dashboard'
    setCurrentPage(page)
    const group = navItems.find((entry): entry is { type: 'group' } & NavGroup =>
      'type' in entry && entry.type === 'group' && entry.items.some(i => i.id === page))
    if (group) setExpandedGroups(prev => new Set(prev).add(group.label))
  }, [])

  

  const session = authClient.useSession()

  // fetch current session/user
  useEffect(() => {
    const nextUser = normalizeAppUser(session.data?.user ?? null)
    setUser(nextUser)
    setAuthLoading(session.isPending)

    if (session.isPending) return

    if (nextUser) {
      const nameParts = (nextUser.name || '').split(' ')
      setProfileForm({
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        contactNumber: '',
        role: nextUser.role === 'SuperAdmin' ? 'Super Admin' : nextUser.role || '',
        email: nextUser.email || '',
        password: '',
      })

      if (!session.data?.user) return
      const hasModal = (window as any).__app_mode_modal_shown
      if (!hasModal) {
        ;(window as any).__app_mode_modal_shown = true
        requestAnimationFrame(() => {
          setModeLocked(true)
          setShowModeConfirmation(true)
        })
      }
    }
  }, [session.data, session.isPending])

  // sync profileForm with authenticated user
  useEffect(() => {
    if (user) {
      const nameParts = (user.name || '').split(' ')
      setProfileForm({
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        contactNumber: '',
        role: user.role === 'SuperAdmin' ? 'Super Admin' : user.role || '',
        email: user.email || '',
        password: '',
      })
    }
  }, [user])

  // expose a global setter for legacy pages to set user after login
  useEffect(() => {
    ;(window as any).__app_set_user = (u: any) => setUser(normalizeAppUser(u))
    ;(window as any).__app_show_mode_confirmation = () => setShowModeConfirmation(true)
    ;(window as any).routePageMap = routePageMap
    ;(window as any).__app_notify = (payload: { msg: string; time?: string; type?: any; href?: string }) => {
      const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? `notif-${crypto.randomUUID()}`
        : `notif-${Date.now()}-${Math.random().toString(16).slice(2)}`
      setNotifications(prev => [{ id, msg: payload.msg, time: payload.time || 'now', type: payload.type || 'info', read: false, href: payload.href || '' }, ...prev])
    }
    return () => { delete (window as any).__app_set_user; delete (window as any).__app_show_mode_confirmation; delete (window as any).routePageMap; delete (window as any).__app_notify }
  }, [])

  // global fetch interceptor: if any fetch returns 401, clear session and redirect to login
  useEffect(() => {
    const orig = window.fetch.bind(window)
    window.fetch = async (...args: any[]) => {
      const res = await (orig as any)(...args)
      if (res.status === 401) {
        setUser(null)
        setCurrentPage('login')
        window.history.replaceState({}, '', '/login')
      }
      return res
    }
    return () => { window.fetch = orig }
  }, [])

  // redirect logic after auth load
  useEffect(() => {
    if (!authLoading) {
      const loginPending = Boolean((window as any).__app_login_pending)

      if (!user && currentPage !== 'login' && !loginPending) {
        const intended = window.location.pathname
        const safe = Object.keys(routePageMap).includes(intended)
        const redirectUrl = safe ? `/login?redirect=${encodeURIComponent(intended)}` : '/login'
        window.history.replaceState({}, '', redirectUrl)
        setCurrentPage('login')
      } else if ((user || loginPending) && currentPage === 'login') {
        setCurrentPage('dashboard')
        window.history.replaceState({}, '', '/dashboard')
      }
    }
  }, [authLoading, user, currentPage])

  // Pages fetch their own data now (no global mock loads)

  useEffect(() => {
    const favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement | null
    const appleIcon = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement | null

    if (favicon) favicon.href = logoSrc
    if (appleIcon) appleIcon.href = logoSrc
    document.title = appMode === 'aroo' ? 'Aroo' : 'Lakay Ago'
  }, [appMode, logoSrc])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setProfileOpen(false)
        setNotifOpen(false)
      }
    }

    if (profileOpen || notifOpen) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [profileOpen, notifOpen])

  useEffect(() => {
    if (notifOpen) {
      setNotifMounted(true)
      requestAnimationFrame(() => setNotifVisible(true))
      return
    }

    setNotifVisible(false)
    const timeoutId = setTimeout(() => setNotifMounted(false), 220)
    return () => clearTimeout(timeoutId)
  }, [notifOpen])

  const navigate = useCallback((page: Page, push: boolean = true) => {
    setCurrentPage(page)
    setMobileSidebarOpen(false)
    if (push) {
      const pageToPath: Record<Page, string> = {
        login: '/login',
        dashboard: '/dashboard',
        employees: '/employees',
        'attendance-records': '/attendance/records',
        'import-attendance': '/attendance/import',
        'import-history': '/attendance/import-history',
        'payroll-periods': '/payroll/periods',
        'payroll-history': '/payroll/history',
        'cash-advance': '/payroll/cash-advance',
        'process-payroll': '/payroll/process',
        payslips: '/payroll/payslips',
        'leave-management': '/leave-management',
        'sales-summary': '/sales-summary',
        sales: '/sales',
        'assets-catalog': '/inventory/assets',
        'production-catalog': '/inventory/production',
        'food-and-beverage-catalog': '/inventory/food-and-beverage',
        'food-packages': '/inventory/food-packages',
        'services': '/inventory/services',
        expenses: '/expenses',
        reports: '/reports',
        settings: '/settings',
        'audit-logs': '/audit-logs',
      }
      const p = pageToPath[page] ?? '/'
      if (window.location.pathname !== p) window.history.pushState({}, '', p)
    }
  }, [])

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? `toast-${crypto.randomUUID()}`
      : `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`

    setToasts(prev => [...prev, { ...toast, id }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const transferToKitchen = useCallback((itemName: string, qty: number, department: string): boolean => {
    const trimmedName = itemName.trim()
    const trimmedDepartment = department.trim()
    const parsedQty = Number(qty)

    if (!trimmedName) {
      showToast({ type: 'error', message: 'Missing item name', description: 'Please enter a production item name.' })
      return false
    }

    if (!trimmedDepartment) {
      showToast({ type: 'error', message: 'Missing department', description: 'Please select or enter the department.' })
      return false
    }

    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      showToast({ type: 'error', message: 'Invalid quantity', description: 'Transfer quantity must be a positive number.' })
      return false
    }

    const source = productionStock.find(item => item.name.toLowerCase() === trimmedName.toLowerCase() && item.unit.toLowerCase() === trimmedDepartment.toLowerCase())

    if (!source) {
      showToast({ type: 'error', message: 'Production stock not found', description: `${trimmedName} is not available in ${trimmedDepartment}.` })
      return false
    }

    if (source.stock < parsedQty) {
      showToast({ type: 'error', message: 'Insufficient production stock', description: `${trimmedName} only has ${source.stock} units available.` })
      return false
    }

    const timestamp = new Date().toISOString()
    const nextTransaction: StockTransaction = {
      id: `TXN-${Date.now()}`,
      itemName: source.name,
      type: 'TRANSFER',
      quantity: parsedQty,
      from: 'production',
      to: 'kitchen',
      timestamp,
      performedBy: 'Admin',
    }

    setProductionStock(prev => prev.map(item => item.id === source.id ? { ...item, stock: item.stock - parsedQty, updatedAt: timestamp, updatedBy: 'Admin' } : item))
    setKitchenStock(prev => {
      const existing = prev.find(item => item.itemName.toLowerCase() === trimmedName.toLowerCase() && item.department.toLowerCase() === trimmedDepartment.toLowerCase())

      if (existing) {
        return prev.map(item => item.id === existing.id ? { ...item, stock: item.stock + parsedQty, updatedAt: timestamp, updatedBy: 'Admin' } : item)
      }

      const newItem: KitchenItem = {
        id: `KIT-${Date.now()}`,
        itemName: trimmedName,
        department: trimmedDepartment,
        stock: parsedQty,
        createdAt: timestamp,
        createdBy: 'Admin',
        updatedAt: timestamp,
        updatedBy: 'Admin',
      }

      return [newItem, ...prev]
    })
    setStockTransactions(prev => [nextTransaction, ...prev])
    showToast({ type: 'success', message: 'Transferred to kitchen', description: `${parsedQty} ${trimmedName} moved from production to kitchen.` })
    return true
  }, [productionStock, showToast])

  const kitchenSelfProduce = useCallback((itemName: string, qty: number, department: string): boolean => {
    const trimmedName = itemName.trim()
    const trimmedDepartment = department.trim()
    const parsedQty = Number(qty)

    if (!trimmedName) {
      showToast({ type: 'error', message: 'Missing item name', description: 'Please enter a kitchen item name.' })
      return false
    }

    if (!trimmedDepartment) {
      showToast({ type: 'error', message: 'Missing department', description: 'Please enter a department for the item.' })
      return false
    }

    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      showToast({ type: 'error', message: 'Invalid quantity', description: 'Self-produced quantity must be a positive number.' })
      return false
    }

    const timestamp = new Date().toISOString()
    const nextTransaction: StockTransaction = {
      id: `TXN-${Date.now()}`,
      itemName: trimmedName,
      type: 'SELF_PRODUCE',
      quantity: parsedQty,
      from: null,
      to: 'kitchen',
      timestamp,
      performedBy: 'Admin',
    }

    setKitchenStock(prev => {
      const existing = prev.find(item => item.itemName.toLowerCase() === trimmedName.toLowerCase() && item.department.toLowerCase() === trimmedDepartment.toLowerCase())

      if (existing) {
        return prev.map(item => item.id === existing.id ? { ...item, stock: item.stock + parsedQty, updatedAt: timestamp, updatedBy: 'Admin' } : item)
      }

      const newItem: KitchenItem = {
        id: `KIT-${Date.now()}`,
        itemName: trimmedName,
        department: trimmedDepartment,
        stock: parsedQty,
        createdAt: timestamp,
        createdBy: 'Admin',
        updatedAt: timestamp,
        updatedBy: 'Admin',
      }

      return [newItem, ...prev]
    })

    setStockTransactions(prev => [nextTransaction, ...prev])
    showToast({ type: 'success', message: 'Kitchen stock updated', description: `${parsedQty} ${trimmedName} was added to kitchen inventory.` })
    return true
  }, [showToast])

  const sellMenuItem = useCallback((itemName: string, qty: number): boolean => {
    const trimmedName = itemName.trim()
    const parsedQty = Number(qty)

    if (!trimmedName) {
      showToast({ type: 'error', message: 'Missing menu item', description: 'Please select a menu item before selling.' })
      return false
    }

    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      showToast({ type: 'error', message: 'Invalid quantity', description: 'Sale quantity must be a positive number.' })
      return false
    }

    const menuItem = inventoryItems.find(item => item.item.toLowerCase() === trimmedName.toLowerCase())

    if (!menuItem) {
      showToast({ type: 'error', message: 'Menu item not found', description: `${trimmedName} is not available in the menu catalog.` })
      return false
    }

    if (menuItem.stock < parsedQty) {
      showToast({ type: 'error', message: 'Insufficient menu stock', description: `${trimmedName} only has ${menuItem.stock} units available.` })
      return false
    }

    if (menuItem.category === 'Menu Item') {
      if (!menuItem.linkedKitchenItemId) {
        showToast({ type: 'error', message: 'Unlinked menu item', description: `${trimmedName} is not linked to any kitchen stock.` })
        return false
      }

      const kitchenItem = kitchenStock.find(item => item.id === menuItem.linkedKitchenItemId)
      if (!kitchenItem) {
        showToast({ type: 'error', message: 'Kitchen stock missing', description: `${trimmedName} references a kitchen item that no longer exists.` })
        return false
      }

      if (kitchenItem.stock < parsedQty) {
        showToast({ type: 'error', message: 'Insufficient kitchen stock', description: `${trimmedName} only has ${kitchenItem.stock} units in kitchen stock.` })
        return false
      }

      const timestamp = new Date().toISOString()
      const nextTransaction: StockTransaction = {
        id: `TXN-${Date.now()}`,
        itemName: trimmedName,
        type: 'SALE',
        quantity: parsedQty,
        from: 'kitchen',
        to: 'menu',
        timestamp,
        performedBy: 'Admin',
      }

      setInventoryItems(prev => prev.map(item => item.id === menuItem.id ? { ...item, stock: item.stock - parsedQty, updatedAt: timestamp, updatedBy: 'Admin' } : item))
      setKitchenStock(prev => prev.map(item => item.id === kitchenItem.id ? { ...item, stock: item.stock - parsedQty, updatedAt: timestamp, updatedBy: 'Admin' } : item))
      setStockTransactions(prev => [nextTransaction, ...prev])
      showToast({ type: 'success', message: 'Menu item sold', description: `${parsedQty} ${trimmedName} sold and both menu and kitchen stock were reduced.` })
      return true
    }

    const timestamp = new Date().toISOString()
    const nextTransaction: StockTransaction = {
      id: `TXN-${Date.now()}`,
      itemName: trimmedName,
      type: 'SALE',
      quantity: parsedQty,
      from: 'kitchen',
      to: 'menu',
      timestamp,
      performedBy: 'Admin',
    }

    setInventoryItems(prev => prev.map(item => item.id === menuItem.id ? { ...item, stock: item.stock - parsedQty, updatedAt: timestamp, updatedBy: 'Admin' } : item))
    setStockTransactions(prev => [nextTransaction, ...prev])
    showToast({ type: 'success', message: 'Menu item sold', description: `${parsedQty} ${trimmedName} sold from menu stock.` })
    return true
  }, [inventoryItems, kitchenStock, showToast])

  const toggleAppMode = useCallback((nextMode: 'aroo' | 'lakayAgo') => {
    // Only users assigned to 'Both' may toggle the app mode
    if (user?.restaurant !== 'Both') return

    if (isMobileView) {
      setMobileSidebarOpen(false)
    }

    // Respect reduced-motion preferences
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setModeLocked(true)
      setAppMode(nextMode)
      try { if (user?.restaurant === 'Both') localStorage.setItem(`appMode:${user.user_id}`, nextMode) } catch {}
      setShowModeConfirmation(true)
      return
    }

    const button = themeToggleRef.current

    if (!button) {
      setModeLocked(true)
      setAppMode(nextMode)
      try { if (user?.restaurant === 'Both') localStorage.setItem(`appMode:${user.user_id}`, nextMode) } catch {}
      setShowModeConfirmation(true)
      return
    }

    const rect = button.getBoundingClientRect()

    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2

    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    )

    const isFirefox = /firefox/i.test(navigator.userAgent)

    const overlay = document.createElement('div')

    Object.assign(overlay.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '1px',
      height: '1px',
      zIndex: '99999',
      pointerEvents: 'none',
      background: '#16a34a',
      willChange: isFirefox ? 'transform, opacity' : 'clip-path, opacity',
    })

    if (isFirefox) {
      overlay.style.left = `${x}px`
      overlay.style.top = `${y}px`

      const circleSize = radius * 2

      overlay.style.width = `${circleSize}px`
      overlay.style.height = `${circleSize}px`
      overlay.style.borderRadius = '50%'
      overlay.style.transform = 'translate(-50%, -50%) scale(0)'
      overlay.style.transformOrigin = 'center center'

      document.body.appendChild(overlay)

      const expand = overlay.animate(
        {
          transform: [
            'translate(-50%, -50%) scale(0)',
            'translate(-50%, -50%) scale(1)',
          ],
        },
        {
          duration: isMobileView ? 800 : 1000,
          easing: 'ease-in-out',
          fill: 'forwards',
        }
      )

      expand.onfinish = () => {
        setAppMode(nextMode)
        try { if (user?.restaurant === 'Both') localStorage.setItem(`appMode:${user.user_id}`, nextMode) } catch {}
        setModeLocked(true)
        setShowModeConfirmation(true)

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const fade = overlay.animate(
              {
                opacity: [1, 0],
              },
              {
                duration: isMobileView ? 500 : 800,
                easing: 'ease-out',
                fill: 'forwards',
              }
            )

            fade.onfinish = () => {
              overlay.remove()
            }
          })
        })
      }

      return
    }

    Object.assign(overlay.style, {
      inset: '0',
      width: '',
      height: '',
      background: '#16a34a',
      clipPath: `circle(0px at ${x}px ${y}px)`,
    })

    document.body.appendChild(overlay)

    setModeLocked(true)
    setAppMode(nextMode)
    try { if (user?.restaurant === 'Both') localStorage.setItem(`appMode:${user.user_id}`, nextMode) } catch {}

    const expand = overlay.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${radius}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration: isMobileView ? 800 : 1000,
        easing: 'ease-in-out',
        fill: 'forwards',
      }
    )

    expand.onfinish = () => {
      setModeLocked(true)
      setShowModeConfirmation(true)

      const fade = overlay.animate(
        {
          opacity: [1, 0],
        },
        {
          duration: isMobileView ? 500 : 800,
          easing: 'ease-out',
          fill: 'forwards',
        }
      )

      fade.onfinish = () => {
        overlay.remove()
      }
    }
  }, [isMobileView, user])

  // Resolve appMode based on user's restaurant assignment and persisted preference
  useEffect(() => {
    if (!user) return
    try {
      if (user.restaurant === 'Aroo') {
        setAppMode(prev => (prev === 'aroo' ? prev : 'aroo'))
      } else if (user.restaurant === 'Lakay Ago') {
        setAppMode(prev => (prev === 'lakayAgo' ? prev : 'lakayAgo'))
      } else if (user.restaurant === 'Both') {
        const saved = localStorage.getItem(`appMode:${user.user_id}`)
        const nextMode = saved === 'aroo' ? 'aroo' : 'lakayAgo'
        setAppMode(prev => (prev === nextMode ? prev : nextMode))
      }
    } catch (err) {}
  }, [user])

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  const [openEmployeeId, setOpenEmployeeId] = useState<string | null>(null)

  const openEmployee = useCallback((id: string) => {
    setOpenEmployeeId(id)
    setCurrentPage('employees')
    setMobileSidebarOpen(false)
  }, [])

  const clearOpenEmployee = useCallback(() => setOpenEmployeeId(null), [])

  const isGroupActive = (group: NavGroup) => group.items.some(item => item.id === currentPage)

  const meta = pageMeta[currentPage]

  const renderPage = () => {
    switch (currentPage) {
      case 'login': return <Login />
      case 'dashboard': return <Dashboard />
      case 'employees': return <Employees />
      case 'attendance-records': return <AttendanceRecords />
      case 'import-attendance': return <ImportAttendance />
      case 'import-history': return <ImportHistory />
      case 'payroll-periods': return <PayrollPeriods />
      case 'payroll-history': return <PayrollHistory />
      case 'cash-advance': return <CashAdvance />
      case 'process-payroll': return <ProcessPayroll />
      case 'payslips': return <Payslips />
      case 'leave-management': return <LeaveManagement />
      case 'sales-summary': return <SalesSummary />
      case 'sales': return <Sales />
      case 'assets-catalog': return <AssetsCatalog />
      case 'production-catalog': return <ProductionCatalog />
      case 'food-and-beverage-catalog': return <FoodAndBeverageCatalog />
      case 'food-packages': return <FoodPackages />
      case 'services': return <ServicesPage />
      case 'expenses': return <Expenses />
      case 'reports': return <Reports />
      case 'settings': return <SettingsPage />
      case 'audit-logs': return <AuditLogs />
      default: return <Dashboard />
    }
  }

  const SidebarContent = () => {
    const showLabels = !isMobileView || mobileSidebarOpen
  

    return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      {isMobileView ? (
        <button
          type="button"
          onClick={() => { setProfileOpen(true); setMobileSidebarOpen(false); }}
          className={`border-b border-slate-800 hover:bg-slate-900 cursor-pointer p-3 flex gap-3 ${showLabels ? '' : 'justify-center'}`}
          aria-haspopup="dialog"
          aria-expanded={profileOpen}
        >
          <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold font-display">
              {user ? (user.name || '').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : '...'}
            </span>
          </div>
          {showLabels && (
            <div className="text-start min-w-0">
              <p className="text-sm font-semibold text-white truncate font-display">{user?.name || 'Loading...'}</p>
              <p className="text-xs text-slate-400 truncate">{user?.role || ''}</p>
            </div>
          )}
        </button>
      ) : (
        <div className={`flex items-center gap-3 px-4 py-5 border-b border-slate-800 ${showLabels ? '' : 'justify-center'}`}>
          <div className="flex items-center gap-3">
                <img src={logoSrc} alt={appMode === 'aroo' ? 'Aroo' : 'Lakay Ago'} className="w-12 h-12 object-contain rounded-sm" />
                <div className="flex flex-col">
                  <span className="text-base font-bold text-white leading-tight font-display">
                    {appMode === 'aroo' ? 'Aroo' : 'Lakay Ago'}
                  </span>
                  <span className="text-xs text-slate-400 leading-tight">
                    Attendance & Payroll
                  </span>
                </div>
              </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {showLabels && user?.restaurant === 'Both' && (
          <div>
            <button
              ref={themeToggleRef}
              type="button"
              onClick={() => toggleAppMode(appMode === 'aroo' ? 'lakayAgo' : 'aroo')}
              className="mb-3 w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left cursor-pointer text-slate-100 bg-green-800 hover:text-white hover:bg-green-600 transition-colors"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-sm bg-white/10 text-[10px] font-bold">
                {appMode === 'aroo' ? 'L' : 'A'}
              </span>
              <span className="text-sm font-medium font-display">
                {appMode === 'aroo' ? 'Switch to Lakay Ago' : 'Switch to Aroo'}
              </span>
            </button>
          </div>
        )}
        <div className="mt-3 border-t border-slate-800 pt-3"></div>
        {navItems.map((entry, idx) => {
          if ('type' in entry && entry.type === 'group') {
            const group = entry as { type: 'group' } & NavGroup
            const expanded = expandedGroups.has(group.label)
            const active = isGroupActive(group)
            return (
              <div key={idx}>
                <button
                  onClick={() => toggleGroup(group.label)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left cursor-pointer mb-0.5 group
                    ${active ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                  title={showLabels ? undefined : group.label}
                >
                  <span className="shrink-0">{group.icon}</span>
                  {showLabels && (
                    <>
                      <span className="flex-1 text-sm font-medium font-display">{group.label}</span>
                      {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </>
                  )}
                </button>
                {showLabels && (
                  <div className={`ml-4 pl-3 border-l border-slate-700 mb-1 collapsible ${expanded ? 'open' : ''}`}>
                    {group.items.map(item => (
                      <button
                        key={item.id}
                        onClick={() => navigate(item.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left cursor-pointer mb-0.5
                          ${currentPage === item.id
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                      >
                        <span className="shrink-0">{item.icon}</span>
                        <span className="text-sm font-display">{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          }
          const item = entry as NavItem
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left cursor-pointer mb-0.5
                ${currentPage === item.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
              title={showLabels ? undefined : item.label}
            >
              <span className="shrink-0">{item.icon}</span>
              {showLabels && <span className="text-sm font-medium font-display">{item.label}</span>}
            </button>
          )
        })}
      </nav> 
    </div>
    )
  }

  const appShellVisible = !authLoading || Boolean(user)
  const shouldShowLogin = currentPage === 'login' || (!user && !authLoading)

  return (
      <AppContext.Provider value={{
        currentPage,
        navigate,
        showToast,
        user,
        setUser,
        authLoading,
        logout: async () => { try { await authClient.signOut() } catch {} setUser(null); navigate('login') },
        inventoryItems,
        setInventoryItems,
        productionStock,
        setProductionStock,
        kitchenStock,
        setKitchenStock,
        salesRecords,
        setSalesRecords,
        expenses,
        setExpenses,
        stockTransactions,
        transferToKitchen,
        kitchenSelfProduce,
        sellMenuItem,
        activePayrollPeriod,
        setActivePayrollPeriod,
        appMode,
        setAppMode,
        logoSrc,
        openEmployee,
        clearOpenEmployee,
        openEmployeeId,
      }}>
        <>
          {authLoading && !user ? (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700">
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
                <span className="text-sm font-medium">Loading account…</span>
              </div>
            </div>
          ) : shouldShowLogin ? (
            <Login />
          ) : (
            <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-800">
              {!isMobileView && (
                <aside className="flex flex-col bg-slate-900 shrink-0 transition-all duration-300 ease-in-out w-60">
                  <SidebarContent />
                </aside>
              )}

              {isMobileView && (
                <>
                  <div
                    className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ease-in-out ${
                      mobileSidebarOpen
                        ? 'opacity-100 pointer-events-auto'
                        : 'opacity-0 pointer-events-none'
                    }`}
                    onClick={() => setMobileSidebarOpen(false)}
                    aria-hidden="true"
                  />

                  <aside
                    className={`fixed right-0 top-0 bottom-0 z-50 w-60 bg-slate-900 flex flex-col will-change-transform transition-transform duration-300 ease-in-out ${
                      mobileSidebarOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
                  >
                    <SidebarContent />
                  </aside>
                </>
              )}

              <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
                <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3.5 flex items-center gap-4 shrink-0 z-30">
                  {!isMobileView ? (
                    <div>
                      <h1 className="text-base font-bold text-slate-800 leading-tight font-display">{meta.title}</h1>
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        {meta.breadcrumbs.map((crumb, i) => (
                          <span key={i} className="flex items-center gap-1">
                            {i > 0 && <ChevronRight size={10} />}
                            <span>{crumb}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <img src={logoSrc} alt={appMode === 'aroo' ? 'Aroo' : 'Lakay Ago'} className="w-12 h-12 object-contain rounded-sm" />
                      <div className="flex flex-col">
                        <span className="text-base font-bold text-slate-800 leading-tight font-display">
                          {appMode === 'aroo' ? 'Aroo' : 'Lakay Ago'}
                        </span>
                        <span className="text-xs text-slate-500 leading-tight">
                          Attendance & Payroll System
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex-1" />
                  <div className="flex items-center gap-3">
                    <RealtimeStatusPill />

                    <div className="relative">
                      <button
                        onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false) }}
                        className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
                      >
                        <Bell size={18} />
                        {notifications.filter(n => !n.read).length > 0 ? (
                          <span className="absolute -top-1 -right-1 min-w-[18px] h-5 px-1.5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{notifications.filter(n => !n.read).length}</span>
                        ) : (
                          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full opacity-0" />
                        )}
                      </button>

                      {notifMounted && (
                        <div className={`absolute right-0 top-11 w-[min(82vw,20rem)] bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden dropdown ${notifVisible ? 'show' : 'closing'}`}>
                          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                            <span className="font-semibold text-sm font-display text-slate-800">Notifications</span>
                            <button
                              onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                              className="text-xs text-slate-500 hover:text-slate-700"
                            >
                              Mark all read
                            </button>
                          </div>

                          {notifications.length === 0 ? (
                            <div className="px-4 py-4 text-sm text-slate-500">No notifications</div>
                          ) : (
                            notifications.map((n) => (
                              <div
                                key={n.id}
                                onClick={() => {
                                  setNotifications(prev => prev.map(p => p.id === n.id ? { ...p, read: true } : p))
                                  if (n.href) { try { navigate((n.href as unknown) as any); } catch {} }
                                }}
                                className={`px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 cursor-pointer ${n.read ? 'opacity-60' : ''}`}>
                                <p className="text-sm text-slate-700">{n.msg}</p>
                                <p className="text-xs text-slate-400 mt-0.5">{n.time || 'now'}</p>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {!isMobileView && (
                      <div className="relative">
                        <button
                          onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false) }}
                          className="flex items-center gap-2 rounded-lg hover:bg-slate-100 px-2 py-1.5 cursor-pointer"
                        >
                          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center">
                            <span className="text-white text-xs font-bold font-display">
                              {user ? (user.name || '').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : '...'}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-slate-700 font-display">
                            {user?.name || 'Loading...'}
                          </span>
                        </button>
                      </div>
                    )}

                    {isMobileView && (
                      <button
                        className="text-slate-500 hover:text-slate-700 cursor-pointer"
                        onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
                      >
                        <Menu size={20} />
                      </button>
                    )}
                  </div>
                </header>

                <main className="flex-1 overflow-y-auto">
                  {renderPage()}
                </main>
              </div>
            </div>
          )}

          <Modal
            open={showModeConfirmation}
            onClose={() => { setShowModeConfirmation(false); setModeLocked(false) }}
          >
          <div className="w-[min(24rem,80vw)] px-1 py-3 text-center">
            <div className="mb-4 flex justify-center">
              <img
                src={logoSrc}
                alt={appMode === 'aroo' ? 'Aroo logo' : 'Lakay Ago logo'}
                className="h-64 w-64 min-h-16 min-w-16 rounded-lg object-contain"
              />
            </div>
            <div className="mt-2">
              <p className="text-sm font-medium text-slate-500 font-display">
                You are now in
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-800 font-display">
                {appMode === 'aroo'
                  ? 'Aroo Management System'
                  : 'Lakay Ago Management System'}
              </p>
            </div>
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => { setShowModeConfirmation(false); setModeLocked(false) }}
                className="w-md rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 font-display"
              >
                Continue
              </button>
            </div>
          </div>
        </Modal>

        {/* Global interaction blocker while switching app mode */}
        {modeLocked && (
          <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 90, pointerEvents: 'auto' }} />
        )}

        <Modal open={profileOpen} title="Profile" onClose={() => {
          setProfileOpen(false)
          setIsEditingProfile(false)
        }}>
          <div className="flex items-start justify-between gap-3 w-full">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center">
                <span className="text-white text-sm font-bold font-display">
                  {user ? (user.name || '').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : '...'}
                </span>
              </div>
              <div>
                <p className="font-semibold text-slate-800">
                  {user?.name || 'Loading...'}
                </p>
                <p className="text-xs text-slate-500">{user?.email || ''}</p>
              </div>
            </div>
          </div>

          <form className="mt-4 space-y-4" onSubmit={e => { e.preventDefault(); setIsEditingProfile(false) }}>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col text-sm">
                <span className="text-slate-600 mb-1">First Name</span>
                <input
                  value={profileForm.firstName}
                  onChange={e => setProfileForm(p => ({ ...p, firstName: e.target.value }))}
                  disabled={!isEditingProfile}
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                />
              </label>

              <label className="flex flex-col text-sm">
                <span className="text-slate-600 mb-1">Last Name</span>
                <input
                  value={profileForm.lastName}
                  onChange={e => setProfileForm(p => ({ ...p, lastName: e.target.value }))}
                  disabled={!isEditingProfile}
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col text-sm">
                <span className="text-slate-600 mb-1">Role</span>
              <select
                 value={profileForm.role}
                 onChange={e => setProfileForm(p => ({ ...p, role: e.target.value }))}
                 disabled={!isEditingProfile}
                 className="rounded-md border border-slate-200 px-3 py-2 text-sm"
               >
                 <option value="Super Admin">Super Admin</option>
                 <option value="Admin">Admin</option>
                 <option value="Staff">Staff</option>
               </select>
              </label>
              <label className="flex flex-col text-sm">
                <span className="text-slate-600 mb-1">Email</span>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={e => setProfileForm(p => ({ ...p, email: e.target.value }))}
                  disabled={!isEditingProfile}
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="gap-3">
              <label className="flex flex-col text-sm">
                <span className="text-slate-600 mb-1">Password</span>
                <input
                  type="password"
                  value={profileForm.password}
                  placeholder={`${isEditingProfile ? 'Enter new password' : '********'}`}
                  onChange={e => setProfileForm(p => ({ ...p, password: e.target.value }))}
                  disabled={!isEditingProfile}
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await authClient.signOut()
                    } catch (err) {}
                    setUser(null)
                    setProfileOpen(false)
                    showToast({ type: 'info', message: 'Signed out' })
                    navigate('login')
                  }}
                  className="rounded-md px-3 py-2 text-sm text-white bg-red-600 border hover:bg-red-700 shadow-sm cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
              <div className="flex items-center gap-2">
                {isEditingProfile && (
                  <button
                    type="button"
                    onClick={() => {
                      if (user) {
                        const nameParts = (user.name || '').split(' ')
                        setProfileForm({
                          firstName: nameParts[0] || '',
                          lastName: nameParts.slice(1).join(' ') || '',
                          contactNumber: '',
                          role: user.role === 'SuperAdmin' ? 'Super Admin' : user.role || '',
                          email: user.email || '',
                          password: '',
                        })
                      }
                      setIsEditingProfile(false)
                    }}
                    className="rounded-md px-3 py-2 text-sm text-white bg-red-600 border hover:bg-red-700 shadow-sm cursor-pointer"
                  >
                    Cancel
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsEditingProfile(prev => !prev)}
                  title="Toggle edit"
                  className="rounded-md px-3 py-2 text-sm text-white bg-green-600 hover:bg-green-700 shadow-sm cursor-pointer"
                >
                  {isEditingProfile ? 'Save Changes' : 'Edit'}
                </button>
              </div>
            </div>
          </form>
        </Modal>

        <ToastContainer toasts={toasts} removeToast={removeToast} />

        {(profileOpen || notifOpen) && (
          <div className="fixed inset-0 z-40" onClick={() => { setProfileOpen(false); setNotifOpen(false) }} />
        )}
      </>
    </AppContext.Provider>
  )
}
