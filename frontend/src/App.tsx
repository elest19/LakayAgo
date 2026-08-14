import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import type { Page, Toast, AppContextType } from './types'
import useIsMobile from './hooks/isMobile'
import {
  LayoutDashboard, Users, ClipboardList, Upload, History,
  CalendarDays, Cog, FileText, LogOut, ChevronDown, ChevronRight,
  Bell, Search, Menu, X, CheckCircle, AlertCircle, AlertTriangle, Info,
  CreditCard, BookOpen, Settings, ClipboardCheck, UserCheck, BarChart3
} from 'lucide-react'

import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import AttendanceRecords from './pages/AttendanceRecords'
import ImportAttendance from './pages/ImportAttendance'
import ImportHistory from './pages/ImportHistory'
import PayrollPeriods from './pages/PayrollPeriods'
import ProcessPayroll from './pages/ProcessPayroll'
import Payslips from './pages/Payslips'
import LeaveManagement from './pages/LeaveManagement'
import Reports from './pages/Reports'
import SettingsPage from './pages/Settings'
import AuditLogs from './pages/AuditLogs'
// Use the public copy of the logo (served at /LakayAgo_Logo.jpg)
import Modal from './components/Modal'

const AppContext = createContext<AppContextType>({
  currentPage: 'dashboard',
  navigate: () => {},
  showToast: () => {},
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
  { id: 'leave-management', label: 'Leave Management', icon: <UserCheck size={18} /> },
  { id: 'reports', label: 'Reports', icon: <BarChart3 size={18} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={18} /> },
  { id: 'audit-logs', label: 'Audit Logs', icon: <BookOpen size={18} /> },
]

const pageMeta: Record<Page, { title: string; breadcrumbs: string[] }> = {
  dashboard: { title: 'Dashboard', breadcrumbs: ['Dashboard'] },
  employees: { title: 'Employees', breadcrumbs: ['Employees'] },
  'attendance-records': { title: 'Attendance Records', breadcrumbs: ['Attendance', 'Records'] },
  'import-attendance': { title: 'Import Attendance', breadcrumbs: ['Attendance', 'Import'] },
  'import-history': { title: 'Import History', breadcrumbs: ['Attendance', 'Import History'] },
  'payroll-periods': { title: 'Payroll Periods', breadcrumbs: ['Payroll', 'Periods'] },
  'process-payroll': { title: 'Process Payroll', breadcrumbs: ['Payroll', 'Process'] },
  payslips: { title: 'Payslips', breadcrumbs: ['Payroll', 'Payslips'] },
  'leave-management': { title: 'Leave Management', breadcrumbs: ['Leave Management'] },
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
    <div className="fixed bottom-6 right-6 z-999 flex flex-col gap-3 max-w-sm w-full">
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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Attendance', 'Payroll']))
  const [toasts, setToasts] = useState<Toast[]>([])
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifMounted, setNotifMounted] = useState(false)
  const [notifVisible, setNotifVisible] = useState(false)
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
      case 'dashboard': return <Dashboard />
      case 'employees': return <Employees />
      case 'attendance-records': return <AttendanceRecords />
      case 'import-attendance': return <ImportAttendance />
      case 'import-history': return <ImportHistory />
      case 'payroll-periods': return <PayrollPeriods />
      case 'process-payroll': return <ProcessPayroll />
      case 'payslips': return <Payslips />
      case 'leave-management': return <LeaveManagement />
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
                <img src="/LakayAgo_Logo.jpg" alt="Lakay Ago" className="w-12 h-12 object-contain rounded-sm" />
                <div className="flex flex-col">
                  <span className="text-base font-bold text-white leading-tight font-display">
                    Lakay Ago
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
    <AppContext.Provider value={{ currentPage, navigate, showToast, openEmployee, clearOpenEmployee, openEmployeeId }}>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        {/* Desktop Sidebar */}
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

          {/* Drawer */}
          <aside
            className={`fixed right-0 top-0 bottom-0 z-50 w-60 bg-slate-900 flex flex-col will-change-transform transition-transform duration-300 ease-in-out ${
              mobileSidebarOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <SidebarContent />
          </aside>
        </>
      )}

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3.5 flex items-center gap-4 shrink-0 z-30">
          {/* Top Header */}
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
                <img src="/LakayAgo_Logo.jpg" alt="Lakay Ago" className="w-12 h-12 object-contain rounded-sm" />
                <div className="flex flex-col">
                  <span className="text-base font-bold text-slate-800 leading-tight font-display">
                    Lakay Ago
                  </span>
                  <span className="text-xs text-slate-500 leading-tight">
                    Attendance & Payroll System
                  </span>
                </div>
              </div>
            )}

            <div className="flex-1" />
              <div className="flex items-center gap-3"> 
              {/* Notifications */}
                <div className="relative">
                  <button
                    onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false) }}
                    className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
                  >
                    <Bell size={18} />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                  </button>
                  
                  {notifMounted && (
                    <div className={`absolute right-0 top-11 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden dropdown ${notifVisible ? 'show' : 'closing'}`}>
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
                <>
                {/* Profile */}
                <div className="relative">
                  <button
                    onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false) }}
                    className="flex items-center gap-2 rounded-lg hover:bg-slate-100 px-2 py-1.5 cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center">
                      <span className="text-white text-xs font-bold font-display">EM</span>
                    </div>
                    
                      <>
                        <span className="text-sm font-medium text-slate-700 font-display">Admin</span>
                      </>    
                  </button>
                </div>
                </>
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

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto">
            {renderPage()}
          </main>
        </div>

        <Modal open={profileOpen} title={`Profile`} onClose={() => { setProfileOpen(false); setIsEditingProfile(false) }}>
          <div className="flex items-start justify-between gap-3">
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
                  onChange={e =>
                    setProfileForm(p => ({ ...p, role: e.target.value }))
                  }
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
                  onClick={() => { /* keep your existing sign-out handler here */ }}
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
                      // cancel edits: reset to original (optional - adjust if you have a persisted source)
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

        {/* Close dropdowns on outside click */}
        {(profileOpen || notifOpen) && (
          <div className="fixed inset-0 z-40" onClick={() => { setProfileOpen(false); setNotifOpen(false) }} />
        )}
      </div>
    </AppContext.Provider>
  )
}
