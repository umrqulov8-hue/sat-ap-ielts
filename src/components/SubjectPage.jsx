import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLayout } from './DashLayout'
import { supabase } from '../lib/supabaseClient'
import { getCache, setCache } from '../lib/dataCache'
import { useUser } from '../context/UserContext'

const TAG_LABEL = { math: 'MATH', rw: 'R&W', ap: 'AP' }
const TARGET_MAP = { math: 800, rw: 800, ap: 5 }

function Skeleton() {
  return (
    <div className="subject-skeleton">
      <div className="stats-grid">
        {[1,2,3,4].map(i => (
          <div key={i} className="stat-card" style={{ minHeight: 120 }}>
            <div style={{ background: 'var(--gray-100)', borderRadius: 4, height: 14, width: '40%', marginBottom: 12 }} />
            <div style={{ background: 'var(--gray-100)', borderRadius: 4, height: 32, width: '60%', marginBottom: 12 }} />
            <div style={{ background: 'var(--gray-100)', borderRadius: 4, height: 6, width: '100%' }} />
          </div>
        ))}
      </div>
      <h2 className="section-title" style={{ opacity: 0.4 }}>MODULES</h2>
      <div className="module-list">
        {[1,2,3].map(i => (
          <div key={i} className="module-row">
            <div className="module-inner" style={{ opacity: 0.4 }}>
              <div className="module-left">
                <span className="module-tag math" style={{ background: 'var(--gray-100)' }}>MOD</span>
                <div className="module-info">
                  <div className="module-name" style={{ background: 'var(--gray-100)', height: 14, width: 180, borderRadius: 4 }} />
                  <div className="module-desc" style={{ background: 'var(--gray-100)', height: 10, width: 120, borderRadius: 4, marginTop: 6 }} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

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
  const [modules, setModules] = useState(cached?.modules ?? [])
  const [loading, setLoading] = useState(!cached)
  const target = TARGET_MAP[tag] || 800

  useEffect(() => {
    setPageTitle(title)
    setPageSub(subtitle)
    setPageClass('')
    refreshData()
  }, [])

  const refreshData = async () => {
    const uid = profile?.id
    if (!uid) { setLoading(false); return }

    const { data: sub } = await supabase.from('subjects').select('id').eq('slug', slug).single()
    if (!sub) { setLoading(false); return }

    const [modRes, scRes, ptRes, accRes, topicRes, doneRes] = await Promise.all([
      supabase.from('modules').select('*').eq('subject_id', sub.id).order('order_index'),
      supabase.from('user_scores').select('*').eq('user_id', uid).eq('subject_id', sub.id).maybeSingle(),
      supabase.from('practice_tests').select('id', { count: 'exact', head: true }).eq('user_id', uid),
      supabase.from('practice_tests').select('score, total').eq('user_id', uid),
      supabase.from('topics').select('id, module_id'),
      supabase.from('practice_tests').select('topic_id').eq('user_id', uid),
    ])

    if (scRes.data) setScore(scRes.data.score)
    if (ptRes.count !== null) setTests(ptRes.count)

    let acc = 0
    if (accRes.data?.length) {
      const pct = accRes.data.reduce((s, t) => s + (t.total > 0 ? t.score / t.total : 0), 0)
      acc = Math.round(pct / accRes.data.length * 100)
      setAccuracy(acc)
    }

    let mods = []
    if (modRes.data?.length) {
      const topicsByModule = {}
      topicRes.data?.forEach(t => {
        if (!topicsByModule[t.module_id]) topicsByModule[t.module_id] = []
        topicsByModule[t.module_id].push(t.id)
      })
      const doneTopics = new Set((doneRes.data?.filter(d => d.topic_id != null) || []).map(d => d.topic_id))
      setTotalTests(modRes.data.length)
      mods = modRes.data.map((m) => {
        const topicIds = topicsByModule[m.id] || []
        if (topicIds.length === 0) return { id: m.id, name: m.title, desc: m.duration, progress: 0, btn: 'SOON', status: 'soon' }
        const allDone = topicIds.every(tid => doneTopics.has(tid))
        return { id: m.id, name: m.title, desc: m.duration, progress: allDone ? 100 : 0, btn: allDone ? 'COMPLETED' : 'START', status: allDone ? 'completed' : 'available' }
      })
      setModules(mods)
    }

    setCache('subj-' + slug, { score: scRes.data?.score ?? score, tests: ptRes.count ?? tests, totalTests: mods.length || totalTests, accuracy: acc, time, modules: mods })
    setLoading(false)
  }

  const handleModuleStart = (mod) => {
    if (mod.status === 'soon') return
    navigate('/topics/' + mod.id)
  }

  const isAp = tag === 'ap'
  const pct = totalTests > 0 ? Math.round(tests / totalTests * 100) : 0

  if (loading) return <Skeleton />

  return (
    <><div className="stats-grid">
      <div className="stat-card">
        <div className="stat-card-top">
          <div className="stat-label-row">
            <span className={`stat-tag ${tag === 'math' ? 'lavender' : tag === 'rw' ? 'peach' : 'yellow'}`}>SCORE</span>
            <span className="stat-label">CURRENT SCORE</span>
          </div>
        </div>
        <div className={`stat-value${isAp ? ' ap' : ''}`}>{score > 0 ? score : '—'}</div>
        <div className="stat-footer">
          <span className="stat-footer-label">TARGET: {target}</span>
          <div className="stat-bar"><div className={`stat-bar-fill ${tag === 'math' ? 'lavender' : tag === 'rw' ? 'peach' : 'yellow'}`} style={{ width: `${score > 0 ? Math.min(100, Math.round(score / target * 100)) : 0}%` }} /></div>
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

      {modules.length > 0 && <><h2 className="section-title">MODULES</h2>
      <div className="module-list">
        {modules.map((m, i) => {
          const barClass = tag === 'math' ? 'lavender-bar' : tag === 'rw' ? 'peach-bar' : 'yellow-bar'
          return (
            <div key={i} className="module-row" onClick={() => handleModuleStart(m)}>
              <div className="module-inner">
                <div className="module-left">
                  <span className={`module-tag ${tag}`}>{TAG_LABEL[tag]}</span>
                  <div className="module-info">
                    <div className="module-name">{m.name}</div>
                    <div className="module-desc">MODULE {i + 1} OF {modules.length} &mdash; {m.desc}</div>
                  </div>
                </div>
                <div className="module-right">
                  <div className="module-progress"><div className={`module-progress-bar ${barClass}`} style={{ width: `${m.progress}%` }} /></div>
                  <button className={'btn-module' + (m.status === 'soon' ? ' soon' : '')} onClick={(e) => { e.stopPropagation(); handleModuleStart(m) }} disabled={m.status === 'soon'}>{m.btn}</button>
                </div>
              </div>
            </div>
          )
        })}
      </div></>}
    </>
  )
}
