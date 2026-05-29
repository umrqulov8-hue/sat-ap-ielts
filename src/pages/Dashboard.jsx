import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLayout } from '../components/DashLayout'
import { supabase } from '../lib/supabaseClient'

export default function Dashboard() {
  const { setPageTitle, setPageSub, setPageClass } = useLayout()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [totalScore, setTotalScore] = useState(null)
  const [scores, setScores] = useState([])
  const [tests, setTests] = useState([])
  const [activity, setActivity] = useState([])
  const [modules, setModules] = useState([])

  useEffect(() => {
    setPageTitle('DASHBOARD')
    setPageClass('')
    loadData()
  }, [])

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return navigate('/auth', { replace: true })

    const [profRes, tsRes, scRes, actsRes, modsRes, testRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('user_total_scores').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('user_scores').select('*, subjects(slug, title)').eq('user_id', user.id),
      supabase.from('user_activity').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(4),
      supabase.from('user_progress').select('*, modules(title, description, order_index, lesson_count, duration)').eq('user_id', user.id).in('status', ['started', 'available']).limit(3),
      supabase.from('practice_tests').select('*').eq('user_id', user.id),
    ])

    if (profRes.data) {
      setProfile(profRes.data)
      setPageSub(`Welcome back, ${profRes.data.display_name || 'Student'}`)
    }
    if (tsRes.data) setTotalScore(tsRes.data)
    if (scRes.data) setScores(scRes.data)
    if (actsRes.data) setActivity(actsRes.data)
    if (modsRes.data) setModules(modsRes.data)
    if (testRes.data) setTests(testRes.data)
  }

  const getScore = (slug) => {
    const s = scores.find(sc => sc.subjects?.slug === slug)
    return s ? s.score : null
  }

  const getMaxScore = (slug) => {
    const s = scores.find(sc => sc.subjects?.slug === slug)
    return s ? s.max_score : 800
  }

  const satScore = totalScore?.total_score || 0
  const mathScore = getScore('sat-math') || 0
  const rwScore = getScore('sat-rw') || 0
  const testCount = tests.length || 0
  const completedTests = tests.filter(t => t.score > 0).length || 0

  return (
    <><div className="stats-grid">
      <div className="shadow-wrap"><div className="shadow-box" />
        <div className="stat-card">
          <div className="stat-card-top"><span className="stat-label">SAT SCORE</span>{satScore > 0 && <span className="stat-trend up">+{Math.floor(satScore / 40)}</span>}</div>
          <div className="stat-value">{satScore || '—'}</div>
          <div className="stat-footer"><span className="stat-footer-label">TARGET: 1500</span><div className="stat-bar"><div className="stat-bar-fill" style={{ width: `${satScore ? Math.min(100, (satScore / 1600) * 100) : 0}%` }} /></div></div>
        </div>
      </div>
      <div className="shadow-wrap"><div className="shadow-box" />
        <div className="stat-card">
          <div className="stat-card-top"><span className="stat-label">SAT MATH</span>{mathScore > 0 && <span className="stat-trend up">+{Math.floor(mathScore / 50)}</span>}</div>
          <div className="stat-value">{mathScore || '—'}</div>
          <div className="stat-footer"><span className="stat-footer-label">OF {getMaxScore('sat-math')}</span><div className="stat-bar"><div className="stat-bar-fill" style={{ width: `${mathScore ? (mathScore / getMaxScore('sat-math')) * 100 : 0}%` }} /></div></div>
        </div>
      </div>
      <div className="shadow-wrap"><div className="shadow-box" />
        <div className="stat-card">
          <div className="stat-card-top"><span className="stat-label">SAT R&W</span>{rwScore > 0 && <span className="stat-trend up">+{Math.floor(rwScore / 40)}</span>}</div>
          <div className="stat-value">{rwScore || '—'}</div>
          <div className="stat-footer"><span className="stat-footer-label">OF {getMaxScore('sat-rw')}</span><div className="stat-bar"><div className="stat-bar-fill rw-bar" style={{ width: `${rwScore ? (rwScore / getMaxScore('sat-rw')) * 100 : 0}%` }} /></div></div>
        </div>
      </div>
      <div className="shadow-wrap"><div className="shadow-box" />
        <div className="stat-card">
          <div className="stat-card-top"><span className="stat-label">PRACTICE TESTS</span><span className="stat-trend">{completedTests}</span></div>
          <div className="stat-value tests">{testCount}</div>
          <div className="stat-footer"><span className="stat-footer-label">{testCount ? Math.round((completedTests / testCount) * 100) : 0}% COMPLETE</span><div className="stat-bar"><div className="stat-bar-fill" style={{ width: `${testCount ? (completedTests / testCount) * 100 : 0}%` }} /></div></div>
        </div>
      </div>
    </div>

    <div className="dash-grid-2col">
      <div className="shadow-wrap"><div className="shadow-box" />
        <div className="dash-card">
          <div className="card-header"><h2 className="card-title">RECENT ACTIVITY</h2><span className="card-link" onClick={() => navigate('/profile')}>VIEW ALL</span></div>
          <div className="activity-list">
            {activity.length === 0 ? (
              <div className="activity-item"><div className="activity-content"><span className="activity-title">No activity yet</span><span className="activity-meta">Start your first lesson</span></div></div>
            ) : activity.map((act, i) => (
              <div className="activity-item" key={i}><div className="activity-dot math" /><div className="activity-content"><span className="activity-title">{act.action}</span><span className="activity-meta">{act.detail}</span></div></div>
            ))}
          </div>
        </div>
      </div>

      <div className="shadow-wrap"><div className="shadow-box" />
        <div className="dash-card">
          <div className="card-header"><h2 className="card-title">QUICK ACTIONS</h2></div>
          <div className="quick-actions">
            <div className="qa-wrap shadow-wrap"><div className="shadow-box" /><button className="qa-btn" onClick={() => navigate('/practice-tests')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></svg>NEW PRACTICE TEST</button></div>
            <div className="qa-wrap shadow-wrap"><div className="shadow-box" /><button className="qa-btn" onClick={() => navigate('/profile')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-4" /></svg>SCORE ANALYSIS</button></div>
            <div className="qa-wrap shadow-wrap"><div className="shadow-box" /><button className="qa-btn" onClick={() => navigate('/study-plan')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>STUDY PLANNER</button></div>
            <div className="qa-wrap shadow-wrap"><div className="shadow-box" /><button className="qa-btn" onClick={() => navigate('/sat-math')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>REVIEW WEAK AREAS</button></div>
          </div>
        </div>
      </div>
    </div>

    <h2 className="section-title">UPCOMING MODULES</h2>
    <div className="module-list">
      {modules.length === 0 ? (
        <div className="module-row shadow-wrap"><div className="shadow-box" />
          <div className="module-inner">
            <div className="module-left"><div><div className="module-name">No modules yet</div><div className="module-desc">Start exploring subjects</div></div></div>
          </div>
        </div>
      ) : modules.map((mod, i) => (
        <div className="module-row shadow-wrap" key={i}><div className="shadow-box" />
          <div className="module-inner">
            <div className="module-left"><span className="module-tag math">MOD</span><div><div className="module-name">{mod.modules?.title || 'Module'}</div><div className="module-desc">MODULE {mod.modules?.order_index || 1} &mdash; {mod.modules?.duration || '45 MIN'}</div></div></div>
            <div className="module-right"><div className="module-progress"><div className="module-progress-bar" style={{ width: mod.status === 'started' ? '40%' : '0%' }} /></div><button className="btn-module" onClick={() => navigate('/topics/' + mod.module_id)}>{mod.status === 'started' ? 'CONTINUE' : 'START'}</button></div>
          </div>
        </div>
      ))}
    </div>
  </>
  )
}
