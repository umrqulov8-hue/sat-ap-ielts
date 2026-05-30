import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { createContext, useContext, useState, useRef, useEffect } from 'react'
import Sidebar from './Sidebar'
import CalendarModal from './CalendarModal'
import StudyReminder from './StudyReminder'
import NotificationBell from './NotificationBell'
import { UserProvider } from '../context/UserContext'
import { ToastProvider } from './Toast'
import { supabase } from '../lib/supabaseClient'

const LayoutCtx = createContext()
export const useLayout = () => useContext(LayoutCtx)

export default function DashLayout() {
  const navigate = useNavigate()
  const [calActive, setCalActive] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pageTitle, setPageTitle] = useState('')
  const [pageSub, setPageSub] = useState('')
  const [pageClass, setPageClass] = useState('')
  const dateRef = useRef(null)
  const location = useLocation()
  const pageKey = useRef(location.key)
  if (location.key !== pageKey.current) pageKey.current = location.key

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate('/', { replace: true })
    })
  }, [])

  const today = new Date()
  const dateStr = `${today.toLocaleString('en-US', { month: 'long' }).toUpperCase()} ${today.getDate()}, ${today.getFullYear()}`

  useEffect(() => { window.scrollTo(0, 0) }, [location.pathname])
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} — SATAP Academy` : 'SATAP Academy'
    let meta = document.querySelector('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'description'
      document.head.appendChild(meta)
    }
    meta.content = pageTitle ? `${pageTitle} — SAT va AP imtihonlariga tayyorlanish` : 'SATAP Academy — SAT va AP imtihonlariga tayyorlanish platformasi'
  }, [pageTitle])

  return (
    <UserProvider>
      <ToastProvider>
      <LayoutCtx.Provider value={{ setPageTitle, setPageSub, setPageClass }}>
        <div className={`dash-layout${pageClass ? ` ${pageClass}` : ''}${mobileOpen ? ' mobile-open' : ''}`}>
          <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />
          <Sidebar />
          <StudyReminder />
          <main className="dash-main">
            <header className="dash-header">
              <div className="header-left">
                <button className="hamburger" onClick={() => setMobileOpen(o => !o)} aria-label="Menu">
                  <span /><span /><span />
                </button>
                <h1 className="header-title">{pageTitle || 'DASHBOARD'}</h1>
                <p className="header-sub">{pageSub || 'Welcome back'}</p>
              </div>
              <div className="header-right">
                <NotificationBell />
                <span
                  ref={dateRef}
                  className={`header-date small-caps${calActive ? ' hidden' : ''}`}
                  onClick={() => setCalActive(true)}
                >
                  {dateStr}
                </span>
              </div>
            </header>
            <div key={pageKey.current} className="page-content">
              <Outlet />
            </div>
          </main>
          <CalendarModal active={calActive} onClose={() => setCalActive(false)} dateRef={dateRef} />
        </div>
      </LayoutCtx.Provider>
      </ToastProvider>
    </UserProvider>
  )
}
