import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useLayout } from '../components/DashLayout'
import { analyzeTest } from '../lib/ai'

export default function TestHistory() {
  const { setPageTitle, setPageSub, setPageClass } = useLayout()
  const navigate = useNavigate()
  const [tests, setTests] = useState([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(null)
  const [analysis, setAnalysis] = useState({})

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

  const handleAnalyze = async (test) => {
    setAnalyzing(test.id)
    try {
      let questions = []
      if (test.topic_id) {
        const { data } = await supabase.from('questions').select('*').eq('topic_id', test.topic_id).order('order_index')
        questions = data || []
      }
      const answers = test.answers || {}
      const result = await analyzeTest(test, questions, answers)
      setAnalysis(prev => ({ ...prev, [test.id]: result }))
    } catch (e) {
      setAnalysis(prev => ({ ...prev, [test.id]: { error: e.message } }))
    }
    setAnalyzing(null)
  }

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
              const a = analysis[t.id]
              return (
                <div key={t.id} className="th-row-wrap">
                  <div className="th-row">
                    <div className="th-row-left">
                      <span className="th-subject">{t.subject || 'General'}</span>
                      <span className="th-title">{t.title}</span>
                      <span className="th-date">{formatDate(t.taken_at)}</span>
                    </div>
                    <div className="th-row-right">
                      <span className={`th-score ${colorClass(p)}`}>{t.score}/{t.total}</span>
                      <span className={`th-pct ${colorClass(p)}`}>{p}%</span>
                      <button className="ai-analyze-btn" disabled={analyzing === t.id} onClick={() => handleAnalyze(t)}>
                        {analyzing === t.id ? 'TAHLIL...' : 'AI TAHLIL'}
                      </button>
                      <button className="th-review-btn" onClick={() => navigate('/test-review/' + t.id)}>REVIEW</button>
                    </div>
                  </div>
                  {a && !a.error && (
                    <div className="ai-analysis-box">
                      <h4>AI TAHLIL</h4>
                      {a.strengths?.length > 0 && <p><strong>Kuchli tomonlar:</strong> {a.strengths.join(', ')}</p>}
                      {a.weaknesses?.length > 0 && <p><strong>Zaif tomonlar:</strong> {a.weaknesses.join(', ')}</p>}
                      {a.recommendations?.length > 0 && (
                        <ul className="ai-analysis-recs">
                          {a.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                      )}
                      {a.next_steps && <p><strong>Keyingi qadamlar:</strong> {a.next_steps}</p>}
                    </div>
                  )}
                  {a?.error && <div className="ai-analysis-box"><p>{a.error}</p></div>}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
