import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLayout } from './DashLayout'
import { supabase } from '../lib/supabaseClient'
import { getCache, setCache } from '../lib/dataCache'
import { useUser } from '../context/UserContext'

const TARGET_MAP = { math: 800 }

export default function SubjectPage({ slug, title, subtitle, tag }) {
  const navigate = useNavigate()
  const { setPageTitle, setPageSub, setPageClass } = useLayout()
  const { profile } = useUser()
  const cached = getCache('subj-' + slug)
  const [score, setScore] = useState(cached?.score ?? 0)
  const [tests, setTests] = useState(cached?.tests ?? 0)
  const [totalTests, setTotalTests] = useState(cached?.totalTests ?? 0)
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

    const [modRes, scRes, ptRes, accRes, topicRes, doneRes] = await Promise.all([
      supabase.from('modules').select('id, order_index').eq('subject_id', sub.id).order('order_index'),
      supabase.from('user_scores').select('*').eq('user_id', uid).eq('subject_id', sub.id).maybeSingle(),
      supabase.from('practice_tests').select('id', { count: 'exact', head: true }).eq('user_id', uid),
      supabase.from('practice_tests').select('score, total, taken_at').eq('user_id', uid),
      supabase.from('topics').select('id, title, description, module_id, order_index'),
      supabase.from('practice_tests').select('topic_id').eq('user_id', uid),
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
    }

    let list = []
    if (modRes.data?.length) {
      const modOrder = {}
      modRes.data.forEach((m, i) => { modOrder[m.id] = i })
      const doneTopics = new Set((doneRes.data?.filter(d => d.topic_id != null) || []).map(d => d.topic_id))
      list = (topicRes.data || [])
        .filter(t => t.module_id in modOrder)
        .sort((a, b) => (modOrder[a.module_id] - modOrder[b.module_id]) || ((a.order_index || 0) - (b.order_index || 0)))
        .map(t => ({ id: t.id, name: t.title, desc: t.description || 'Practice test', done: doneTopics.has(t.id) }))
      setTotalTests(list.length)
      setTopics(list)
    }

    setCache('subj-' + slug, {
      score: scRes.data?.score ?? 0,
      tests: ptRes.count ?? 0,
      totalTests: list.length,
      accuracy: acc,
      time,
      topics: list,
      accent: sub.color || '#000',
    })
    setLoading(false)
  }, [profile?.id, slug, time])

  useEffect(() => {
    setPageTitle(title)
    setPageSub(subtitle)
    setPageClass('')
    refreshData()
  }, [title, subtitle, setPageTitle, setPageSub, setPageClass, refreshData])

  const handleStart = (t) => {
    navigate('/test/' + t.id)
  }

  const pct = totalTests > 0 ? Math.round((tests / totalTests) * 100) : 0

  return (
    <>
      {loading && (
        <div style={{ position: 'fixed', top: 0, left: 220, right: 0, height: 3, background: 'var(--lavender)', zIndex: 100, animation: 'sub-progress 1.2s ease infinite' }} />
      )}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-label-row">
              <span className="stat-tag lavender">SCORE</span>
              <span className="stat-label">CURRENT SCORE</span>
            </div>
          </div>
          <div className="stat-value">{score > 0 ? score : '—'}</div>
          <div className="stat-footer">
            <span className="stat-footer-label">TARGET: {target}</span>
            <div className="stat-bar"><div className="stat-bar-fill lavender" style={{ width: `${score > 0 ? Math.min(100, Math.round((score / target) * 100)) : 0}%` }} /></div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-label-row">
              <span className="stat-tag green">TEST</span>
              <span className="stat-label">TESTS COMPLETED</span>
            </div>
            <span className="stat-trend">{tests}/{totalTests || '—'}</span>
          </div>
          <div className="stat-value tests">{tests}</div>
          <div className="stat-footer">
            <span className="stat-footer-label">{pct}% COMPLETE</span>
            <div className="stat-bar"><div className="stat-bar-fill green" style={{ width: `${pct}%` }} /></div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-label-row">
              <span className="stat-tag peach">ACC</span>
              <span className="stat-label">ACCURACY RATE</span>
            </div>
          </div>
          <div className="stat-value">{accuracy > 0 ? accuracy + '%' : '—'}</div>
          <div className="stat-footer">
            <span className="stat-footer-label">LAST 5 TESTS</span>
            <div className="stat-bar"><div className="stat-bar-fill peach" style={{ width: `${accuracy}%` }} /></div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <div className="stat-label-row">
              <span className="stat-tag yellow">TIME</span>
              <span className="stat-label">STUDY TIME</span>
            </div>
          </div>
          <div className="stat-value time">{time > 0 ? time : '—'}</div>
          <div className="stat-footer">
            <span className="stat-footer-label">HOURS THIS WEEK</span>
            <div className="stat-bar"><div className="stat-bar-fill yellow" style={{ width: `${time > 0 ? Math.min(100, time * 3.3) : 0}%` }} /></div>
          </div>
        </div>
      </div>

      {topics.length > 0 && (
        <>
          <h2 className="section-title">TOPICS</h2>
          <div className="study-grid study-grid-3">
            {topics.map((t, i) => (
              <div key={t.id} className="study-card shadow-wrap" onClick={() => handleStart(t)}>
                <div className="shadow-box" />
                <div className="study-card-inner" style={{ '--sc': accent }}>
                  <span className="study-card-num">{(i + 1).toString().padStart(2, '0')}</span>
                  <div className="study-card-name">{t.name}</div>
                  <div className="study-card-count">{t.done ? 'Completed — retake?' : (t.desc || 'Practice test')}</div>
                  <button className="btn-module study-card-btn" onClick={(e) => { e.stopPropagation(); handleStart(t) }}>
                    {t.done ? 'RETAKE' : 'START'}
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
