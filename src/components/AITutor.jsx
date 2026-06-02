import { useState } from 'react'
import { explainQuestion } from '../lib/groq'

export default function AITutor({ question, userAnswer, onClose }) {
  const [explanation, setExplanation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleExplain() {
    setLoading(true)
    setError('')
    try {
      const text = await explainQuestion(question, userAnswer)
      setExplanation(text)
    } catch (e) {
      setError(e.message || 'Xato yuz berdi')
    } finally {
      setLoading(false)
    }
  }

  const html = explanation
    .replace(/\$\$([^$]+)\$\$/g, '<div class="aitutor-math">$1</div>')
    .replace(/\$([^$]+)\$/g, '<span class="aitutor-math">$1</span>')
    .replace(/\n/g, '<br/>')

  return (
    <div className="aitutor-overlay" onClick={onClose}>
      <div className="aitutor-modal" onClick={e => e.stopPropagation()}>
        <div className="aitutor-header">
          <div className="aitutor-header-left">
            <span className="aitutor-icon">✨</span>
            <h3>AI Tutor</h3>
          </div>
          <button className="aitutor-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="aitutor-body">
          {!explanation && !loading && !error && (
            <div className="aitutor-intro">
              <p className="aitutor-intro-text">Bu savol uchun AI tushuntirish olmoqchimisiz?</p>
              <button className="aitutor-btn" onClick={handleExplain}>
                ✨ Tushuntirish olish
              </button>
            </div>
          )}
          {loading && (
            <div className="aitutor-loading">
              <div className="aitutor-spinner"></div>
              <p>AI tushuntirish tayyorlamoqda...</p>
            </div>
          )}
          {error && (
            <div className="aitutor-error">
              <strong>Xato:</strong> {error}
              <button className="aitutor-retry" onClick={handleExplain}>Qayta urinish</button>
            </div>
          )}
          {explanation && (
            <>
              <div className="aitutor-explanation" dangerouslySetInnerHTML={{ __html: html }} />
              <button className="aitutor-rebtn" onClick={handleExplain}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                Qayta
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
