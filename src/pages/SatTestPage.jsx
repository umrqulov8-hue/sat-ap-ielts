import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useToast } from '../components/Toast'
import DrawingCanvas from '../components/DrawingCanvas'

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
  const [moduleAnswers, setModuleAnswers] = useState({}) // { [modId]: [ { qIdx, selected, correct } ] }
  const [moduleQuestions, setModuleQuestions] = useState({}) // { [modId]: questions }
  const [reviewMarked, setReviewMarked] = useState([])
  const [phase, setPhase] = useState('loading')
  const [timeLeft, setTimeLeft] = useState(0)
  const [showNav, setShowNav] = useState(false)
  const [isDrawingMode, setIsDrawingMode] = useState(false)
  const timerRef = useRef(null)

  const currentMod = modules[modIdx]
  const currentModId = currentMod?.id
  const currentAnswers = currentModId ? (moduleAnswers[currentModId] || []) : []

  const loadModule = useCallback(async (mod) => {
    if (!mod) return
    const { data } = await supabase
      .from('sat_questions')
      .select('*')
      .eq('module_id', mod.id)
      .order('question_number')
    const qs = data || []
    setQuestions(qs)
    setModuleQuestions(prev => ({ ...prev, [mod.id]: qs }))
    setCurrent(0)
    setSelected(null)
    setReviewMarked([])
    setPhase('taking')
    setShowNav(false)
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: t, error } = await supabase.from('sat_tests').select('*').eq('id', testId).maybeSingle()
      if (!active) return
      if (error || !t) {
        toast.error('Test topilmadi yoki yuklashda xatolik')
        navigate('/practice/sat-tests', { replace: true })
        return
      }
      setTest(t)
      const { data: mods } = await supabase.from('sat_modules').select('*').eq('test_id', testId).order('order_index')
      if (!active) return
      if (mods?.length) {
        setModules(mods)
        loadModule(mods[0])
      } else {
        toast.error('Ushbu testda modullar mavjud emas')
        navigate('/practice/sat-tests', { replace: true })
      }
    })()
    return () => { active = false }
  }, [testId, navigate, toast, loadModule])

  useEffect(() => {
    if (phase !== 'taking' || !currentMod) return
    const mins = TIMER[currentMod.section]?.['m' + currentMod.module_number] || 35
    setTimeLeft(mins * 60)
    if (timerRef.current) clearInterval(timerRef.current)

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          setPhase('break')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [currentMod, phase])

  const formatTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  const handleNext = () => {
    if (selected === null || !currentModId) return
    const isCorrect = questions[current] ? selected === questions[current].correct_index : false
    
    setModuleAnswers(prev => {
      const existing = prev[currentModId] || []
      const idx = existing.findIndex(a => a.qIdx === current)
      let updated
      if (idx >= 0) {
        updated = [...existing]
        updated[idx] = { qIdx: current, selected, correct: isCorrect }
      } else {
        updated = [...existing, { qIdx: current, selected, correct: isCorrect }]
      }
      return { ...prev, [currentModId]: updated }
    })

    setSelected(null)
    if (current + 1 >= questions.length) {
      setPhase('break')
    } else {
      const nextIdx = current + 1
      setCurrent(nextIdx)
      const nextAns = currentAnswers.find(a => a.qIdx === nextIdx)
      if (nextAns) setSelected(nextAns.selected)
    }
  }

  const submitTest = async () => {
    const allAnsList = []
    let totalScore = 0
    let totalCount = 0

    modules.forEach(m => {
      const mAns = moduleAnswers[m.id] || []
      const mQs = moduleQuestions[m.id] || []
      mAns.forEach(a => {
        allAnsList.push({
          qIdx: a.qIdx,
          selected: a.selected,
          correct: a.correct,
          question: mQs[a.qIdx] || null,
        })
        if (a.correct) totalScore++
      })
      totalCount += mQs.length || mAns.length
    })

    const finalTotal = totalCount || allAnsList.length

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.id && test) {
        const { data: inserted } = await supabase.from('practice_tests').insert({
          user_id: session.user.id,
          title: test.title,
          score: totalScore,
          total: finalTotal,
          duration: 'full',
          answers: allAnsList,
          subject: 'SAT',
        }).select('id').single()

        if (inserted?.id) {
          toast.success(`Test yakunlandi! Natija: ${totalScore}/${finalTotal}`)
          navigate('/test-review/' + inserted.id)
          return
        }
      }
    } catch {
      // ignore
    }

    toast.success(`Test yakunlandi! Natija: ${totalScore}/${finalTotal}`)
    navigate('/test-history')
  }

  const q = questions[current]

  if (!test || phase === 'loading') {
    return <div className="sat-page"><div className="sat-loading">TEST YUKLANMOQDA...</div></div>
  }

  if (phase === 'break') {
    const isFinal = modIdx >= modules.length - 1
    let totalCorrectSoFar = 0
    let totalAnsweredSoFar = 0
    Object.values(moduleAnswers).forEach(ansArr => {
      ansArr.forEach(a => {
        totalAnsweredSoFar++
        if (a.correct) totalCorrectSoFar++
      })
    })

    return (
      <div className="sat-page">
        <div className="sat-break">
          <div className="sat-break-title">{isFinal ? 'TEST COMPLETE' : 'SECTION BREAK'}</div>
          {isFinal ? (
            <>
              <p className="sat-break-text">Siz barcha bo'limlarni yakunladingiz.</p>
              <div className="sat-break-stats">
                <span className="sat-break-stat">{totalCorrectSoFar} to'g'ri</span>
                <span className="sat-break-stat">{totalAnsweredSoFar} javob berildi</span>
                <span className="sat-break-stat">{Math.round(totalCorrectSoFar / Math.max(totalAnsweredSoFar, 1) * 100)}%</span>
              </div>
              <button className="sat-break-btn" onClick={submitTest}>VIEW RESULTS</button>
            </>
          ) : (
            <>
              <p className="sat-break-text">Siz {currentMod?.name} bo'limini yakunladingiz. Qisqa tanaffus qiling.</p>
              <p className="sat-break-text">Keyingisi: {modules[modIdx + 1]?.name}</p>
              <button className="sat-break-btn" onClick={() => {
                const next = modIdx + 1
                setModIdx(next)
                loadModule(modules[next])
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
          <span className="sat-module-name">{currentMod?.name}</span>
          <span className="sat-q-progress">Q{current + 1}/{questions.length}</span>
        </div>
        <div className={`sat-timer ${timeLeft < 60 ? 'sat-timer-warn' : ''}`}>{formatTime(timeLeft)}</div>
        <div className="sat-header-right">
          <button className={'sat-icon-btn' + (isDrawingMode ? ' active' : '')} onClick={() => setIsDrawingMode(!isDrawingMode)} title="Draw on Screen">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
          <button className="sat-icon-btn" onClick={() => setShowNav(!showNav)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </button>
        </div>
      </div>

      {isDrawingMode && <DrawingCanvas onClose={() => setIsDrawingMode(false)} />}

      {showNav && (
        <div className="sat-nav-overlay" onClick={() => setShowNav(false)}>
          <div className="sat-nav-panel" onClick={e => e.stopPropagation()}>
            <div className="sat-nav-header">Question Navigator</div>
            <div className="sat-nav-grid">
              {questions.map((_, i) => {
                const ans = currentAnswers.find(a => a.qIdx === i)
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
              {q.options?.map((opt, oi) => {
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
