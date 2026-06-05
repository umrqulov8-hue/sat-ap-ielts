import { useState, useEffect, useRef, useMemo, memo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { getCache, setCache } from '../lib/dataCache'
import { useToast } from '../components/Toast'
import AITutor from '../components/AITutor'

const IS_PRACTICE = true

const formatTime = (s) => {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const QuestionTimer = memo(function QuestionTimer({ startTime }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const tick = () => setElapsed(Math.floor((Date.now() - startTime) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startTime])
  return <div className="bb-timer">{formatTime(elapsed)}</div>
})

export default function TestPage() {
  const { topicId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const locState = location.state
  const [topic, setTopic] = useState(locState?.topic || null)
  const [questions, setQuestions] = useState([])
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState(null)
  const [answers, setAnswers] = useState([])
  const [reviewMarked, setReviewMarked] = useState([])
  const [step, setStep] = useState('taking')
  const [saving, setSaving] = useState(false)
  const [startedAt, setStartedAt] = useState(null)
  const [loading, setLoading] = useState(!(locState?.questions || getCache('test-questions-' + topicId)))
  const [showNav, setShowNav] = useState(false)
  const [abcMode, setAbcMode] = useState(false)
  const [strikethrough, setStrikethrough] = useState({})
  const [highlights, setHighlights] = useState({})
  const [hlMenu, setHlMenu] = useState(null)
  const hlSelectedRef = useRef('')
  const passageRef = useRef(null)
  const [showCalc, setShowCalc] = useState(false)
  const [showRef, setShowRef] = useState(false)
  const [showAITutor, setShowAITutor] = useState(false)
  const [displayName, setDisplayName] = useState('STUDENT')
  const [expExplain, setExpExplain] = useState(null)
  const [showCert, setShowCert] = useState(false)
  const [savedTestId, setSavedTestId] = useState(null)
  const [calcPos, setCalcPos] = useState({ x: 80, y: 60 })
  const [calcSize, setCalcSize] = useState({ w: 640, h: 520 })
  const [totalElapsed, setTotalElapsed] = useState(0)
  const qStartRef = useRef(null)
  const toast = useToast()


  useEffect(() => {
    const cached = locState?.questions || getCache('test-questions-' + topicId)
    if (cached) {
      setQuestions(cached)
      if (!topic) setTopic(getCache('test-topic-' + topicId) || null)
      setStartedAt(new Date().toISOString())
      qStartRef.current = Date.now()
      setLoading(false)
    }

    // Eager-load Desmos script so it's ready when user clicks calculator
    if (!window.Desmos && !document.getElementById('desmos-api')) {
      const s = document.createElement('script')
      s.id = 'desmos-api'
      s.src = 'https://www.desmos.com/api/v1.10/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6'
      s.async = true
      document.body.appendChild(s)
    }

    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()

      const [tpResult, qsResult, profResult] = await Promise.all([
        supabase.from('topics')
          .select('*, modules!inner(subject_id, title, subjects!inner(id, title))')
          .eq('id', topicId).maybeSingle(),
        !cached ? supabase.from('questions').select('*').eq('topic_id', topicId).order('order_index') : Promise.resolve({ data: null }),
        session?.user ? supabase.from('profiles').select('display_name').eq('id', session.user.id).maybeSingle() : Promise.resolve({ data: null }),
      ])

      const tp = tpResult.data
      if (tp) {
        setTopic(tp)
        setCache('test-topic-' + topicId, tp)
        if (!cached) {
          setStartedAt(new Date().toISOString())
          qStartRef.current = Date.now()
        }
      }

      if (profResult.data?.display_name) setDisplayName(profResult.data.display_name)

      if (!cached && qsResult.data?.length) {
        const shuffled = [...qsResult.data].sort(() => Math.random() - 0.5)
        setQuestions(shuffled)
        setCache('test-questions-' + topicId, shuffled)
      }
      setLoading(false)
    })()

  }, [topicId])

  useEffect(() => {
    if (!questions[current] || !IS_PRACTICE) return
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey || e.altKey) && e.key.toLowerCase() === 'a' && !e.shiftKey) {
        e.preventDefault()
        setShowAITutor(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [current, questions])

  const currentQuestion = useMemo(() => questions[current] || null, [questions, current])

  const passageFromText = useMemo(() => {
    if (!currentQuestion?.question_text) return null
    const m = currentQuestion.question_text.match(/<!--PASSAGE_START-->([\s\S]*?)<!--PASSAGE_END-->/)
    return m ? m[1] : null
  }, [currentQuestion])

  const questionBodyText = useMemo(() => {
    if (!currentQuestion?.question_text) return null
    if (passageFromText) return currentQuestion.question_text.replace(/<!--PASSAGE_START-->[\s\S]*?<!--PASSAGE_END-->/, '').trim()
    return currentQuestion.question_text
  }, [currentQuestion, passageFromText])

  const effectivePassage = currentQuestion?.passage_text || passageFromText

  const effectiveQText = useMemo(() => {
    if (!questionBodyText) return null
    if (!effectivePassage) return questionBodyText
    const qMarkers = ['which choice', 'which sentence', 'which revision', 'the writer wants', 'the student wants', 'the author']
    const raw = questionBodyText.trim()
    const rawLower = raw.toLowerCase()
    for (const marker of qMarkers) {
      const idx = rawLower.indexOf(marker)
      if (idx > 50) return raw.slice(idx).trim()
    }
    const passNorm = effectivePassage.trim().replace(/[\s\u00a0]+/g, ' ').replace(/[\u201c\u201d\u2018\u2019]/g, '"').toLowerCase()
    const qNorm = raw.replace(/[\s\u00a0]+/g, ' ').replace(/[\u201c\u201d\u2018\u2019]/g, '"').toLowerCase()
    if (qNorm.startsWith(passNorm)) {
      let i = 0
      const pw = passNorm.split(' ')
      const qw = qNorm.split(' ')
      for (let j = 0; j < pw.length && j < qw.length; j++) {
        if (pw[j] !== qw[j]) break
        i += qw[j].length + 1
      }
      while (i < raw.length && /\s/.test(raw[i])) i++
      return raw.slice(i).trim() || null
    }
    return questionBodyText
  }, [questionBodyText, effectivePassage])

  const HL_COLORS = [
    { name: 'yellow', color: '#ffe066', border: '#d4b800' },
    { name: 'green', color: '#a8e6a3', border: '#5ab052' },
    { name: 'blue', color: '#a8d4f5', border: '#5a9fd4' },
    { name: 'pink', color: '#f5a8c7', border: '#d45a8a' },
    { name: 'purple', color: '#c7a8f5', border: '#8a5ad4' },
  ]

  const getHighlightedHTML = (text) => {
    const qHighlights = highlights['q' + current] || []
    if (!qHighlights.length || !text) return text
    let html = text
    qHighlights.forEach(h => {
      try {
        const escaped = h.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        html = html.replace(new RegExp(escaped, 'gi'), `<mark class="hl-mark" style="background:${h.color};border-bottom:2px solid ${h.border};padding:1px 2px;border-radius:2px;">${h.text}</mark>`)
      } catch { /* skip invalid */ }
    })
    return html
  }

  const applyHighlight = (color) => {
    const text = hlSelectedRef.current
    if (!text) return
    const key = 'q' + current
    setHighlights(prev => ({ ...prev, [key]: [...(prev[key] || []), { text, color: color.color, border: color.border }] }))
    window.getSelection()?.removeAllRanges()
    setHlMenu(null)
  }

  const removeHighlight = (idx) => {
    const key = 'q' + current
    setHighlights(prev => {
      const arr = [...(prev[key] || [])]
      arr.splice(idx, 1)
      return { ...prev, [key]: arr }
    })
  }

  const handlePassageMouseUp = () => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.toString().trim()) { setHlMenu(null); return }
    const text = sel.toString().trim()
    const rect = passageRef.current?.getBoundingClientRect()
    if (!rect) return
    const range = sel.getRangeAt(0)
    const rangeRect = range.getBoundingClientRect()
    hlSelectedRef.current = text
    setHlMenu({ x: rangeRect.left - rect.left + rangeRect.width / 2 - 120, y: rangeRect.top - rect.top - 50 })
  }

  const handleSelect = (idx) => {
    if (abcMode) {
      const key = 'q' + current
      setStrikethrough(prev => {
        const arr = prev[key] || []
        return { ...prev, [key]: arr.includes(idx) ? arr.filter(i => i !== idx) : [...arr, idx] }
      })
      return
    }
    setSelected(idx)
  }

  const isWrittenQ = (q) => q && (q.correct_index === -1 || !q.options?.length)

  const checkCorrect = (q, sel) => {
    if (isWrittenQ(q)) {
      return String(sel).trim().toLowerCase() === String(q.explanation).trim().toLowerCase()
    }
    return sel === q.correct_index
  }

  const handleNext = () => {
    const isCorrect = checkCorrect(currentQuestion, selected)
    const already = answers.findIndex(a => a.qIdx === current)
    let newAnswers
    if (already >= 0) {
      newAnswers = [...answers]
      newAnswers[already] = { qIdx: current, selected, correct: isCorrect, question: currentQuestion }
    } else {
      newAnswers = [...answers, { qIdx: current, selected, correct: isCorrect, question: currentQuestion }]
    }
    setAnswers(newAnswers)
    setSelected(null)
    setTotalElapsed(t => t + Math.floor((Date.now() - qStartRef.current) / 1000))
    qStartRef.current = Date.now()

    if (current + 1 >= questions.length) {
      setStep('review')
      setShowNav(true)
    } else {
      setCurrent(c => c + 1)
      setAbcMode(false)
    }
  }

  const handleJump = (idx) => {
    if (selected !== null && step === 'taking') {
      const isCorrect = checkCorrect(currentQuestion, selected)
      const already = answers.findIndex(a => a.qIdx === current)
      let newAnswers
      if (already >= 0) {
        newAnswers = [...answers]
        newAnswers[already] = { qIdx: current, selected, correct: isCorrect, question: q }
      } else {
        newAnswers = [...answers, { qIdx: current, selected, correct: isCorrect, question: q }]
      }
      setAnswers(newAnswers)
    }
    setCurrent(idx)
    setTotalElapsed(t => t + Math.floor((Date.now() - qStartRef.current) / 1000))
    qStartRef.current = new Date().getTime()
    setAbcMode(false)
    const jumpAns = (step === 'taking' && answers.find(a => a.qIdx === idx))
    setSelected(jumpAns ? jumpAns.selected : null)
    setShowNav(false)
  }

  const markReview = () => {
    setReviewMarked(prev =>
      prev.includes(current) ? prev.filter(i => i !== current) : [...prev, current]
    )
  }

  const handleFinish = async () => {
    setSaving(true)
    const score = answers.filter(a => a.correct).length

    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user?.id
    if (uid && topic) {
      const subjectId = topic.modules?.subject_id
      try {
        const ansData = answers.map(a => ({
          qIdx: a.qIdx, selected: a.selected, correct: a.correct,
          question: { id: a.question?.id, question_text: a.question?.question_text, options: a.question?.options, correct_index: a.question?.correct_index, explanation: a.question?.explanation, question_type: a.question?.question_type }
        }))
        const { data: testRes } = await supabase.from('practice_tests').insert({
          user_id: uid, title: topic.title, topic_id: topic.id,
          subject: topic.modules?.subjects?.title || '',
          score, total: answers.length,
          duration: Math.round((Date.now() - new Date(startedAt).getTime()) / 60000).toString(),
          answers: ansData,
        }).select('id').single()
        if (testRes) setSavedTestId(testRes.id)
        await Promise.all([
          supabase.from('user_progress').upsert({
            user_id: uid, module_id: topic.module_id,
            status: 'completed', score,
            completed_at: new Date().toISOString(),
          }, { onConflict: 'user_id,module_id' }),
          ...(subjectId ? [supabase.from('user_scores').upsert({
            user_id: uid, subject_id: subjectId,
            score, last_updated: new Date().toISOString(),
          }, { onConflict: 'user_id,subject_id' })] : []),
        ])
      } catch {
        toast.error('Error saving results')
        setSaving(false)
        return
      }
    }
    setSaving(false)
    setTotalElapsed(t => t + Math.floor((Date.now() - qStartRef.current) / 1000))
    setStep('done')
    toast.success('Natija saqlandi')
  }

  // Desmos: render via API when script is ready, show placeholder otherwise
  useEffect(() => {
    if (!showCalc) return
    const el = document.getElementById('desmos-container')
    if (!el) return

    const init = () => {
      if (window.Desmos && el) {
        window.Desmos.GraphingCalculator(el, {
          expressions: true, settingsMenu: true, zoomButtons: true, border: false,
        })
      }
    }

    if (window.Desmos) { init(); return }

    const check = () => { document.getElementById('desmos-api')?.removeEventListener('load', check); init() }
    document.getElementById('desmos-api')?.addEventListener('load', check)
  }, [showCalc])

  const renderQuestionText = (text) => {
    if (!text) return null
    const parts = text.split(/(<img[^>]+>)/g)
    return parts.map((part, i) => {
      if (part.startsWith('<img')) {
        const match = part.match(/src="([^"]+)"/)
        const src = match ? match[1] : ''
        return <img key={i} src={src} alt="" className="bb-inline-img" draggable="false" onContextMenu={e => e.preventDefault()} />
      }
      return <span key={i} dangerouslySetInnerHTML={{ __html: part }} />
    })
  }

  const hasInlineImg = useMemo(
    () => /<img\s[^>]*src=/i.test(effectiveQText || ''),
    [effectiveQText]
  )

  const renderedQuestionText = useMemo(
    () => {
      const text = effectiveQText
      if (!text) return null
      if (!hasInlineImg) return <div className="bb-q-text" dangerouslySetInnerHTML={{ __html: text }} />
      const parts = text.split(/(<img[^>]+>)/g)
      return parts.map((part, i) => {
        if (part.startsWith('<img')) {
          const match = part.match(/src="([^"]+)"/)
          const src = match ? match[1] : ''
          return <img key={i} src={src} alt="" className="bb-inline-img" draggable="false" onContextMenu={e => e.preventDefault()} />
        }
        return <span key={i} dangerouslySetInnerHTML={{ __html: part }} />
      })
    },
    [effectiveQText, hasInlineImg]
  )

  const correctCount = useMemo(() => answers.filter(a => a.correct).length, [answers])

  if (loading) return <div className="test-loading" />
  if (!topic) return <div className="test-loading"><div className="test-loading-text">TOPIC NOT FOUND</div></div>
  if (!questions.length) return (
    <div className="bb-empty-state">
      <div className="bb-empty-icon">📭</div>
      <h2 className="bb-empty-title">Bu modulda savollar yo'q</h2>
      <p className="bb-empty-text">"{topic.title}" moduliga hozircha savollar qo'shilmagan. Boshqa modulni tanlang.</p>
      <button className="bb-empty-btn" onClick={() => navigate('/dashboard')}>Bosh sahifaga qaytish</button>
    </div>
  )

  if (step === 'done') {
    const pct = answers.length ? Math.round(correctCount / answers.length * 100) : 0
    return (
      <div className="test-done">
        <div className="test-done-header">
          <div className="test-done-title">TEST RESULTS</div>
          <div className="test-done-subject">{topic.modules?.title || ''} &mdash; {topic.title}</div>
          <div className="test-done-score">
            <span className="test-done-num">{correctCount}</span>
            <span className="test-done-sep">/</span>
            <span className="test-done-total">{answers.length}</span>
          </div>
          <div className="test-done-bar-wrap"><div className="test-done-bar"><div className="test-done-fill" style={{ width: pct + '%' }} /></div></div>
          <div className="test-done-pct">{pct}% Correct</div>
          <div className="test-done-stats">
            <div className="test-done-stat">
              <span className="test-done-stat-num correct">{answers.filter(a => a.correct).length}</span>
              <span className="test-done-stat-label">Correct</span>
            </div>
            <div className="test-done-stat">
              <span className="test-done-stat-num wrong">{answers.filter(a => !a.correct).length}</span>
              <span className="test-done-stat-label">Incorrect</span>
            </div>
            <div className="test-done-stat">
              <span className="test-done-stat-num">{answers.length}</span>
              <span className="test-done-stat-label">Total</span>
            </div>
          </div>
          <div className="test-done-meta">
            <div className="test-done-meta-row">
              <span className="test-done-meta-label">Student</span>
              <span className="test-done-meta-value">{displayName}</span>
            </div>
            <div className="test-done-meta-row">
              <span className="test-done-meta-label">Date</span>
              <span className="test-done-meta-value">{startedAt ? new Date(startedAt).toLocaleDateString() : '-'}</span>
            </div>
            <div className="test-done-meta-row">
              <span className="test-done-meta-label">Duration</span>
              <span className="test-done-meta-value">{formatTime(totalElapsed)}</span>
            </div>
          </div>
          <div className="test-done-actions">
            <button className="test-done-btn" onClick={() => setShowCert(true)}>VIEW CERTIFICATE</button>
            {savedTestId && <button className="test-done-btn" onClick={() => navigate('/test-review/' + savedTestId)}>DETAILED REVIEW</button>}
            <button className="test-done-btn secondary" onClick={() => navigate('/dashboard')}>BACK TO DASHBOARD</button>
          </div>
        </div>

        {showCert ? (
          <div className="test-done-cert" id="done-cert-panel">
            <div className="cert" id="cert">
              <div className="cert-top">
                <div className="cert-logo">SATAP</div>
                <div className="cert-badge">ACADEMY</div>
              </div>
              <div className="cert-seal">&#9733;</div>
              <div className="cert-title">CERTIFICATE OF ACHIEVEMENT</div>
              <div className="cert-sub">This certifies that</div>
              <div className="cert-name">{displayName}</div>
              <div className="cert-sub">has successfully completed</div>
              <div className="cert-test-name">{topic.title}</div>
              <div className="cert-score-row">
                <div className="cert-score-item">
                  <div className="cert-score-num">{correctCount}</div>
                  <div className="cert-score-label">CORRECT</div>
                </div>
                <div className="cert-score-divider">&times;</div>
                <div className="cert-score-item">
                  <div className="cert-score-num">{answers.length}</div>
                  <div className="cert-score-label">TOTAL</div>
                </div>
                <div className="cert-score-divider">&times;</div>
                <div className="cert-score-item">
                  <div className="cert-score-num">{pct}%</div>
                  <div className="cert-score-label">SCORE</div>
                </div>
              </div>
              <div className="cert-date">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
              <div className="cert-footer">SATAP Academy — Excellence in Test Preparation</div>
            </div>
            <div className="cert-actions">
              <button className="test-done-btn" onClick={async () => {
                const el = document.getElementById('cert')
                if (!el) return
                const { default: html2canvas } = await import('html2canvas')
                const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' })
                const link = document.createElement('a')
                link.download = 'SATAP-Certificate-' + topic.title.replace(/\s+/g, '-') + '.png'
                link.href = canvas.toDataURL()
                link.click()
              }}>DOWNLOAD CERTIFICATE</button>
              <button className="test-done-btn secondary" onClick={() => setShowCert(false)}>BACK TO REVIEW</button>
            </div>
          </div>
        ) : (
          <div className="test-done-review">
            <div className="test-done-review-header">
              <span className="test-done-review-title">Question Review</span>
              <span className="test-done-review-summary">{answers.filter(a => a.correct).length} correct &middot; {answers.filter(a => !a.correct).length} incorrect</span>
            </div>
            <div className="test-done-q-grid">
            {answers.map((a, i) => {
              const q = a.question
              const isCorrect = a.correct
              const isOpen = expExplain === i
              return (
                <div key={i} className={'test-done-q' + (isCorrect ? ' correct' : ' wrong')}>
                  <div className="test-done-q-header">
                    <span className="test-done-q-num">Question {i + 1}</span>
                    <span className={'test-done-q-status' + (isCorrect ? ' correct' : ' wrong')}>
                      {isCorrect ? 'CORRECT' : 'WRONG'}
                    </span>
                  </div>
                  <div className="test-done-q-text">{renderQuestionText(q?.question_text)}</div>
                  {isWrittenQ(q) ? (
                    <div className="test-done-q-options">
                      <div className="test-done-written-review">
                        <div className="test-done-written-row">
                          <span className="test-done-written-label">Your answer:</span>
                          <span className={'test-done-written-val' + (isCorrect ? ' correct' : ' wrong')}>{a.selected || '(empty)'}</span>
                        </div>
                        {!isCorrect && (
                          <div className="test-done-written-row">
                            <span className="test-done-written-label">Correct answer:</span>
                            <span className="test-done-written-val correct">{q?.explanation}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="test-done-q-options">
                      {q?.options.map((opt, oi) => {
                        const isSelected = a.selected === oi
                        const isRight = q.correct_index === oi
                        let cls = 'test-done-opt'
                        if (isSelected && isCorrect) cls += ' selected-correct'
                        else if (isSelected && !isCorrect) cls += ' selected-wrong'
                        else if (isRight && !isSelected) cls += ' correct-answer'
                        return (
                          <div key={oi} className={cls}>
                            <span className="test-done-opt-letter">{String.fromCharCode(65 + oi)}</span>
                            <span className="test-done-opt-text">{opt}</span>
                            {isRight && <span className="test-done-opt-check">&check;</span>}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {q && !isWrittenQ(q) && !isCorrect && (
                    <div className="test-done-explain-wrap">
                      <button className="test-done-explain-btn" onClick={() => setExpExplain(isOpen ? null : i)}>
                        {isOpen ? 'HIDE EXPLANATION' : 'VIEW EXPLANATION'}
                      </button>
                      {isOpen && q?.explanation && (
                        <div className="test-done-explain">{q.explanation}</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bb">
      {/* TOP NAV */}
      <div className="bb-top">
        <div className="bb-top-title">{topic.modules?.title || 'Test'} &mdash; {topic.title}</div>
        <QuestionTimer key={current} startTime={qStartRef.current} />
        <div className="bb-top-right">
          <button className="bb-icon-btn" title="Reference" onClick={() => setShowRef(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
          <button className="bb-icon-btn" title="Calculator" onClick={() => setShowCalc(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="16" y2="18"/></svg>
          </button>
          {IS_PRACTICE && (
            <button className="bb-icon-btn" title="Explanation (⌘A / Ctrl+A)" onClick={() => setShowAITutor(true)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21h6M12 17v4M12 3a7 7 0 0 0-4 12.7c.7.6 1 1.5 1 2.3v1h6v-1c0-.8.3-1.7 1-2.3A7 7 0 0 0 12 3z"/></svg>
            </button>
          )}
          <button className="bb-icon-btn" title="Home" onClick={() => { if (window.confirm('Exit test?')) navigate('/dashboard') }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </button>
        </div>
      </div>

      <hr className="bb-divider" />

      {/* BODY */}
      {(currentQuestion?.image_url || hasInlineImg || effectivePassage) ? (
      <div className="bb-body bb-body-split">
        <div className="bb-left" ref={passageRef} onMouseUp={handlePassageMouseUp} style={{ position: 'relative' }}>
          {effectivePassage ? (
            <>
              <div className="bb-passage-split" dangerouslySetInnerHTML={{ __html: getHighlightedHTML(effectivePassage.replace(/\s+/g, ' ').trim()) }} />
              {hlMenu && (
                <div className="hl-toolbar" style={{ left: hlMenu.x, top: hlMenu.y }}>
                  {HL_COLORS.map(c => (
                    <button key={c.name} className="hl-btn" title={c.name} onClick={() => applyHighlight(c)} style={{ background: c.color, borderBottom: `2px solid ${c.border}` }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.border} strokeWidth="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    </button>
                  ))}
                  <button className="hl-btn hl-btn-close" onClick={() => { window.getSelection()?.removeAllRanges(); setHlMenu(null) }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              )}
              {(highlights['q' + current] || []).length > 0 && (
                <div className="hl-list">
                  {highlights['q' + current].map((h, i) => (
                    <span key={i} className="hl-chip" style={{ background: h.color, borderBottomColor: h.border }}>
                      {h.text}
                      <button className="hl-chip-x" onClick={() => removeHighlight(i)}>&times;</button>
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : currentQuestion?.image_url && (
            <img src={currentQuestion.image_url} alt="" className="bb-left-img" draggable="false" onContextMenu={e => e.preventDefault()} />
          )}
        </div>
        <div className="bb-right">
          <div className="bb-q-header">
            <div className="bb-q-header-left">
              <div className="bb-q-num">{current + 1}</div>
              <button className={'bb-mark-btn' + (reviewMarked.includes(current) ? ' marked' : '')} onClick={markReview}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill={reviewMarked.includes(current) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                Mark for Review
              </button>
            </div>
            {!isWrittenQ(currentQuestion) && (
              <button className={'bb-abc-btn' + (abcMode ? ' active' : '')} onClick={() => setAbcMode(v => !v)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/></svg>
                ABC
              </button>
            )}
          </div>
          {effectiveQText && (
            <div className="bb-q-text" dangerouslySetInnerHTML={{ __html: effectiveQText }} />
          )}
          {isWrittenQ(currentQuestion) ? (
          <div className="bb-choices">
            <textarea className="bb-written-input" rows={1} value={selected || ''} onChange={e => setSelected(e.target.value)} placeholder="Type your answer..." />
          </div>
        ) : (
          <div className="bb-choices">
            {currentQuestion.options.map((opt, i) => (
              <div key={i} className={'bb-choice' + (selected === i ? ' selected' : '') + ((strikethrough['q' + current] || []).includes(i) ? ' struck' : '')} onClick={() => handleSelect(i)}>
                <div className="bb-choice-letter">{String.fromCharCode(65 + i)}</div>
                <div className="bb-choice-text">{opt}</div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
      ) : (
      <div className="bb-body">
        <div className="bb-body-inner">
          {currentQuestion && (
            <>
              <div className="bb-q-header">
                <div className="bb-q-header-left">
                  <div className="bb-q-num">{current + 1}</div>
                  <button className={'bb-mark-btn' + (reviewMarked.includes(current) ? ' marked' : '')} onClick={markReview}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={reviewMarked.includes(current) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    Mark for Review
                  </button>
                </div>
                {!isWrittenQ(currentQuestion) && (
                  <button className={'bb-abc-btn' + (abcMode ? ' active' : '')} onClick={() => setAbcMode(v => !v)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/></svg>
                    ABC
                  </button>
                )}
              </div>
              {currentQuestion?.image_url && (
                <img src={currentQuestion.image_url} alt="" className="bb-q-img" draggable="false" onContextMenu={e => e.preventDefault()} />
              )}
              {effectiveQText && !hasInlineImg && (
                <div className="bb-passage" dangerouslySetInnerHTML={{ __html: effectiveQText }} />
              )}
              {effectiveQText && hasInlineImg && (
                <div className="bb-q-text">{renderQuestionText(effectiveQText)}</div>
              )}
              {isWrittenQ(currentQuestion) ? (
              <div className="bb-choices">
                <textarea className="bb-written-input" rows={1} value={selected || ''} onChange={e => setSelected(e.target.value)} placeholder="Type your answer..." />
              </div>
            ) : (
              <div className="bb-choices">
                {currentQuestion.options.map((opt, i) => (
                  <div key={i} className={'bb-choice' + (selected === i ? ' selected' : '') + ((strikethrough['q' + current] || []).includes(i) ? ' struck' : '')} onClick={() => handleSelect(i)}>
                    <div className="bb-choice-letter">{String.fromCharCode(65 + i)}</div>
                    <div className="bb-choice-text">{opt}</div>
                  </div>
                ))}
              </div>
            )}
            </>
          )}
        </div>
      </div>
      )}

      <hr className="bb-divider" />

      {/* BOTTOM NAV */}
      <div className="bb-bottom">
        <div className="bb-bottom-name">{displayName}</div>
        <button className="bb-counter-btn" onClick={() => setShowNav(true)}>
          Question {current + 1} of {questions.length}
        </button>
        <div className="bb-bottom-right">
          {step === 'taking' ? (
            <button className="bb-next-btn" onClick={handleNext}>
              {current + 1 >= questions.length ? 'Review' : 'Next'}
            </button>
          ) : (
            <button className="bb-next-btn" onClick={handleFinish} disabled={saving}>
              {saving ? 'SAVING...' : 'FINISH TEST'}
            </button>
          )}
        </div>
      </div>

      {/* REFERENCE SHEET — slides in from right */}
      <div className={'bb-ref-overlay' + (showRef ? ' open' : '')} onClick={() => setShowRef(false)}>
        <div className={'bb-ref-panel' + (showRef ? ' open' : '')} onClick={(e) => e.stopPropagation()}>
          <div className="bb-ref-header">
            Reference Sheet
            <button className="bb-modal-close" onClick={() => setShowRef(false)}>&times;</button>
          </div>
          <div className="bb-ref-body">
            <div className="bb-ref-section bb-ref-row-layout">
              <div className="bb-ref-formulas">
                <h3>Area</h3>
                <div className="bb-ref-row">Rectangle: <em>A = ℓw</em></div>
                <div className="bb-ref-row">Triangle: <em>A = ½bh</em></div>
                <div className="bb-ref-row">Parallelogram: <em>A = bh</em></div>
                <div className="bb-ref-row">Trapezoid: <em>A = ½(b₁ + b₂)h</em></div>
              </div>
              <svg viewBox="0 0 120 90" className="bb-ref-diagram">
                <rect x="8" y="18" width="104" height="55" fill="none" stroke="#000" strokeWidth="2"/>
                <line x1="8" y1="38" x2="112" y2="38" stroke="#000" strokeWidth="1" strokeDasharray="4,3"/>
                <text x="14" y="36" fontSize="11" fontWeight="700">w</text>
                <text x="50" y="76" fontSize="11" fontWeight="700">ℓ</text>
              </svg>
            </div>
            <div className="bb-ref-section bb-ref-row-layout">
              <div className="bb-ref-formulas">
                <h3>Volume</h3>
                <div className="bb-ref-row">Rectangular Prism: <em>V = ℓwh</em></div>
                <div className="bb-ref-row">Cylinder: <em>V = πr²h</em></div>
                <div className="bb-ref-row">Sphere: <em>V = ⁴⁄₃πr³</em></div>
                <div className="bb-ref-row">Cone: <em>V = ⅓πr²h</em></div>
                <div className="bb-ref-row">Pyramid: <em>V = ⅓Bh</em></div>
              </div>
              <svg viewBox="0 0 120 90" className="bb-ref-diagram">
                <rect x="8" y="34" width="60" height="40" fill="none" stroke="#000" strokeWidth="2"/>
                <polygon points="8,34 25,15 85,15 68,34" fill="none" stroke="#000" strokeWidth="2"/>
                <rect x="25" y="15" width="60" height="40" fill="none" stroke="#000" strokeWidth="1" strokeDasharray="3,2"/>
                <line x1="68" y1="34" x2="85" y2="15" stroke="#000" strokeWidth="2"/>
                <text x="36" y="28" fontSize="9" fontWeight="700">h</text>
                <text x="30" y="72" fontSize="9" fontWeight="700">ℓ</text>
                <text x="70" y="72" fontSize="9" fontWeight="700">w</text>
              </svg>
            </div>
            <div className="bb-ref-section bb-ref-row-layout">
              <div className="bb-ref-formulas">
                <h3>Special Triangles</h3>
                <div className="bb-ref-row"><em>a² + b² = c²</em></div>
                <div className="bb-ref-row">3-4-5 Triangle</div>
                <div className="bb-ref-row">30-60-90: <em>x, x√3, 2x</em></div>
                <div className="bb-ref-row">45-45-90: <em>x, x, x√2</em></div>
              </div>
              <svg viewBox="0 0 120 90" className="bb-ref-diagram">
                <polygon points="10,80 80,80 10,15" fill="none" stroke="#000" strokeWidth="2"/>
                <rect x="10" y="73" width="7" height="7" fill="none" stroke="#000" strokeWidth="1"/>
                <text x="7" y="55" fontSize="10" fontWeight="700" transform="rotate(-90,7,55)">a</text>
                <text x="38" y="84" fontSize="10" fontWeight="700">b</text>
                <text x="28" y="42" fontSize="10" fontWeight="700" transform="rotate(-45,28,42)">c</text>
              </svg>
            </div>
            <div className="bb-ref-section bb-ref-row-layout">
              <div className="bb-ref-formulas">
                <h3>Circles</h3>
                <div className="bb-ref-row">Circumference: <em>C = 2πr</em></div>
                <div className="bb-ref-row">Area: <em>A = πr²</em></div>
                <div className="bb-ref-row">Arc Length: <em>s = rθ</em></div>
                <div className="bb-ref-row">Equation: <em>(x−h)²+(y−k)²=r²</em></div>
              </div>
              <svg viewBox="0 0 120 90" className="bb-ref-diagram">
                <circle cx="60" cy="45" r="28" fill="none" stroke="#000" strokeWidth="2"/>
                <line x1="60" y1="45" x2="85" y2="28" stroke="#000" strokeWidth="1"/>
                <text x="78" y="26" fontSize="10" fontWeight="700">r</text>
                <line x1="60" y1="45" x2="82" y2="58" stroke="#000" strokeWidth="1"/>
                <path d="M60,17 A28,28 0 0,1 85,28" fill="none" stroke="#000" strokeWidth="1" strokeDasharray="3,2"/>
                <text x="60" y="62" fontSize="9" fontWeight="700">θ</text>
                <text x="20" y="82" fontSize="9" fontWeight="600">(h,k)</text>
                <circle cx="32" cy="45" r="3" fill="#000" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* CALCULATOR — draggable + resizable, closes ONLY via X */}
      {showCalc && (
        <div className="bb-calc-overlay">
          <div
            className="bb-calc-modal"
            style={{ left: calcPos.x + 'px', top: calcPos.y + 'px', width: calcSize.w + 'px', height: calcSize.h + 'px' }}
          >
            <div
              className="bb-calc-header"
              onMouseDown={(e) => {
                const startX = e.clientX
                const startY = e.clientY
                const startPos = { ...calcPos }
                const onMove = (ev) => {
                  setCalcPos({ x: startPos.x + ev.clientX - startX, y: startPos.y + ev.clientY - startY })
                }
                const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
                document.addEventListener('mousemove', onMove)
                document.addEventListener('mouseup', onUp)
              }}
            >
              <span>Desmos Graphing Calculator</span>
              <button className="bb-modal-close" onClick={() => setShowCalc(false)}>&times;</button>
            </div>
            <div id="desmos-container" className="bb-calc-frame" />
            <div
              className="bb-calc-resize"
              onMouseDown={(e) => {
                e.stopPropagation()
                const startX = e.clientX
                const startY = e.clientY
                const startSize = { ...calcSize }
                const onMove = (ev) => {
                  setCalcSize({ w: Math.max(200, startSize.w + ev.clientX - startX), h: Math.max(200, startSize.h + ev.clientY - startY) })
                }
                const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
                document.addEventListener('mousemove', onMove)
                document.addEventListener('mouseup', onUp)
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/></svg>
            </div>
          </div>
        </div>
      )}

      {/* MODAL */}
      {showNav && (
        <div className="bb-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowNav(false) }}>
          <div className="bb-modal">
            <div className="bb-modal-header">
              {topic.title}
              <button className="bb-modal-close" onClick={() => setShowNav(false)}>&times;</button>
            </div>
            <div className="bb-modal-legend">
              <div className="bb-legend-item"><div className="bb-legend-box bb-legend-current" /> Current</div>
              <div className="bb-legend-item"><div className="bb-legend-box bb-legend-unanswered" /> Unanswered</div>
              <div className="bb-legend-item"><div className="bb-legend-box bb-legend-review" /> For Review</div>
            </div>
            <div className="bb-modal-grid">
              {questions.map((_, i) => {
                const isAnswered = answers.some(a => a.qIdx === i)
                const isCurrent = i === current
                const isReview = reviewMarked.includes(i)
                return (
                  <div
                    key={i}
                    className={'bb-grid-cell' + (isCurrent ? ' current' : '') + (isAnswered ? ' answered' : '') + (isReview ? ' review' : '')}
                    onClick={() => handleJump(i)}
                  >{i + 1}</div>
                )
              })}
            </div>
            <div className="bb-modal-footer">
              {step === 'review' ? (
                <button className="bb-review-btn" onClick={() => { setShowNav(false); handleFinish() }} disabled={saving}>
                  {saving ? 'SAVING...' : 'FINISH TEST'}
                </button>
              ) : (
                <button className="bb-review-btn" onClick={() => { setShowNav(false); handleNext() }}>Go to Review Page</button>
              )}
            </div>
          </div>
        </div>
      )}

      {showAITutor && currentQuestion && IS_PRACTICE && (
        <AITutor question={currentQuestion} userAnswer={selected} onClose={() => setShowAITutor(false)} />
      )}
    </div>
  )
}
