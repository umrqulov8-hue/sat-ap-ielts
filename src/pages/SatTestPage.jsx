import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useToast } from '../components/Toast'

const TIMER = { rw: { m1: 32, m2: 32 }, math: { m1: 35, m2: 35 } }

export default function SatTestPage() {
  const { testId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [test, setTest] = useState(null)
  const [modules, setModules] = useState([])
  const [modIdx, setModIdx] = useState(0)
  const [questions, setQuestions] = useState([])
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState(null)
  const [answers, setAnswers] = useState([])
  const [reviewMarked, setReviewMarked] = useState([])
  const [phase, setPhase] = useState('loading')
  const [timeLeft, setTimeLeft] = useState(0)
  const [showNav, setShowNav] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    ;(async () => {
      const { data: t } = await supabase.from('sat_tests').select('*').eq('id', testId).single()
      if (!t) { navigate('/admin/sat-tests'); return }
      setTest(t)
      const { data: mods } = await supabase.from('sat_modules').select('*').eq('test_id', testId).order('order_index')
      if (mods?.length) { setModules(mods); loadModule(mods[0].id) }
    })()
  }, [testId])

  const loadModule = async (modId) => {
    const { data } = await supabase.from('sat_questions').select('*').eq('module_id', modId).order('question_number')
    setQuestions(data || [])
    setCurrent(0)
    setSelected(null)
    setAnswers([])
    setReviewMarked([])
    setPhase('taking')
    setShowNav(false)
  }

  useEffect(() => {
    if (phase !== 'taking') return
    const mod = modules[modIdx]
    if (!mod) return
    const mins = TIMER[mod.section]?.['m' + mod.module_number] || 35
    setTimeLeft(mins * 60)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); setPhase('break'); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [modIdx, phase === 'taking'])

  useEffect(() => {
    if (phase === 'break' && modIdx < modules.length - 1) {
      const t = setTimeout(() => {
        const next = modIdx + 1
        setModIdx(next)
        loadModule(modules[next].id)
      }, 10000)
      return () => clearTimeout(t)
    }
  }, [phase === 'break'])

  const formatTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return m + ':' + String(sec).padStart(2, '0')
  }

  const handleNext = () => {
    if (selected === null) return
    const isCorrect = questions[current] ? selected === questions[current].correct_index : false
    setAnswers(prev => {
      const idx = prev.findIndex(a => a.qIdx === current)
      if (idx >= 0) { const n = [...prev]; n[idx] = { qIdx: current, selected, correct: isCorrect }; return n }
      return [...prev, { qIdx: current, selected, correct: isCorrect }]
    })
    setSelected(null)
    if (current + 1 >= questions.length) {
      setPhase('break')
    } else {
      setCurrent(c => c + 1)
    }
  }

  const submitTest = async () => {
    const score = answers.filter(a => a.correct).length
    const totalAns = answers.map(a => ({ qIdx: a.qIdx, selected: a.selected, correct: a.correct, question: questions[a.qIdx] }))
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.id && test) {
      const { data: inserted } = await supabase.from('practice_tests').insert({
        user_id: session.user.id, title: test.title, score, total: answers.length,
        duration: 'full', answers: totalAns, subject: 'SAT',
      }).select('id').single()
      if (inserted?.id) {
        toast.success('Test submitted! Score: ' + score + '/' + answers.length)
        navigate('/test-review/' + inserted.id)
        return
      }
    }
    toast.success('Test submitted! Score: ' + score + '/' + answers.length)
    navigate('/test-history')
  }

  const q = questions[current]
  const mod = modules[modIdx]

  if (!test) return null

  if (phase === 'loading') {
    return <div className="sat-page"><div className="sat-loading">LOADING TEST...</div></div>
  }

  if (phase === 'break') {
    const isFinal = modIdx >= modules.length - 1
    return (
      <div className="sat-page">
        <div className="sat-break">
          <div className="sat-break-title">{isFinal ? 'TEST COMPLETE' : 'SECTION BREAK'}</div>
          {isFinal ? (
            <>
              <p className="sat-break-text">You have completed all sections.</p>
              <div className="sat-break-stats">
                <span className="sat-break-stat">{answers.filter(a => a.correct).length} correct</span>
                <span className="sat-break-stat">{answers.length} answered</span>
                <span className="sat-break-stat">{Math.round(answers.filter(a => a.correct).length / Math.max(answers.length, 1) * 100)}%</span>
              </div>
              <button className="sat-break-btn" onClick={submitTest}>VIEW RESULTS</button>
            </>
          ) : (
            <>
              <p className="sat-break-text">You have completed {mod?.name}. Take a short break.</p>
              <p className="sat-break-text">Next: {modules[modIdx + 1]?.name}</p>
              <div className="sat-break-timer">Continue in {Math.ceil(timeLeft)}s</div>
              <button className="sat-break-btn" onClick={() => {
                const next = modIdx + 1
                setModIdx(next)
                loadModule(modules[next].id)
              }}>CONTINUE NOW</button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="sat-page">
      <div className="sat-header">
        <div className="sat-header-left">
          <span className="sat-module-name">{mod?.name}</span>
          <span className="sat-q-progress">Q{current + 1}/{questions.length}</span>
        </div>
        <div className={`sat-timer ${timeLeft < 60 ? 'sat-timer-warn' : ''}`}>{formatTime(timeLeft)}</div>
        <div className="sat-header-right">
          <button className="sat-icon-btn" onClick={() => setShowNav(!showNav)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </button>
        </div>
      </div>

      {showNav && (
        <div className="sat-nav-overlay" onClick={() => setShowNav(false)}>
          <div className="sat-nav-panel" onClick={e => e.stopPropagation()}>
            <div className="sat-nav-header">Question Navigator</div>
            <div className="sat-nav-grid">
              {questions.map((_, i) => {
                const ans = answers.find(a => a.qIdx === i)
                const isMarked = reviewMarked.includes(i)
                let cls = 'sat-nav-q'
                if (i === current) cls += ' current'
                else if (ans) cls += ' answered'
                if (isMarked) cls += ' marked'
                return (
                  <button key={i} className={cls} onClick={() => { setCurrent(i); setShowNav(false); setSelected(ans?.selected ?? null) }}>
                    {i + 1}
                    {isMarked && <span className="sat-nav-mark">*</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div className="sat-body">
        {q && (
          <div className="sat-question">
            <div className="sat-q-header">
              <span className="sat-q-num">Question {current + 1}</span>
              <button className={'sat-review-btn' + (reviewMarked.includes(current) ? ' marked' : '')}
                onClick={() => setReviewMarked(prev => prev.includes(current) ? prev.filter(i => i !== current) : [...prev, current])}>
                {reviewMarked.includes(current) ? 'MARKED' : 'MARK FOR REVIEW'}
              </button>
            </div>
            <div className="sat-q-text">{q.question_text}</div>
            <div className="sat-options">
              {q.options.map((opt, oi) => {
                const isSelected = selected === oi
                return (
                  <div key={oi} className={`sat-opt ${isSelected ? 'selected' : ''}`} onClick={() => setSelected(oi)}>
                    <span className="sat-opt-letter">{String.fromCharCode(65 + oi)}</span>
                    <span className="sat-opt-text">{opt}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="sat-footer">
        <button className="sat-next-btn" onClick={handleNext} disabled={selected === null}>
          {current + 1 >= questions.length ? 'FINISH SECTION' : 'NEXT'}
        </button>
      </div>
    </div>
  )
}
