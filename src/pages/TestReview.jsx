import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useLayout } from '../components/DashLayout'

function renderQuestionText(text) {
  if (!text) return ''
  const parts = text.split(/(<[^>]+>)/g)
  return parts.map((part, i) => {
    if (part.startsWith('<')) return <span key={i} dangerouslySetInnerHTML={{ __html: part }} />
    return <span key={i}>{part}</span>
  })
}

export default function TestReview() {
  const { testId } = useParams()
  const navigate = useNavigate()
  const { setPageTitle, setPageSub, setPageClass } = useLayout()
  const [test, setTest] = useState(null)
  const [expExplain, setExpExplain] = useState(null)

  useEffect(() => {
    setPageTitle('TEST REVIEW')
    setPageSub('Detailed answer review')
    setPageClass('test-review')
  }, [])

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('practice_tests').select('*').eq('id', testId).single()
      if (data) setTest(data)
    })()
  }, [testId])

  if (!test) return null

  const answers = test.answers || []
  const correctCount = answers.filter(a => a.correct).length
  const total = answers.length
  const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0
  const formatDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="tr-wrap">
      <div className="tr-header">
        <div className="tr-header-left">
          <span className="tr-subject">{test.subject || 'General'}</span>
          <span className="tr-title">{test.title}</span>
          <span className="tr-date">{formatDate(test.taken_at)}</span>
        </div>
        <div className="tr-header-right">
          <span className={`tr-score ${pct >= 80 ? 'th-high' : pct >= 50 ? 'th-mid' : 'th-low'}`}>{correctCount}/{total}</span>
          <span className="tr-pct">{pct}%</span>
          <span className="tr-duration">{test.duration} min</span>
        </div>
      </div>

      <div className="tr-stats">
        <div className="tr-stat correct">
          <span className="tr-stat-val">{correctCount}</span>
          <span className="tr-stat-lbl">Correct</span>
        </div>
        <div className="tr-stat wrong">
          <span className="tr-stat-val">{total - correctCount}</span>
          <span className="tr-stat-lbl">Incorrect</span>
        </div>
        <div className="tr-stat">
          <span className="tr-stat-val">{pct}%</span>
          <span className="tr-stat-lbl">Score</span>
        </div>
      </div>

      <div className="tr-list">
        {answers.map((a, i) => {
          const q = a.question
          const isCorrect = a.correct
          const isOpen = expExplain === i
          return (
            <div key={i} className={'tr-q' + (isCorrect ? ' correct' : ' wrong')}>
              <div className="tr-q-header">
                <span className="tr-q-num">Question {i + 1}</span>
                <span className={'tr-q-status' + (isCorrect ? ' correct' : ' wrong')}>
                  {isCorrect ? 'CORRECT' : 'WRONG'}
                </span>
              </div>
              <div className="tr-q-text">{renderQuestionText(q?.question_text)}</div>
              {q?.question_type === 'written' ? (
                <div className="tr-q-options">
                  <div className="tr-written-review">
                    <div className="tr-written-row">
                      <span className="tr-written-label">Your answer:</span>
                      <span className={'tr-written-val' + (isCorrect ? ' correct' : ' wrong')}>{a.selected || '(empty)'}</span>
                    </div>
                    {!isCorrect && (
                      <div className="tr-written-row">
                        <span className="tr-written-label">Correct answer:</span>
                        <span className="tr-written-val correct">{q?.explanation}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="tr-q-options">
                  {q?.options?.map((opt, oi) => {
                    const isSelected = a.selected === oi
                    const isRight = q.correct_index === oi
                    let cls = 'tr-opt'
                    if (isSelected && isCorrect) cls += ' selected-correct'
                    else if (isSelected && !isCorrect) cls += ' selected-wrong'
                    else if (isRight && !isSelected) cls += ' correct-answer'
                    return (
                      <div key={oi} className={cls}>
                        <span className="tr-opt-letter">{String.fromCharCode(65 + oi)}</span>
                        <span className="tr-opt-text">{opt}</span>
                        {isRight && <span className="tr-opt-check">&check;</span>}
                      </div>
                    )
                  })}
                </div>
              )}
              {q && q.question_type !== 'written' && !isCorrect && (
                <div className="tr-explain-wrap">
                  <button className="tr-explain-btn" onClick={() => setExpExplain(isOpen ? null : i)}>
                    {isOpen ? 'HIDE EXPLANATION' : 'VIEW EXPLANATION'}
                  </button>
                  {isOpen && q?.explanation && (
                    <div className="tr-explain">{q.explanation}</div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="tr-actions">
        <button className="btn btn-primary" onClick={() => navigate('/test-history')}>
          BACK TO HISTORY
        </button>
      </div>
    </div>
  )
}
