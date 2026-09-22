import { useState, useMemo } from 'react'
import katex from 'katex'
import { explainQuestion } from '../lib/groq'

function renderMathText(raw) {
  if (!raw) return ''
  let text = raw
  // Display math $$...$$ or \[...\]
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    try {
      return `<div class="aitutor-math-block">${katex.renderToString(math.trim(), { displayMode: true, throwOnError: false })}</div>`
    } catch {
      return `<div class="aitutor-math-block">${math}</div>`
    }
  }).replace(/\\\[([\s\S]+?)\\\]/g, (_, math) => {
    try {
      return `<div class="aitutor-math-block">${katex.renderToString(math.trim(), { displayMode: true, throwOnError: false })}</div>`
    } catch {
      return `<div class="aitutor-math-block">${math}</div>`
    }
  })

  // Inline math $...$ or \(...\)
  text = text.replace(/\$([^$\n]+?)\$/g, (_, math) => {
    try {
      return `<span class="aitutor-math-inline">${katex.renderToString(math.trim(), { displayMode: false, throwOnError: false })}</span>`
    } catch {
      return `<span class="aitutor-math-inline">${math}</span>`
    }
  }).replace(/\\\(([\s\S]+?)\\\)/g, (_, math) => {
    try {
      return `<span class="aitutor-math-inline">${katex.renderToString(math.trim(), { displayMode: false, throwOnError: false })}</span>`
    } catch {
      return `<span class="aitutor-math-inline">${math}</span>`
    }
  })

  // Markdown bold
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  // Newlines
  text = text.replace(/\n/g, '<br/>')
  return text
}

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

  const html = useMemo(() => renderMathText(explanation), [explanation])

  // Custom renderer to support images in standard explanation
  const renderStandardExplanation = (text) => {
    if (!text) return null
    const parts = text.split(/(<img[^>]+>)/g)
    return parts.map((part, i) => {
      if (part.startsWith('<img')) {
        const match = part.match(/src="([^"]+)"/)
        const src = match ? match[1] : ''
        return <img key={i} src={src} alt="" style={{ maxWidth: '100%', borderRadius: '8px', margin: '10px 0' }} draggable="false" />
      }
      return <span key={i} dangerouslySetInnerHTML={{ __html: part }} />
    })
  }

  return (
    <div className="aitutor-overlay" onClick={onClose}>
      <div className="aitutor-modal" onClick={e => e.stopPropagation()}>
        <div className="aitutor-header">
          <div className="aitutor-header-left">
            <span className="aitutor-icon">💡</span>
            <h3>Explanation</h3>
          </div>
          <button className="aitutor-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="aitutor-body">
          {/* Standard Explanation */}
          {question?.explanation && (
            <div style={{ padding: '16px', background: '#f5f7f9', borderRadius: '8px', marginBottom: '16px', border: '1px solid #e2e8f0', color: '#333' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#1a1f36', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                Standard Tushuntirish
              </h4>
              <div style={{ lineHeight: '1.6' }}>
                {renderStandardExplanation(question.explanation)}
              </div>
            </div>
          )}

          {/* AI Explanation Area */}
          {!explanation && !loading && !error && (
            <div className="aitutor-intro">
              <p className="aitutor-intro-text">Savolga sun'iy intellekt orqali qadam-ba-qadam tushuntirish olmoqchimisiz?</p>
              <button className="aitutor-btn" onClick={handleExplain}>
                ✨ AI Tushuntirish
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
              <div style={{ borderTop: question?.explanation ? '1px dashed #ccc' : 'none', paddingTop: question?.explanation ? '16px' : '0', marginTop: '16px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#8a2be2', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ✨ AI Tushuntirish
                </h4>
                <div className="aitutor-explanation" dangerouslySetInnerHTML={{ __html: html }} />
              </div>
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
