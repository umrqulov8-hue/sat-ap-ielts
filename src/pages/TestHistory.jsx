import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useLayout } from '../components/DashLayout'

export default function TestHistory() {
  const { setPageTitle, setPageSub, setPageClass } = useLayout()
  const navigate = useNavigate()
  const [tests, setTests] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setPageTitle('TEST HISTORY')
    setPageSub('Your practice test results')
    setPageClass('test-history')
  }, [])

  useEffect(() => {
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) { setLoading(false); return }
      const { data } = await supabase
        .from('practice_tests')
        .select('*')
        .eq('user_id', session.user.id)
        .order('taken_at', { ascending: false })
      if (data) setTests(data)
      setLoading(false)
    })()
  }, [])

  const formatDate = (iso) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const pct = (score, total) => total > 0 ? Math.round((score / total) * 100) : 0
  const colorClass = (v) => v >= 80 ? 'th-high' : v >= 50 ? 'th-mid' : 'th-low'

  if (loading) return null

  return (
    <div className="th-wrap">
      {tests.length === 0 ? (
        <div className="th-empty">
          <p>No test results yet.</p>
          <button className="btn btn-primary" onClick={() => navigate('/practice-tests')}>
            Take a Practice Test
          </button>
        </div>
      ) : (
        <>
          <div className="th-summary">
            <div className="th-stat">
              <span className="th-stat-val">{tests.length}</span>
              <span className="th-stat-lbl">Tests Taken</span>
            </div>
            <div className="th-stat">
              <span className="th-stat-val">{Math.round(tests.reduce((a, t) => a + pct(t.score, t.total), 0) / tests.length)}%</span>
              <span className="th-stat-lbl">Avg Score</span>
            </div>
            <div className="th-stat">
              <span className="th-stat-val">{tests.reduce((a, t) => a + t.score, 0)}/{tests.reduce((a, t) => a + t.total, 0)}</span>
              <span className="th-stat-lbl">Total Correct</span>
            </div>
          </div>
          <div className="th-list">
            {tests.map(t => {
              const p = pct(t.score, t.total)
              return (
                <div key={t.id} className="th-row">
                  <div className="th-row-left">
                    <span className="th-subject">{t.subject || 'General'}</span>
                    <span className="th-title">{t.title}</span>
                    <span className="th-date">{formatDate(t.taken_at)}</span>
                  </div>
                  <div className="th-row-right">
                    <span className={`th-score ${colorClass(p)}`}>{t.score}/{t.total}</span>
                    <span className={`th-pct ${colorClass(p)}`}>{p}%</span>
                    <button className="th-review-btn" onClick={() => navigate('/test-review/' + t.id)}>REVIEW</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
