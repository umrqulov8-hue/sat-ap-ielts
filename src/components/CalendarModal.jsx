import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']

function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function CalendarModal({ active, onClose, dateRef }) {
  const [month, setMonth] = useState(new Date().getMonth())
  const [year, setYear] = useState(new Date().getFullYear())
  const [selectedDate, setSelectedDate] = useState(null)
  const [loginDates, setLoginDates] = useState([])
  const wrapRef = useRef(null)

  const loadLoginDates = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    const { data } = await supabase.from('login_streaks').select('login_date').eq('user_id', session.user.id)
    if (data) setLoginDates(data.map(r => {
      const raw = r.login_date
      const str = typeof raw === 'string' ? raw.substring(0, 10) : dateStr(new Date(raw))
      return str
    }))
  }, [])

  const saveToday = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    const today = dateStr(new Date())
    await supabase.from('login_streaks').upsert(
      { user_id: session.user.id, login_date: today },
      { onConflict: 'user_id, login_date' }
    )
  }, [])

  useEffect(() => {
    if (active) {
      saveToday()
      loadLoginDates()
    }
  }, [active])

  const handleDayClick = (d) => {
    setSelectedDate(d)
    const str = `${MONTHS[month].substring(0, 3)} ${d}, ${year}`
    if (dateRef?.current) dateRef.current.textContent = str
    onClose()
  }

  const renderDays = useCallback(() => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDay = (firstDay.getDay() + 6) % 7
    const daysInMonth = lastDay.getDate()
    const selStr = selectedDate ? `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}` : null

    const days = []
    for (let i = 0; i < startDay; i++) {
      days.push(<span key={`e${i}`} className="cal-day empty" />)
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d)
      const ds = dateStr(date)
      const hasLogin = loginDates.includes(ds)
      const today = isToday(date)
      const sel = ds === selStr
      let cls = 'cal-day'
      if (hasLogin) cls += ' filled'
      if (today) cls += ' today'
      if (sel) cls += ' selected'
      days.push(<span key={d} className={cls} onClick={() => handleDayClick(d)}>{d}</span>)
    }
    return days
  }, [month, year, selectedDate, loginDates, handleDayClick])

  useEffect(() => {
    if (!active || !wrapRef.current || !dateRef?.current) return
    const btnRect = dateRef.current.getBoundingClientRect()
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    const wrapTop = 4.5 * rem
    const wrapWidth = 300
    const wrapRight = 3 * rem
    const wrapLeft = window.innerWidth - wrapRight - wrapWidth
    const btnCenterX = btnRect.left + btnRect.width / 2
    const btnCenterY = btnRect.top + btnRect.height / 2
    const originX = btnCenterX - wrapLeft
    const originY = btnCenterY - wrapTop
    wrapRef.current.style.transformOrigin = `${originX}px ${originY}px`
  }, [active, dateRef])

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  const prevMonth = () => {
    setSelectedDate(null)
    setMonth(m => { const nm = m - 1; return nm < 0 ? (setYear(y => y - 1), 11) : nm })
  }
  const nextMonth = () => {
    setSelectedDate(null)
    setMonth(m => { const nm = m + 1; return nm > 11 ? (setYear(y => y + 1), 0) : nm })
  }

  return (
    <div className={`calendar-modal${active ? ' active' : ''}`} onClick={handleBackdrop}>
      <div className="calendar-backdrop" />
      <div className="calendar-wrap" ref={wrapRef}>
        <div className="calendar-container">
          <div className="calendar-header">
            <button className="cal-nav" onClick={prevMonth} aria-label="Previous month">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <span className="cal-month">{MONTHS[month]} {year}</span>
            <button className="cal-nav" onClick={nextMonth} aria-label="Next month">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
          <div className="cal-weekdays">
            <span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span><span>SUN</span>
          </div>
          <div className="cal-days">
            {renderDays()}
          </div>
          <div className="cal-footer">
            <span className="cal-legend"><span className="cal-dot filled" /> KIRGAN KUN</span>
            <span className="cal-legend"><span className="cal-dot empty" /> KIRMAGAN</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function isToday(date) {
  const today = new Date()
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
}
