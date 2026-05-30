import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useUser } from '../context/UserContext'

export default function NotificationBell() {
  const { profile } = useUser()
  const uid = profile?.id
  const [notifs, setNotifs] = useState([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)

  useEffect(() => {
    if (!uid) return
    const load = async () => {
      const { data } = await supabase.from('notifications').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(20)
      if (data) { setNotifs(data); setUnread(data.filter(n => !n.read).length) }
    }
    load()
    const sub = supabase.channel('notif-' + uid).on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + uid },
      (payload) => {
        setNotifs(prev => [payload.new, ...prev])
        setUnread(prev => prev + 1)
      }
    ).subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [uid])

  useEffect(() => {
    const handle = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const markRead = async (id) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnread(prev => Math.max(0, prev - 1))
  }

  const markAllRead = async () => {
    await supabase.from('notifications').update({ read: true }).eq('user_id', uid).eq('read', false)
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    setUnread(0)
  }

  if (!uid) return null

  return (
    <div className="notif-bell" ref={panelRef} style={{ position: 'relative' }}>
      <button className="notif-bell-btn" onClick={() => setOpen(!open)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && <span className="notif-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-panel-header">
            <span className="notif-panel-title">Notifications</span>
            {unread > 0 && <button className="notif-mark-all" onClick={markAllRead}>Mark all read</button>}
          </div>
          <div className="notif-list">
            {notifs.length === 0 ? (
              <div className="notif-empty">No notifications</div>
            ) : (
              notifs.map(n => (
                <div key={n.id} className={'notif-item' + (n.read ? '' : ' unread')} onClick={() => markRead(n.id)}>
                  <div className="notif-item-title">{n.title}</div>
                  <div className="notif-item-body">{n.body}</div>
                  <div className="notif-item-time">{new Date(n.created_at).toLocaleDateString()}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
