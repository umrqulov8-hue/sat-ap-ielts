import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useUser } from '../context/UserContext'

const ROUTE_PREFETCH = {
  '/dashboard': () => import('../pages/Dashboard'),
  '/sat-math': () => import('../pages/SatMath'),
  '/sat-rw': () => import('../pages/SatRW'),
  '/ap-bio': () => import('../pages/ApBio'),
  '/ap-calc': () => import('../pages/ApCalc'),
  '/practice-tests': () => import('../pages/PracticeTests'),
  '/practice/sat-tests': () => import('../pages/SatTestList'),
  '/test-history': () => import('../pages/TestHistory'),
  '/study-plan': () => import('../pages/StudyPlan'),
  '/profile': () => import('../pages/Profile'),
  '/settings': () => import('../pages/Settings'),
  '/support': () => import('../pages/Support'),
}

const NAV_ITEMS = [
  {
    section: null,
    items: [{ label: 'DASHBOARD', path: '/dashboard', icon: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>' }]
  },
  {
    section: 'SAT',
    items: [
      { label: 'SAT MATH', path: '/sat-math', icon: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>', badge: '12 TESTS' },
      { label: 'SAT R&W', path: '/sat-rw', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>', badge: '10 TESTS' }
    ]
  },
  {
    section: 'AP',
    items: [
      { label: 'AP BIO', path: '/ap-bio', icon: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>', badge: '15 TESTS' },
      { label: 'AP CALC', path: '/ap-calc', icon: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>', badge: '8 TESTS' }
    ]
  },
  {
    section: 'PRACTICE',
    items: [
      { label: 'PRACTICE TESTS', path: '/practice-tests', icon: '<path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/>' },
      { label: 'SAT TESTS', path: '/practice/sat-tests', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>' },
      { label: 'TEST HISTORY', path: '/test-history', icon: '<path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 5-5"/>' },
      { label: 'STUDY PLAN', path: '/study-plan', icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' }
    ]
  }
]

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const currentPath = location.pathname
  const { profile, isAdmin, isOwner } = useUser()

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await supabase.auth.signOut()
      navigate('/')
    }
  }

  const initials = profile?.display_name
    ? profile.display_name.charAt(0).toUpperCase()
    : 'S'

  const prefetch = useCallback((path) => {
    const fn = ROUTE_PREFETCH[path]
    if (fn) fn()
  }, [])

  return (
    <aside className="dash-sidebar">
      <div className="sidebar-header">
        <Link to="/dashboard" className="sidebar-logo-wrap">
          <div className="sidebar-logo-icon"><span>S</span></div>
          <span className="sidebar-logo-text">SATAP</span>
        </Link>
        <span className="sidebar-badge">ACADEMY</span>
      </div>

      <div className="sidebar-scroll">
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((group, gi) => (
            <div key={gi} className={group.section ? 'nav-section' : ''}>
              {group.section && (
                <span className="nav-section-label">{group.section}</span>
              )}
              {group.items.map((item) => {
                const isActive = currentPath === item.path
                const isHash = item.path === '#'
                return (
                  <div key={item.label} className="snav-wrap">
                    {isHash ? (
                      <span className={`snav-item${isActive ? ' active' : ''}`}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" dangerouslySetInnerHTML={{ __html: item.icon }} />
                        {item.label}
                        {item.badge && <span className="snav-badge">{item.badge}</span>}
                      </span>
                    ) : (
                      <Link
                        to={item.path}
                        className={`snav-item${isActive ? ' active' : ''}`}
                        onMouseEnter={() => prefetch(item.path)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" dangerouslySetInnerHTML={{ __html: item.icon }} />
                        <span>{item.label}</span>
                        {item.badge && <span className="snav-badge">{item.badge}</span>}
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          <div className="snav-divider" />

          <div className="nav-section">
            <span className="nav-section-label">ACCOUNT</span>
            <div className="snav-wrap">
              <Link to="/settings" className={`snav-item${currentPath === '/settings' ? ' active' : ''}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                SETTINGS
              </Link>
            </div>
            <div className="snav-wrap">
              <Link to="/support" className={`snav-item${currentPath === '/support' ? ' active' : ''}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                SUPPORT
              </Link>
            </div>
            {(isAdmin || isOwner) ? <><div className="snav-wrap">
                <Link to="/admin/questions" className={'snav-item' + (currentPath === '/admin/questions' ? ' active' : '')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                  ADMIN
                </Link></div>
                <div className="snav-wrap">
                <Link to="/admin/sat-tests" className={'snav-item' + (currentPath === '/admin/sat-tests' ? ' active' : '')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  TEST ADMIN
                </Link></div></>
              : null}
          </div>
        </nav>
      </div>

      <div className="sidebar-footer">
        <Link to="/profile" className="sidebar-user">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <span className="user-name">{(profile?.display_name || 'STUDENT').toUpperCase()}</span>
            <span className="user-plan small-caps">{(profile?.plan_type || 'FREE') + ' PLAN'}</span>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
        </Link>
        <div className="snav-wrap">
          <button className="snav-item logout" onClick={handleLogout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            LOGOUT
          </button>
        </div>
      </div>
    </aside>
  )
}
