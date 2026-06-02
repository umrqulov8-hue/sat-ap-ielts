import { useEffect, useState, useCallback } from 'react'
import { useLayout } from '../components/DashLayout'
import { useToast } from '../components/Toast'
import { supabase } from '../lib/supabaseClient'

const DAYS_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const DAYS_FULL = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
const TAG_MAP = { MATH: 'math', 'R&W': 'rw', AP: 'ap' }
const PRIORITY_LABEL = { 1: 'PAST', 2: 'O\'RTA', 3: 'MUHIM' }

function todayNum() { return new Date().getDay() }

function minFromTime(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

function parseMin(d) {
  if (!d) return 0
  const n = parseInt(d)
  if (d.includes('hour')) return n * 60
  if (d.includes('min')) return n
  return n
}

function dayTasks(tasks, d) {
  return tasks.filter(t => t.day_of_week === d).sort((a, b) => minFromTime(a.time_slot) - minFromTime(b.time_slot))
}

export default function StudyPlan() {
  const { setPageTitle, setPageSub, setPageClass } = useLayout()
  const toast = useToast()
  const [daysLeft, setDaysLeft] = useState(null)
  const [tasks, setTasks] = useState([])
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ day: todayNum(), subject: 'MATH', activity: '', duration: '30 min', time: '09:00', notes: '', priority: 2 })

  useEffect(() => {
    setPageTitle('STUDY PLAN')
    setPageSub('Rejalashtir va natijangni kuzat')
    setPageClass('')
    loadData().finally(() => setLoading(false))
  }, [])

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user?.id
    if (!uid) return

    const [planRes, streakRes, profRes] = await Promise.all([
      supabase.from('study_plans').select('*').eq('user_id', uid).order('day_of_week'),
      supabase.from('login_streaks').select('*').eq('user_id', uid).order('login_date', { ascending: false }),
      supabase.from('profiles').select('exam_date').eq('id', uid).maybeSingle(),
    ])

    if (planRes.data) setTasks(planRes.data)
    if (profRes.data?.exam_date) {
      const diff = Math.ceil((new Date(profRes.data.exam_date) - new Date()) / 86400000)
      setDaysLeft(Math.max(0, diff))
    }

    let curStreak = 0
    if (streakRes.data?.length) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayMs = today.getTime()
      const dates = streakRes.data.map(s => {
        const d = new Date(s.login_date)
        d.setHours(0, 0, 0, 0)
        return d.getTime()
      })
      const dayMs = 86400000
      if (dates[0] === todayMs || dates[0] === todayMs - dayMs) {
        curStreak = 1
        for (let i = 1; i < dates.length; i++) {
          if (dates[i - 1] - dates[i] === dayMs) curStreak++
          else break
        }
      }
      setStreak(curStreak)
    }
  }

  const openAdd = (day) => {
    setEditing(null)
    setForm({ day: day ?? todayNum(), subject: 'MATH', activity: '', duration: '30 min', time: '09:00', notes: '', priority: 2 })
    setShowModal(true)
  }

  const openEdit = (t) => {
    setEditing(t.id)
    setForm({ day: t.day_of_week, subject: t.subject, activity: t.activity, duration: t.duration, time: t.time_slot || '09:00', notes: t.notes || '', priority: t.priority ?? 2 })
    setShowModal(true)
  }

  const duplicateTask = (t) => {
    setEditing(null)
    setForm({ day: t.day_of_week, subject: t.subject, activity: t.activity + ' (copy)', duration: t.duration, time: t.time_slot || '09:00', notes: t.notes || '', priority: t.priority ?? 2 })
    setShowModal(true)
  }

  const saveTask = useCallback(async () => {
    if (!form.activity.trim()) return
    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user?.id
    if (!uid) return

    const payload = {
      day_of_week: form.day, subject: form.subject, activity: form.activity.trim(),
      duration: form.duration, time_slot: form.time, notes: form.notes.trim(), priority: form.priority,
    }

    if (editing) {
      const { error } = await supabase.from('study_plans').update(payload).eq('id', editing).eq('user_id', uid)
      if (error) { toast.error('Saqlashda xatolik: ' + error.message); return }
      setTasks(prev => prev.map(t => t.id === editing ? { ...t, ...payload } : t))
      toast.success('Topshiriq tahrirlandi')
    } else {
      const { data, error } = await supabase.from('study_plans').insert({ user_id: uid, ...payload }).select().single()
      if (error) { toast.error('Qo\'shishda xatolik: ' + error.message); return }
      if (data) {
        setTasks(prev => [...prev, data].sort((a, b) => a.day_of_week - b.day_of_week || minFromTime(a.time_slot) - minFromTime(b.time_slot)))
        toast.success('Topshiriq qo\'shildi')
      }
    }
    setShowModal(false)
  }, [form, editing])

  const toggleDone = async (task) => {
    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user?.id
    if (!uid) return
    await supabase.from('study_plans').update({ done: !task.done }).eq('id', task.id).eq('user_id', uid)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: !t.done } : t))
  }

  const deleteTask = async (id) => {
    if (!window.confirm('Bu topshiriqni o\'chirishni xohlaysizmi?')) return
    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user?.id
    if (!uid) return
    const { error } = await supabase.from('study_plans').delete().eq('id', id).eq('user_id', uid)
    if (error) { toast.error('O\'chirishda xatolik'); return }
    setTasks(prev => prev.filter(t => t.id !== id))
    toast.success('Topshiriq o\'chirildi')
  }

  const markAllDone = async (day) => {
    const ids = tasks.filter(t => t.day_of_week === day && !t.done).map(t => t.id)
    if (!ids.length) { toast.info('Bajarilmagan topshiriq yo\'q'); return }
    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user?.id
    if (!uid) return
    const { error } = await supabase.from('study_plans').update({ done: true }).in('id', ids).eq('user_id', uid)
    if (error) { toast.error('Xatolik'); return }
    setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, done: true } : t))
    toast.success(`${ids.length} ta topshiriq bajarildi`)
  }

  const deleteAllDayTasks = async (day) => {
    const dayTaskIds = tasks.filter(t => t.day_of_week === day).map(t => t.id)
    if (!dayTaskIds.length) return
    if (!window.confirm(`Shu kundagi barcha topshiriqlarni o'chirishni xohlaysizmi? (${dayTaskIds.length} ta)`)) return
    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user?.id
    if (!uid) return
    for (const id of dayTaskIds) {
      const { error } = await supabase.from('study_plans').delete().eq('id', id).eq('user_id', uid)
      if (error) { toast.error('O\'chirishda xatolik'); return }
    }
    setTasks(prev => prev.filter(t => !dayTaskIds.includes(t.id)))
    toast.success(`${dayTaskIds.length} ta topshiriq o'chirildi`)
  }

  const tasksDone = tasks.filter(t => t.done).length
  const totalTasks = tasks.length
  const pct = totalTasks > 0 ? Math.round(tasksDone / totalTasks * 100) : 0
  const totalPlannedMin = tasks.reduce((s, t) => s + parseMin(t.duration), 0)
  const totalDoneMin = tasks.filter(t => t.done).reduce((s, t) => s + parseMin(t.duration), 0)
  const totalHours = totalPlannedMin ? Math.round(totalPlannedMin / 6) / 10 : 0
  const doneHours = totalDoneMin ? Math.round(totalDoneMin / 6) / 10 : 0

  const subjStats = {}
  for (const t of tasks) {
    const s = t.subject || 'MATH'
    if (!subjStats[s]) subjStats[s] = { total: 0, done: 0, min: 0 }
    subjStats[s].total++
    subjStats[s].min += parseMin(t.duration)
    if (t.done) subjStats[s].done++
  }

  const todayTasks = dayTasks(tasks, todayNum())
  const todayMin = todayTasks.reduce((s, t) => s + parseMin(t.duration), 0)
  const todayDone = todayTasks.filter(t => t.done).length

  const now = new Date()
  const currentMin = now.getHours() * 60 + now.getMinutes()
  const nextTask = todayTasks
    .filter(t => !t.done && t.time_slot && minFromTime(t.time_slot) > currentMin)
    .sort((a, b) => minFromTime(a.time_slot) - minFromTime(b.time_slot))[0]

  const dayOrder = [1, 2, 3, 4, 5, 6, 0]

  return (
    <><div className="stats-grid">
      <div className="stat-card">
        <div className="stat-card-top">
          <div className="stat-label-row">
            <span className="stat-tag lavender">DATE</span>
            <span className="stat-label">IMTIHONGACHA</span>
          </div>
        </div>
        <div className="stat-value">{daysLeft !== null ? daysLeft : '—'}</div>
        <div className="stat-footer">
          <span className="stat-footer-label">KUN QOLDI</span>
          <div className="stat-bar"><div className="stat-bar-fill lavender" style={{ width: daysLeft !== null ? `${Math.min(100, daysLeft / 3)}%` : '0%' }} /></div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-card-top">
          <div className="stat-label-row">
            <span className="stat-tag green">DONE</span>
            <span className="stat-label">BAJARILDI</span>
          </div>
          <span className="stat-trend">{tasksDone}/{totalTasks || '—'}</span>
        </div>
        <div className="stat-value tests">{tasksDone}</div>
        <div className="stat-footer">
          <span className="stat-footer-label">{pct}% TOPSHIRIQ</span>
          <div className="stat-bar"><div className="stat-bar-fill green" style={{ width: `${pct}%` }} /></div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-card-top">
          <div className="stat-label-row">
            <span className="stat-tag peach">TIME</span>
            <span className="stat-label">VAQT</span>
          </div>
        </div>
        <div className="stat-value time">{totalHours ? totalHours + 'h' : '—'}</div>
        <div className="stat-footer">
          <span className="stat-footer-label">{doneHours ? doneHours + 'h bajarildi' : 'Rejalashtirilgan'}</span>
          <div className="stat-bar"><div className="stat-bar-fill peach" style={{ width: totalPlannedMin ? `${(totalDoneMin / totalPlannedMin) * 100}%` : '0%' }} /></div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-card-top">
          <div className="stat-label-row">
            <span className="stat-tag yellow">STREAK</span>
            <span className="stat-label">STREAK</span>
          </div>
        </div>
        <div className="stat-value time">{streak > 0 ? streak : '—'}</div>
        <div className="stat-footer">
          <span className="stat-footer-label">KUN KETMA-KET</span>
          <div className="stat-bar"><div className="stat-bar-fill yellow" style={{ width: `${streak > 0 ? Math.min(100, streak * 8) : 0}%` }} /></div>
        </div>
      </div>
    </div>

    {Object.keys(subjStats).length > 1 && (
      <div className="study-subj-stats">
        {Object.entries(subjStats).map(([s, st]) => (
          <div key={s} className={`study-subj-stat ${TAG_MAP[s] || 'math'}`}>
            <span className="study-subj-name">{s}</span>
            <span className="study-subj-bar"><span style={{ width: st.total > 0 ? `${(st.done / st.total) * 100}%` : '0%' }} /></span>
            <span className="study-subj-nums">{st.done}/{st.total}</span>
            <span className="study-subj-time">{Math.round(st.min / 6) / 10}h</span>
          </div>
        ))}
      </div>
    )}

    {todayTasks.length > 0 && (
      <div className="study-today-summary">
        <span className="study-today-label">BUGUN:</span>
        <span className="study-today-stat">{todayDone}/{todayTasks.length} bajarildi</span>
        <span className="study-today-stat">{Math.round(todayMin / 6) / 10}h reja</span>
        {nextTask && <span className="study-today-next">Keyingi: {nextTask.activity} ({nextTask.time_slot})</span>}
      </div>
    )}

    <div className="section-header">
      <h2 className="section-title">HAFTALIK REJA</h2>
      <button className="btn-module" onClick={() => openAdd(todayNum())}>+ QO'SHISH</button>
    </div>

    <div className="study-week-grid">
      {dayOrder.map(d => {
        const dayT = dayTasks(tasks, d)
        const doneCount = dayT.filter(t => t.done).length
        const dayPct = dayT.length > 0 ? Math.round((doneCount / dayT.length) * 100) : 0
        return (
          <div key={d} className={'study-day-col' + (d === todayNum() ? ' today' : '') + (d === 0 || d === 6 ? ' weekend' : '')}>
            <div className="study-day-header">
              <span className="study-day-name">{DAYS_SHORT[d]}</span>
              <div className="study-day-actions">
                {dayT.length > 0 && <span className="study-day-count">{doneCount}/{dayT.length}</span>}
                <button className="study-day-action-btn" onClick={e => { e.stopPropagation(); markAllDone(d) }} title="Hammasini bajarildi">&#10003;</button>
                <button className="study-day-action-btn del" onClick={e => { e.stopPropagation(); deleteAllDayTasks(d) }} title="Hammasini o'chirish">&times;</button>
              </div>
            </div>
            {dayT.length > 0 && (
              <div className="study-day-progress">
                <div className="study-day-progress-fill" style={{ width: `${dayPct}%` }} />
              </div>
            )}
            <div className="study-day-tasks">
              {loading ? (
                <div className="study-day-empty">...</div>
              ) : dayT.length === 0 ? (
                <div className="study-day-empty">—</div>
              ) : dayT.map(t => (
                <div key={t.id} className={'study-task-card' + (t.done ? ' done' : '') + (t.priority === 3 ? ' high' : t.priority === 1 ? ' low' : '')} onClick={() => openEdit(t)}>
                  <div className="study-task-top">
                    <div className={'study-task-dot' + (t.done ? ' done' : '')} onClick={e => { e.stopPropagation(); toggleDone(t) }}>{t.done ? '\u2713' : ''}</div>
                    <span className={'study-tag ' + (TAG_MAP[t.subject] || 'math')}>{t.subject || 'MATH'}</span>
                    {t.priority >= 2 && <span className={'study-prio ' + (t.priority === 3 ? 'high' : '')}>{PRIORITY_LABEL[t.priority]}</span>}
                    <button className="study-task-copy" onClick={e => { e.stopPropagation(); duplicateTask(t) }} title="Nusxalash">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                  </div>
                  <div className="study-task-name">{t.activity}</div>
                  <div className="study-task-meta">{t.time_slot || ''} {t.duration}</div>
                  {t.notes && <div className="study-task-notes">{t.notes}</div>}
                </div>
              ))}
            </div>
            <button className="study-day-add" onClick={() => openAdd(d)} title="Qo'shish">+</button>
          </div>
        )
      })}
    </div>

    {showModal && (
      <div className="bb-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false) }}>
        <div className="bb-modal" style={{ maxWidth: 480 }}>
          <div className="bb-modal-header">
            {editing ? 'TAHRIRLASH' : 'YANGI TOPSHIRIQ'}
            <button className="bb-modal-close" onClick={() => setShowModal(false)}>&times;</button>
          </div>
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div>
              <label className="sp-label">KUN</label>
              <select className="onboarding-input" value={form.day} onChange={e => setForm({ ...form, day: parseInt(e.target.value) })}>
                {DAYS_FULL.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="sp-label">FAN</label>
              <select className="onboarding-input" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}>
                <option value="MATH">MATH</option>
                <option value="R&W">R&W</option>
                <option value="AP">AP</option>
              </select>
            </div>
            <div>
              <label className="sp-label">TOPSHIRIQ</label>
              <input className="onboarding-input" type="text" placeholder="Masalan: Linear Equations" value={form.activity} onChange={e => setForm({ ...form, activity: e.target.value })} autoFocus />
            </div>
            <div>
              <label className="sp-label">IZOH (ixtiyoriy)</label>
              <input className="onboarding-input" type="text" placeholder="Qo'shimcha ma'lumot" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <div style={{ flex: 1 }}>
                <label className="sp-label">DAVOMIYLIK</label>
                <select className="onboarding-input" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })}>
                  <option value="15 min">15 min</option>
                  <option value="30 min">30 min</option>
                  <option value="45 min">45 min</option>
                  <option value="60 min">60 min</option>
                  <option value="90 min">90 min</option>
                  <option value="2 hours">2 soat</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="sp-label">VAQT</label>
                <input className="onboarding-input" type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="sp-label">MUHIMLIK</label>
                <select className="onboarding-input" value={form.priority} onChange={e => setForm({ ...form, priority: parseInt(e.target.value) })}>
                  <option value={1}>PAST</option>
                  <option value={2}>O'RTA</option>
                  <option value={3}>MUHIM</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button className="onboarding-btn" style={{ flex: 1 }} onClick={saveTask}>{editing ? 'SAQLASH' : 'QO\'SHISH'}</button>
              {editing && <button className="onboarding-btn" style={{ flex: 0, background: '#fff', color: '#000', border: '2px solid #000' }} onClick={() => { deleteTask(editing); setShowModal(false) }}>O'CHIRISH</button>}
            </div>
          </div>
        </div>
      </div>
    )}
  </>)
}
