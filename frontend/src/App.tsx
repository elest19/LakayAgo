import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react'
import type { Page, Toast, AppContextType, InventoryItem, SaleRecord, ExpenseRecord, PayrollPeriod } from './types'
import useIsMobile from './hooks/isMobile'
import {
  LayoutDashboard, Users, ClipboardList, Upload, History,
  CalendarDays, Cog, FileText, LogOut, ChevronDown, ChevronRight,
  Bell, Search, Menu, X, CheckCircle, AlertCircle, AlertTriangle, Info,
  CreditCard, BookOpen, Settings, ClipboardCheck, UserCheck, BarChart3, ShoppingCart, Wallet, Package2
} from 'lucide-react'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import AttendanceRecords from './pages/AttendanceRecords'
import ImportAttendance from './pages/ImportAttendance'
import ImportHistory from './pages/ImportHistory'
import PayrollPeriods from './pages/PayrollPeriods'
import PayrollHistory from './pages/PayrollHistory'
import ProcessPayroll from './pages/ProcessPayroll'
import Payslips from './pages/Payslips'
import LeaveManagement from './pages/LeaveManagement'
import Reports from './pages/Reports'
import SettingsPage from './pages/Settings'
import AuditLogs from './pages/AuditLogs'
import SalesSummary from './pages/SalesSummary.tsx'
import Sales from './pages/Sales'
import InventoryCatalog from './pages/InventoryCatalog'
import Expenses from './pages/Expenses'
// Use the public copy of the logo (served at /LakayAgo_Logo.jpg)
import Modal from './components/Modal'
import isMobile from './hooks/isMobile'
import { inventoryCatalog, salesRecords as initialSalesRecords, expenseRecords as initialExpenses } from './data/mockData'

const AppContext = createContext<AppContextType>({
  currentPage: 'dashboard',
  navigate: () => {},
  showToast: () => {},
  inventoryItems: [],
  setInventoryItems: () => {},
  salesRecords: [],
  setSalesRecords: () => {},
  expenses: [],
  setExpenses: () => {},
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
      { id: 'process-payroll', label: 'Process Payroll', icon: <Cog size={16} /> },
      { id: 'payslips', label: 'Payslips', icon: <FileText size={16} /> },
    ],
  },
  {
    type: 'group',
    label: 'Sales & Expenses',
    icon: <ShoppingCart size={18} />,
    items: [
      { id: 'sales-summary', label: 'Summary Report', icon: <BarChart3 size={16} /> },
      { id: 'sales', label: 'Sales', icon: <Wallet size={16} /> },
      { id: 'inventory-catalog', label: 'Inventory Catalog', icon: <Package2 size={16} /> },
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
  'process-payroll': { title: 'Process Payroll', breadcrumbs: ['Payroll', 'Process'] },
  payslips: { title: 'Payslips', breadcrumbs: ['Payroll', 'Payslips'] },
  'leave-management': { title: 'Leave Management', breadcrumbs: ['Leave Management'] },
  'sales-summary': { title: 'Sales & Expenses', breadcrumbs: ['Sales & Expenses', 'Summary Report'] },
  sales: { title: 'Sales & Expenses', breadcrumbs: ['Sales & Expenses', 'Sales'] },
  'inventory-catalog': { title: 'Sales & Expenses', breadcrumbs: ['Sales & Expenses', 'Inventory Catalog'] },
  expenses: { title: 'Sales & Expenses', breadcrumbs: ['Sales & Expenses', 'Expenses'] },
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

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const isMobileView = useIsMobile()
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(inventoryCatalog)
  const [salesRecords, setSalesRecords] = useState<SaleRecord[]>(initialSalesRecords)
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(initialExpenses)
  const [activePayrollPeriod, setActivePayrollPeriod] = useState<PayrollPeriod | null>(null)
  const [appMode, setAppMode] = useState<'aroo' | 'lakayAgo'>('lakayAgo')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const themeToggleRef = useRef<HTMLButtonElement>(null)
  const logoSrc = appMode === 'aroo' ? '/Aroo_Logo.jpg' : '/logo.jpg'
  const [toasts, setToasts] = useState<Toast[]>([])
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifMounted, setNotifMounted] = useState(false)
  const [notifVisible, setNotifVisible] = useState(false)
  const [showModeConfirmation, setShowModeConfirmation] = useState(false)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({
    firstName: 'Eduardo',
    lastName: 'Mendoza',
    contactNumber: '+63 912 345 6789',
    role: 'Super Admin',
    email: 'lakay.ago@restaurant.ph',
    password: 'secret',
  })

  useEffect(() => {
    const favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement | null
    const appleIcon = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement | null

    if (favicon) favicon.href = logoSrc
    if (appleIcon) appleIcon.href = logoSrc
    document.title = appMode === 'aroo' ? 'Aroo' : 'Lakay Ago'
    console.log('appMode changed:', appMode)
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

  const navigate = useCallback((page: Page) => {
    setCurrentPage(page)
    setMobileSidebarOpen(false)
  }, [])

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}`
    setToasts(prev => [...prev, { ...toast, id }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toggleAppMode = useCallback((nextMode: 'aroo' | 'lakayAgo') => {
    if (isMobileView) {
      setMobileSidebarOpen(false)
    }

    if (!themeToggleRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setAppMode(nextMode)
      setShowModeConfirmation(true)
      return
    }

    const rect = themeToggleRef.current.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    )

    const overlay = document.createElement('div')
    overlay.style.position = 'fixed'
    overlay.style.inset = '0'
    overlay.style.zIndex = '9999'
    overlay.style.pointerEvents = 'none'
    overlay.style.background = '#16a34a'
    overlay.style.clipPath = `circle(0px at ${x}px ${y}px)`
    overlay.style.opacity = '1'
    document.body.appendChild(overlay)

    setAppMode(nextMode)

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
      },
    )

    expand.onfinish = () => {
      setShowModeConfirmation(true)

      const fade = overlay.animate(
        { opacity: [1, 0] },
        { duration: isMobileView ? 500 : 800, easing: 'ease-out', fill: 'forwards' },
      )

      fade.onfinish = () => {
        overlay.remove()
      }
    }
  }, [])

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
      case 'process-payroll': return <ProcessPayroll />
      case 'payslips': return <Payslips />
      case 'leave-management': return <LeaveManagement />
      case 'sales-summary': return <SalesSummary />
      case 'sales': return <Sales />
      case 'inventory-catalog': return <InventoryCatalog />
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
            <span className="text-white text-xs font-bold font-display">EM</span>
          </div>
          {showLabels && (
            <div className="text-start min-w-0">
              <p className="text-sm font-semibold text-white truncate font-display">Eduardo Mendoza</p>
              <p className="text-xs text-slate-400 truncate">Super Admin</p>
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
        {showLabels && (
          <div>
            <button
              ref={themeToggleRef}
              type="button"
              onClick={() => toggleAppMode(appMode === 'aroo' ? 'lakayAgo' : 'aroo')}
              className="mb-3 w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left cursor-pointer text-slate-100 bg-green-800 hover:text-white hover:bg-green-600 transition-colors"
            >
              <img
                src={logoSrc}
                alt={appMode === 'aroo' ? 'Lakay Ago logo' : 'Aroo logo'}
                className="w-6 h-6 object-contain rounded-sm"
              />
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

  return (
    <AppContext.Provider value={{ currentPage, navigate, showToast, inventoryItems, setInventoryItems, salesRecords, setSalesRecords, expenses, setExpenses, activePayrollPeriod, setActivePayrollPeriod, appMode, setAppMode, logoSrc, openEmployee, clearOpenEmployee, openEmployeeId }}>
      <>
        {currentPage === 'login' ? (
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
                  <div className="relative">
                    <button
                      onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false) }}
                      className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
                    >
                      <Bell size={18} />
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                    </button>

                    {notifMounted && (
                      <div className={`absolute right-0 top-11 w-[min(82vw,20rem)] bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden dropdown ${notifVisible ? 'show' : 'closing'}`}>
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                          <span className="font-semibold text-sm font-display text-slate-800">Notifications</span>
                          <span className="text-xs bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5 font-medium">4 new</span>
                        </div>
                        {[
                          { msg: '2 employees have missing attendance', time: '10 min ago', type: 'warning' },
                          { msg: 'Payroll calculation ready for review', time: '1 hr ago', type: 'info' },
                          { msg: 'Attendance import completed', time: '2 hrs ago', type: 'success' },
                          { msg: 'Leave request from Carlo Mendoza', time: '1 day ago', type: 'info' },
                        ].map((n, i) => (
                          <div key={i} className="px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 cursor-pointer">
                            <p className="text-sm text-slate-700">{n.msg}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{n.time}</p>
                          </div>
                        ))}
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
                          <span className="text-white text-xs font-bold font-display">EM</span>
                        </div>
                        <span className="text-sm font-medium text-slate-700 font-display">Admin</span>
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
          onClose={() => setShowModeConfirmation(false)}
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
                onClick={() => setShowModeConfirmation(false)}
                className="w-md rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 font-display"
              >
                Continue
              </button>
            </div>
          </div>
        </Modal>

        <Modal open={profileOpen} title="Profile" onClose={() => {
          setProfileOpen(false)
          setIsEditingProfile(false)
        }}>
          <div className="flex items-start justify-between gap-3 w-full">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center">
                <span className="text-white text-sm font-bold font-display">EM</span>
              </div>
              <div>
                <p className="font-semibold text-slate-800">
                  {profileForm.firstName} {profileForm.lastName}
                </p>
                <p className="text-xs text-slate-500">{profileForm.email}</p>
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
                <span className="text-slate-600 mb-1">Contact Number</span>
                <input
                  value={profileForm.contactNumber}
                  onChange={e => setProfileForm(p => ({ ...p, contactNumber: e.target.value }))}
                  disabled={!isEditingProfile}
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
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
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
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
              <label className="flex flex-col text-sm">
                <span className="text-slate-600 mb-1">Password</span>
                <input
                  type="password"
                  value={profileForm.password}
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
                  onClick={() => { navigate('login'); setProfileOpen(false); showToast({ type: 'info', message: 'Signed out' }) }}
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
                      setProfileForm({
                        firstName: 'Eduardo',
                        lastName: 'Mendoza',
                        contactNumber: '+63 912 345 6789',
                        role: 'Super Admin',
                        email: 'eduardo.mendoza@company.ph',
                        password: 'secret',
                      })
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
