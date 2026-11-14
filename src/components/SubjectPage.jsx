import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLayout } from './DashLayout'
import { supabase } from '../lib/supabaseClient'
import { getCache, setCache } from '../lib/dataCache'
import { fetchAll } from '../lib/fetchAll'
import { useUser } from '../context/UserContext'

const SUBJECT_UZ = {
  algebra: 'Algebra',
  geometry: 'Geometriya',
  'advanced-math': 'Murakkab matematika',
  'data-analysis': "Ma'lumotlar tahlili",
  'problem-solving': 'Masala yechish',
}
const SUBJECT_COLOR = {
  algebra: '#1F45A8',
  geometry: '#13804F',
  'advanced-math': '#C8372D',
  'data-analysis': '#1BA3B0',
  'problem-solving': '#B9852A',
}

const TARGET_MAP = { math: 800 }

export default function SubjectPage({ slug, title, subtitle, tag }) {
  const navigate = useNavigate()
  const { setPageTitle, setPageSub, setPageClass } = useLayout()
  const { profile } = useUser()
  const cached = getCache('subj-' + slug)
  const [score, setScore] = useState(cached?.score ?? 0)
  const [tests, setTests] = useState(cached?.tests ?? 0)
  const [accuracy, setAccuracy] = useState(cached?.accuracy ?? 0)
  const [time] = useState(cached?.time ?? 0)
  const [topics, setTopics] = useState(cached?.topics ?? [])
  const [accent, setAccent] = useState(cached?.accent || '#000')
  const [loading, setLoading] = useState(false)
  const target = TARGET_MAP[tag] || 800

  const refreshData = useCallback(async () => {
    const uid = profile?.id
    if (!uid) {
      setLoading(false)
      return
    }

    setLoading(true)
    const { data: sub } = await supabase.from('subjects').select('id, color').eq('slug', slug).single()
    if (!sub) {
      setLoading(false)
      return
    }
    if (sub.color) setAccent(sub.color)

    const [scRes, ptRes, accRes, qRes] = await Promise.all([
      supabase.from('user_scores').select('*').eq('user_id', uid).eq('subject_id', sub.id).maybeSingle(),
      supabase.from('practice_tests').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('subject_id', sub.id),
      supabase.from('practice_tests').select('score, total, taken_at').eq('user_id', uid).eq('subject_id', sub.id),
      fetchAll(() => supabase.from('questions').select('difficulty').eq('subject_id', sub.id).order('id')),
    ])

    if (scRes.data) setScore(scRes.data.score)
    if (ptRes.count !== null && ptRes.count !== undefined) setTests(ptRes.count)

    let acc = 0
    if (accRes.data?.length) {
      const recent = [...accRes.data]
        .sort((a, b) => new Date(b.taken_at || 0) - new Date(a.taken_at || 0))
        .slice(0, 5)
      const pct = recent.reduce((s, t) => s + (t.total > 0 ? t.score / t.total : 0), 0)
      acc = Math.round((pct / recent.length) * 100)
      setAccuracy(acc)
    } else setAccuracy(0)

    const counts = { easy: 0, medium: 0, hard: 0, elite: 0, mixing: 0 }
    if (qRes.data) {
      qRes.data.forEach(q => {
        counts[q.difficulty || 'medium']++
        counts['mixing']++
      })
    }
    const diffList = [
      { id: 'easy', name: 'Oson', count: counts.easy, color: '#10b981' },
      { id: 'medium', name: 'Oʻrtacha', count: counts.medium, color: '#f59e0b' },
      { id: 'hard', name: 'Qiyin', count: counts.hard, color: '#ef4444' },
      { id: 'mixing', name: 'Aralash', count: counts.mixing, color: '#8b5cf6' }
    ]
    setTopics(diffList)

    setCache('subj-' + slug, {
      score: scRes.data?.score ?? 0,
      tests: ptRes.count ?? 0,
      accuracy: acc,
      time,
      topics: diffList,
      accent: sub.color || '#000',
    })
    setLoading(false)
  }, [profile?.id, slug, time])

  useEffect(() => {
    setPageTitle((SUBJECT_UZ[slug] || title).toUpperCase())
    setPageSub(subtitle)
    setPageClass('')
    refreshData()
  }, [title, subtitle, slug, setPageTitle, setPageSub, setPageClass, refreshData])

  const handleStart = (t) => {
    if (!t.count) return
    navigate('/test/' + slug + '/' + t.id)
  }

  const uzName = SUBJECT_UZ[slug] || title
  const bandColor = SUBJECT_COLOR[slug] || accent
  return (
    <>
      <div className="ob-subject-band" style={{ '--band': bandColor }}>
        <div>
          <h2>{uzName}</h2>
          <span>{uzName === title ? subtitle : `${title.charAt(0)}${title.slice(1).toLowerCase()} · ${subtitle}`}</span>
        </div>
      </div>
      {loading && (
        <div style={{ position: 'fixed', top: 0, left: 220, right: 0, height: 3, background: 'var(--lavender)', zIndex: 100, animation: 'sub-progress 1.2s ease infinite' }} />
      )}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-label-row">
              <span className="stat-tag lavender">BALL</span>
              <span className="stat-label">HOZIRGI BALL</span>
            </div>
          </div>
          <div className="stat-value">{score > 0 ? score : '—'}</div>
          <div className="stat-footer">
            <span className="stat-footer-label">MAQSAD: {target}</span>
            <div className="stat-bar"><div className="stat-bar-fill lavender" style={{ width: `${score > 0 ? Math.min(100, Math.round((score / target) * 100)) : 0}%` }} /></div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-label-row">
              <span className="stat-tag green">TEST</span>
              <span className="stat-label">TOPSHIRILGAN TESTLAR</span>
            </div>
            <span className="stat-trend">BUTUN DAVR</span>
          </div>
          <div className="stat-value tests">{tests}</div>
          <div className="stat-footer">
            <span className="stat-footer-label">BARCHA TOPSHIRILGANLAR</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-label-row">
              <span className="stat-tag peach">ACC</span>
              <span className="stat-label">ANIQLIK</span>
            </div>
          </div>
          <div className="stat-value">{accuracy > 0 ? accuracy + '%' : '—'}</div>
          <div className="stat-footer">
            <span className="stat-footer-label">OXIRGI 5 TEST</span>
            <div className="stat-bar"><div className="stat-bar-fill peach" style={{ width: `${accuracy}%` }} /></div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-label-row">
              <span className="stat-tag yellow">TIME</span>
              <span className="stat-label">OʻQISH VAQTI</span>
            </div>
          </div>
          <div className="stat-value time">{time > 0 ? time : '—'}</div>
          <div className="stat-footer">
            <span className="stat-footer-label">SHU HAFTA SOATLARI</span>
            <div className="stat-bar"><div className="stat-bar-fill yellow" style={{ width: `${time > 0 ? Math.min(100, time * 3.3) : 0}%` }} /></div>
          </div>
        </div>
      </div>

      {topics.length > 0 && (
        <>
          <h2 className="section-title">QIYINLIK DARAJASI BOʻYICHA MASHQ</h2>
          <div className="study-grid study-grid-3">
            {topics.map((t) => (
              <div key={t.id} className={'study-card shadow-wrap' + (!t.count ? ' disabled' : '')} onClick={() => handleStart(t)} aria-disabled={!t.count}>
                <div className="shadow-box" />
                <div className="study-card-inner" style={{ '--sc': accent }}>
                  <div className="study-card-name" style={{ color: t.color, fontWeight: 700, fontSize: '1.2rem', textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>{t.name}</div>
                  <div className="study-card-count">{t.count} ta savol mavjud</div>
                  <button className="btn-module study-card-btn" disabled={!t.count} onClick={(e) => { e.stopPropagation(); handleStart(t) }}>
                    {t.count ? 'BOSHLASH' : 'TEZ ORADA'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
