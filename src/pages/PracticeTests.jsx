import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLayout } from '../components/DashLayout'
import { supabase } from '../lib/supabaseClient'

export default function PracticeTests() {
  const { setPageTitle, setPageSub, setPageClass } = useLayout()
  const navigate = useNavigate()
  const [completed, setCompleted] = useState(0)
  const [avgScore, setAvgScore] = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [totalTime, setTotalTime] = useState(0)
  const [tests, setTests] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [subjects, setSubjects] = useState([])
  const [selectedSubj, setSelectedSubj] = useState('')
  const [modules, setModules] = useState([])
  const [selectedMod, setSelectedMod] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setPageTitle('PRACTICE TESTS')
    setPageSub('Full-length exams to simulate test day')
    setPageClass('')
    loadSubjects()
    loadData().finally(() => setLoading(false))
  }, [])

  const loadSubjects = async () => {
    const { data } = await supabase.from('subjects').select('*').order('order_index')
    if (data) setSubjects(data)
  }

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user?.id
    if (!uid) return

    const { data: pts } = await supabase.from('practice_tests').select('*').eq('user_id', uid).order('taken_at', { ascending: false })
    if (pts?.length) {
      const scores = pts.map(t => t.score)
      const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      const best = Math.max(...scores)
      const hours = pts.reduce((s, t) => {
        const dur = t.duration || ''
        const h = dur.includes('HOUR') ? parseInt(dur) : dur.includes('MIN') ? parseInt(dur) / 60 : parseInt(dur) / 60 || 0
        return s + (isNaN(h) ? 0 : h)
      }, 0)
      const totalH = Math.round(hours * 10) / 10
      const list = pts.map(t => ({
        id: t.id, name: t.title,
        desc: (t.duration || '3 HOURS') + ' &mdash; ' + (t.subject || 'ALL SECTIONS'),
        progress: t.total > 0 ? Math.round(t.score / t.total * 100) : 100,
        btn: 'COMPLETED',
        tag: 'math',
      }))
      setCompleted(pts.length)
      setAvgScore(avg)
      setBestScore(best)
      setTotalTime(totalH)
      setTests(list)
    }
  }

  const openNew = async () => {
    setShowNew(true)
    setSelectedSubj('')
    setSelectedMod('')
    setModules([])
  }

  const onSubjectSelect = async (slug) => {
    setSelectedSubj(slug)
    const { data } = await supabase.from('modules').select('id, title').eq('subject_id', (await supabase.from('subjects').select('id').eq('slug', slug).single()).data?.id).order('order_index')
    if (data) setModules(data)
    setSelectedMod('')
  }

  const startTest = () => {
    setShowNew(false)
    if (selectedMod) {
      navigate('/topics/' + selectedMod)
    } else if (selectedSubj) {
      const slugMap = { 'sat-math': '/sat-math', 'sat-rw': '/sat-rw', 'ap-bio': '/ap-bio', 'ap-calc': '/ap-calc' }
      navigate(slugMap[selectedSubj] || '/sat-math')
    }
  }

  return (
    <><div className="stats-grid">
      <div className="stat-card">
        <div className="stat-card-top">
          <div className="stat-label-row">
            <span className="stat-tag lavender">DONE</span>
            <span className="stat-label">TESTS COMPLETED</span>
          </div>
        </div>
        <div className="stat-value tests">{completed}</div>
        <div className="stat-footer">
          <span className="stat-footer-label">TOTAL TESTS TAKEN</span>
          <div className="stat-bar"><div className="stat-bar-fill lavender" style={{ width: `${Math.min(100, completed * 4)}%` }} /></div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-card-top">
          <div className="stat-label-row">
            <span className="stat-tag peach">AVG</span>
            <span className="stat-label">AVG SCORE</span>
          </div>
        </div>
        <div className="stat-value">{avgScore > 0 ? avgScore : '—'}</div>
        <div className="stat-footer">
          <span className="stat-footer-label">ALL TESTS</span>
          <div className="stat-bar"><div className="stat-bar-fill peach" style={{ width: `${avgScore > 0 ? Math.min(100, avgScore / 16) : 0}%` }} /></div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-card-top">
          <div className="stat-label-row">
            <span className="stat-tag green">BEST</span>
            <span className="stat-label">BEST SCORE</span>
          </div>
        </div>
        <div className="stat-value">{bestScore > 0 ? bestScore : '—'}</div>
        <div className="stat-footer">
          <span className="stat-footer-label">PERSONAL BEST</span>
          <div className="stat-bar"><div className="stat-bar-fill green" style={{ width: `${bestScore > 0 ? Math.min(100, bestScore / 16) : 0}%` }} /></div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-card-top">
          <div className="stat-label-row">
            <span className="stat-tag yellow">TIME</span>
            <span className="stat-label">TOTAL TIME</span>
          </div>
        </div>
        <div className="stat-value time">{totalTime > 0 ? totalTime : '—'}</div>
        <div className="stat-footer">
          <span className="stat-footer-label">HOURS PRACTICING</span>
          <div className="stat-bar"><div className="stat-bar-fill yellow" style={{ width: `${totalTime > 0 ? Math.min(100, totalTime / 60 * 100) : 0}%` }} /></div>
        </div>
      </div>
    </div>

      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 className="section-title" style={{ margin: 0 }}>HISTORY</h2>
        <button className="btn-module" onClick={openNew}>+ NEW TEST</button>
      </div>

      <div className="module-list">
        {loading ? (
          <div className="module-row">
            <div className="module-inner">
              <div className="module-left"><div className="module-info"><div className="module-name">Loading...</div><div className="module-desc">Fetching your test history</div></div></div>
            </div>
          </div>
        ) : tests.length === 0 ? (
          <div className="module-row">
            <div className="module-inner">
              <div className="module-left"><div className="module-info"><div className="module-name">No practice tests taken yet</div><div className="module-desc">Click + NEW TEST to start</div></div></div>
            </div>
          </div>
        ) : tests.map((t, i) => (
          <div key={t.id || i} className="module-row">
            <div className="module-inner">
              <div className="module-left"><span className="module-tag math">SAT</span><div className="module-info"><div className="module-name">{t.name}</div><div className="module-desc">{t.desc}</div></div></div>
              <div className="module-right"><div className="module-progress"><div className="module-progress-bar lavender-bar" style={{ width: `${t.progress}%` }} /></div><button className="btn-module">{t.btn}</button></div>
            </div>
          </div>
        ))}
      </div>

      {showNew && (
        <div className="bb-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowNew(false) }}>
          <div className="bb-modal" style={{ maxWidth: 450 }}>
            <div className="bb-modal-header">
              START NEW TEST
              <button className="bb-modal-close" onClick={() => setShowNew(false)}>&times;</button>
            </div>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', marginBottom: '0.3rem', display: 'block' }}>SUBJECT</label>
                <select className="onboarding-input" value={selectedSubj} onChange={e => onSubjectSelect(e.target.value)}>
                  <option value="">— Select Subject —</option>
                  {subjects.map(s => <option key={s.id} value={s.slug}>{s.title}</option>)}
                </select>
              </div>
              {modules.length > 0 && (
                <div>
                  <label style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', marginBottom: '0.3rem', display: 'block' }}>MODULE (optional)</label>
                  <select className="onboarding-input" value={selectedMod} onChange={e => setSelectedMod(e.target.value)}>
                    <option value="">— Full Subject Test —</option>
                    {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                  </select>
                </div>
              )}
              <button className="onboarding-btn" style={{ marginTop: '0.5rem' }} onClick={startTest} disabled={!selectedSubj}>
                START TEST
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
