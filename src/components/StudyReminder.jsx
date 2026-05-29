import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { registerServiceWorker, subscribeToPush } from '../lib/pushNotifications'

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']

export default function StudyReminder() {
  const [banner, setBanner] = useState(null)
  const [notifEnabled, setNotifEnabled] = useState(true)
  const timerRef = useRef(null)
  const swInitRef = useRef(false)

  const checkUpcoming = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return

    const { data: settings } = await supabase.from('user_settings').select('reminder_time,push_notifications').eq('user_id', session.user.id).maybeSingle()
    if (settings?.reminder_time === null || settings?.reminder_time === false) {
      setNotifEnabled(false)
      return
    }
    setNotifEnabled(true)

    if (!swInitRef.current && settings?.push_notifications) {
      swInitRef.current = true
      const reg = await registerServiceWorker()
      if (reg) subscribeToPush(reg)
    }

    const now = new Date()
    const today = now.getDay()
    const currentHour = now.getHours()
    const currentMin = now.getMinutes()
    const currentTotalMin = currentHour * 60 + currentMin

    const { data: tasks } = await supabase
      .from('study_plans')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('done', false)
      .eq('day_of_week', today)

    if (!tasks?.length) return

    for (const task of tasks) {
      if (!task.time_slot) continue

      const [h, m] = task.time_slot.split(':').map(Number)
      const taskTotalMin = h * 60 + m
      const diffMin = taskTotalMin - currentTotalMin

      if (diffMin > 0 && diffMin <= 120) {
        const bannerKey = `remind_${task.id}`
        if (sessionStorage.getItem(bannerKey)) continue

        setBanner({ task, minutes: diffMin })

        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Study Reminder', {
            body: `${task.activity} — ${task.duration} in ~${diffMin} min`,
            icon: '/favicon.ico'
          })
        }
        break
      }
    }
  }, [])

  const dismissBanner = () => {
    if (banner) {
      const key = `remind_${banner.task.id}`
      sessionStorage.setItem(key, '1')
      setBanner(null)
    }
  }

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    checkUpcoming()
    timerRef.current = setInterval(checkUpcoming, 60000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  if (!banner || !notifEnabled) return null

  const dayLabel = DAYS[banner.task.day_of_week] || ''
  const [h, m] = (banner.task.time_slot || '00:00').split(':')
  const timeStr = `${h}:${m}`

  return (
    <div className="reminder-banner">
      <div className="reminder-content">
        <span className="reminder-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </span>
        <span className="reminder-text">
          <strong>{banner.task.activity}</strong> in ~{banner.minutes} min — {dayLabel} at {timeStr} ({banner.task.duration})
        </span>
        <button className="reminder-close" onClick={dismissBanner}>&times;</button>
      </div>
    </div>
  )
}
