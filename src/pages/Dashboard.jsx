import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLayout } from '../components/DashLayout'
import { supabase } from '../lib/supabaseClient'

export default function Dashboard() {
  const { setPageTitle, setPageSub, setPageClass } = useLayout()
  const navigate = useNavigate()
  const [scores, setScores] = useState([])
  const [tests, setTests] = useState([])
  const [activity, setActivity] = useState([])
  const [modules, setModules] = useState([])

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return navigate('/auth', { replace: true })

    const [profRes, scRes, actsRes, modsRes, testRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('user_scores').select('*, subjects(slug, title)').eq('user_id', user.id),
      supabase.from('user_activity').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(4),
      supabase.from('user_progress').select('*, modules(title, description, order_index, lesson_count, duration)').eq('user_id', user.id).in('status', ['started', 'available']).limit(3),
      supabase.from('practice_tests').select('*').eq('user_id', user.id),
    ])

    if (profRes.data) {
      setPageSub(`Welcome back, ${profRes.data.display_name || 'Student'}`)
    }
    if (scRes.data) setScores(scRes.data)
    if (actsRes.data) setActivity(actsRes.data)
    if (modsRes.data) setModules(modsRes.data)
    if (testRes.data) setTests(testRes.data)
  }, [navigate, setPageSub])

  useEffect(() => {
    setPageTitle('DASHBOARD')
    setPageClass('')
    loadData()
  }, [setPageTitle, setPageClass, loadData])

  const getScore = (slug) => {
    const s = scores.find(sc => sc.subjects?.slug === slug)
    return s ? s.score : null
  }

  const getMaxScore = (slug) => {
    const s = scores.find(sc => sc.subjects?.slug === slug)
    return s ? s.max_score : 800
  }

  const advScore = getScore('advanced-math') || 0
  const dataScore = getScore('data-analysis') || 0
  const probScore = getScore('problem-solving') || 0
  const algebraScore = getScore('algebra') || 0
  const geometryScore = getScore('geometry') || 0
  const testCount = tests.length || 0
  const completedTests = tests.filter(t => t.score > 0).length || 0

  return (
    <><div className="stats-grid">
      <div className="stat-card">
        <div className="stat-card-top">
          <div className="stat-label-row">
            <span className="stat-tag lavender">ADV</span>
            <span className="stat-label">ADVANCED MATH</span>
          </div>
          {advScore > 0 && <span className="stat-trend up">+{Math.floor(advScore / 50)}</span>}
        </div>
        <div className="stat-value">{advScore || '—'}</div>
        <div className="stat-footer">
          <span className="stat-footer-label">OF {getMaxScore('advanced-math')}</span>
          <div className="stat-bar"><div className="stat-bar-fill lavender" style={{ width: `${advScore ? (advScore / getMaxScore('advanced-math')) * 100 : 0}%` }} /></div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-card-top">
          <div className="stat-label-row">
            <span className="stat-tag peach">DATA</span>
            <span className="stat-label">DATA ANALYSIS</span>
          </div>
          {dataScore > 0 && <span className="stat-trend up">+{Math.floor(dataScore / 40)}</span>}
        </div>
        <div className="stat-value">{dataScore || '—'}</div>
        <div className="stat-footer">
          <span className="stat-footer-label">OF {getMaxScore('data-analysis')}</span>
          <div className="stat-bar"><div className="stat-bar-fill peach" style={{ width: `${dataScore ? (dataScore / getMaxScore('data-analysis')) * 100 : 0}%` }} /></div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-card-top">
          <div className="stat-label-row">
            <span className="stat-tag pink">PROB</span>
            <span className="stat-label">PROBLEM SOLVING</span>
          </div>
          {probScore > 0 && <span className="stat-trend up">+{Math.floor(probScore / 40)}</span>}
        </div>
        <div className="stat-value">{probScore || '—'}</div>
        <div className="stat-footer">
          <span className="stat-footer-label">OF {getMaxScore('problem-solving')}</span>
          <div className="stat-bar"><div className="stat-bar-fill green" style={{ width: `${probScore ? (probScore / getMaxScore('problem-solving')) * 100 : 0}%` }} /></div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-card-top">
          <div className="stat-label-row">
            <span className="stat-tag green">ALG</span>
            <span className="stat-label">ALGEBRA</span>
          </div>
          {algebraScore > 0 && <span className="stat-trend up">+{Math.floor(algebraScore / 40)}</span>}
        </div>
        <div className="stat-value">{algebraScore || '—'}</div>
        <div className="stat-footer">
          <span className="stat-footer-label">OF {getMaxScore('algebra')}</span>
          <div className="stat-bar"><div className="stat-bar-fill green" style={{ width: `${algebraScore ? (algebraScore / getMaxScore('algebra')) * 100 : 0}%` }} /></div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-card-top">
          <div className="stat-label-row">
            <span className="stat-tag yellow">GEO</span>
            <span className="stat-label">GEOMETRY</span>
          </div>
          {geometryScore > 0 && <span className="stat-trend up">+{Math.floor(geometryScore / 40)}</span>}
        </div>
        <div className="stat-value">{geometryScore || '—'}</div>
        <div className="stat-footer">
          <span className="stat-footer-label">OF {getMaxScore('geometry')}</span>
          <div className="stat-bar"><div className="stat-bar-fill yellow" style={{ width: `${geometryScore ? (geometryScore / getMaxScore('geometry')) * 100 : 0}%` }} /></div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-card-top">
          <div className="stat-label-row">
            <span className="stat-tag yellow">TEST</span>
            <span className="stat-label">PRACTICE TESTS</span>
          </div>
          <span className="stat-trend">{completedTests}</span>
        </div>
        <div className="stat-value tests">{testCount}</div>
        <div className="stat-footer">
          <span className="stat-footer-label">{testCount ? Math.round((completedTests / testCount) * 100) : 0}% COMPLETE</span>
          <div className="stat-bar"><div className="stat-bar-fill yellow" style={{ width: `${testCount ? (completedTests / testCount) * 100 : 0}%` }} /></div>
        </div>
      </div>
    </div>

    <div className="dash-grid-2col">
      <div className="dash-card">
        <div className="card-header"><h2 className="card-title">RECENT ACTIVITY</h2><span className="card-link" onClick={() => navigate('/profile')}>VIEW ALL</span></div>
        <div className="activity-list">
          {activity.length === 0 ? (
            <div className="activity-item">
              <div className="activity-dot math" />
              <div className="activity-content">
                <span className="activity-title">No activity yet</span>
                <span className="activity-meta">Start your first lesson</span>
              </div>
              <svg className="activity-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            </div>
          ) : activity.map((act, i) => {
            const dotColors = ['math', 'rw', 'ap', 'strategy']
            const dotClass = dotColors[i % 4]
            return (
              <div className="activity-item" key={i}>
                <div className={`activity-dot ${dotClass}`} />
                <div className="activity-content">
                  <span className="activity-title">{act.action}</span>
                  <span className="activity-meta">{act.detail}</span>
                </div>
                <svg className="activity-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
              </div>
            )
          })}
        </div>
      </div>

      <div className="dash-card">
        <div className="card-header"><h2 className="card-title">QUICK ACTIONS</h2></div>
        <div className="quick-actions">
          <button className="qa-btn" onClick={() => navigate('/study')}>
            <span className="qa-btn-icon lavender"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polygon points="6 3 20 12 6 21 6 3" /></svg></span>
            <span className="qa-btn-text">WATCH LESSONS</span>
            <span className="qa-btn-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg></span>
          </button>
          <button className="qa-btn" onClick={() => navigate('/profile')}>
            <span className="qa-btn-icon peach"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-4" /></svg></span>
            <span className="qa-btn-text">SCORE ANALYSIS</span>
            <span className="qa-btn-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg></span>
          </button>
          <button className="qa-btn" onClick={() => navigate('/study-plan')}>
            <span className="qa-btn-icon green"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg></span>
            <span className="qa-btn-text">STUDY PLANNER</span>
            <span className="qa-btn-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg></span>
          </button>
          <button className="qa-btn" onClick={() => navigate('/algebra')}>
            <span className="qa-btn-icon yellow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg></span>
            <span className="qa-btn-text">REVIEW WEAK AREAS</span>
            <span className="qa-btn-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg></span>
          </button>
        </div>
      </div>
    </div>

    <h2 className="section-title">UPCOMING MODULES</h2>
    <div className="module-list">
      {modules.length === 0 ? (
        <div className="module-row">
          <div className="module-inner">
            <div className="module-left">
              <span className="module-tag math">MOD</span>
              <div className="module-info">
                <div className="module-name">No modules yet</div>
                <div className="module-desc">Start exploring subjects</div>
              </div>
            </div>
          </div>
        </div>
      ) : modules.map((mod, i) => {
        const tagColors = ['math', 'rw', 'ap']
        const barColors = ['lavender-bar', 'peach-bar', 'green-bar', 'yellow-bar']
        const tagClass = tagColors[i % 3]
        const barClass = barColors[i % 4]
        return (
          <div className="module-row" key={i} onClick={() => navigate('/topics/' + mod.module_id)}>
            <div className="module-inner">
              <div className="module-left">
                <span className={`module-tag ${tagClass}`}>MOD</span>
                <div className="module-info">
                  <div className="module-name">{mod.modules?.title || 'Module'}</div>
                  <div className="module-desc">MODULE {mod.modules?.order_index || 1} &mdash; {mod.modules?.duration || '45 MIN'}</div>
                </div>
              </div>
              <div className="module-right">
                <div className="module-progress"><div className={`module-progress-bar ${barClass}`} style={{ width: mod.status === 'started' ? '40%' : '0%' }} /></div>
                <button className="btn-module" onClick={(e) => { e.stopPropagation(); navigate('/topics/' + mod.module_id) }}>{mod.status === 'started' ? 'CONTINUE' : 'START'}</button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  </>
  )
}
