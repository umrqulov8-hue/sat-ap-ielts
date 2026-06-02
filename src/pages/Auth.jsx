import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Auth() {
  const [mode, setMode] = useState('signin')
  const [displayedMode, setDisplayedMode] = useState('signin')
  const [textPhase, setTextPhase] = useState('in') // 'in' | 'out'
  const [signUp, setSignUp] = useState({ email: '', password: '', confirm: '' })
  const [signIn, setSignIn] = useState({ email: '', password: '' })
  const [terms, setTerms] = useState(false)
  const [errors, setErrors] = useState({})
  const [visible, setVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [signedUp, setSignedUp] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotErr, setForgotErr] = useState('')
  const navigate = useNavigate()
  const containerRef = useRef(null)

  useEffect(() => {
    if (mode !== displayedMode) {
      setTextPhase('out')
      const t = setTimeout(() => {
        setDisplayedMode(mode)
        setTextPhase('in')
      }, 320)
      return () => clearTimeout(t)
    }
  }, [mode, displayedMode])

  const switchMode = (next) => {
    setErrors({})
    setShowForgot(false)
    setMode(next)
  }

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/dashboard', { replace: true })
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) navigate('/dashboard', { replace: true })
    })
    return () => subscription?.unsubscribe()
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') navigate('/') }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  const validateSignUp = () => {
    const errs = {}
    if (!signUp.email.includes('@')) errs.email = 'Email noto\'g\'ri'
    if (signUp.password.length < 6) errs.password = 'Kamida 6 ta belgi'
    if (signUp.password !== signUp.confirm) errs.confirm = 'Parollar mos kelmadi'
    if (!terms) errs.terms = 'Shartlarni qabul qiling'
    return errs
  }

  const validateSignIn = () => {
    const errs = {}
    if (!signIn.email.includes('@')) errs.email = 'Email noto\'g\'ri'
    if (!signIn.password) errs.password = 'Parolni kiriting'
    return errs
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    const errs = validateSignUp()
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSubmitting(true)
    const { error } = await supabase.auth.signUp({
      email: signUp.email,
      password: signUp.password,
      options: { emailRedirectTo: window.location.origin }
    })
    setSubmitting(false)
    if (error) {
      setErrors({ general: error.message })
    } else {
      setSignedUp(true)
    }
  }

  const handleSignIn = async (e) => {
    e.preventDefault()
    const errs = validateSignIn()
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: signIn.email,
      password: signIn.password
    })
    setSubmitting(false)
    if (error) {
      setErrors({ general: 'Email yoki parol noto\'g\'ri' })
    }
  }

  const handleForgot = async (e) => {
    e.preventDefault()
    setForgotErr('')
    if (!forgotEmail.includes('@')) {
      setForgotErr('Email noto\'g\'ri')
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: window.location.origin + '/auth'
    })
    if (error) {
      setForgotErr(error.message)
    } else {
      setForgotSent(true)
    }
  }

  return (
    <div className="modal-backdrop" ref={containerRef} onClick={(e) => { if (e.target === e.currentTarget) navigate('/') }}>
      <div className={`modal ${mode}${visible ? ' active' : ''}`} onClick={(e) => e.stopPropagation()}>

        <div className="modal-marketing">
          <div className="modal-marketing-brand">SATAP ACADEMY</div>
          <div className="modal-marketing-center" key={`center-${displayedMode}`}>
            <div className={`modal-text ${textPhase === 'out' ? 'out' : 'in'}`}>
              {displayedMode === 'signin' ? (
                <>
                  <h2 className="modal-marketing-heading">YANGI<br />MISIZ?</h2>
                  <p className="modal-marketing-sub">Ro'yxatdan o'ting va professional SAT/AP tayyorlovni boshlang.</p>
                </>
              ) : (
                <>
                  <h2 className="modal-marketing-heading">BIZDAN<br />MISIZ?</h2>
                  <p className="modal-marketing-sub">Hisobingizga kiring va o'rganishni davom eting.</p>
                </>
              )}
            </div>
          </div>
          <button className="modal-marketing-btn" onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>
            {displayedMode === 'signin' ? "RO'YXATDAN O'TISH" : 'KIRISH'}
          </button>
        </div>

        <div className="modal-form-panel">
          <button className="modal-close" onClick={() => navigate('/')} aria-label="Close">×</button>

          {signedUp ? (
            <div className="modal-form-inner modal-success-wrap">
              <div className="modal-success-ico">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <h2 className="modal-form-heading">EMAIL YUBORILDI.</h2>
              <p className="modal-success-text">{signUp.email} manziliga tasdiqlash havolasi yuborildi. Iltimos, emailingizni tekshiring.</p>
              <button className="modal-submit" onClick={() => { setSignedUp(false); setMode('signin') }}>KIRISHGA QAYTISH →</button>
            </div>
          ) : showForgot ? (
            forgotSent ? (
              <div className="modal-form-inner modal-success-wrap">
                <div className="modal-success-ico">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <h2 className="modal-form-heading">YUBORILDI.</h2>
                <p className="modal-success-text">{forgotEmail} manziliga parolni tiklash havolasi yuborildi.</p>
                <button className="modal-submit" onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail('') }}>KIRISHGA QAYTISH →</button>
              </div>
            ) : (
              <div className="modal-form-inner">
                <h2 className="modal-form-heading">PAROLNI<br />TIKSH.</h2>
                <p className="modal-form-sub">Email manzilingizni kiriting, biz sizga tiklash havolasini yuboramiz.</p>
                <form className="modal-form" onSubmit={handleForgot}>
                  <div className="modal-input-group">
                    <label className="modal-input-label">EMAIL</label>
                    <input
                      type="email"
                      className="modal-input"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="email@example.com"
                      autoFocus
                    />
                    {forgotErr && <span className="modal-error">{forgotErr}</span>}
                  </div>
                  <button type="submit" className="modal-submit">YUBORISH →</button>
                  <span className="modal-forgot" onClick={() => { setShowForgot(false); setForgotErr('') }}>← Kirishga qaytish</span>
                </form>
              </div>
            )
          ) : (
            <div className="modal-form-inner" key={`form-inner-${displayedMode}`}>
              <div className={`modal-text ${textPhase === 'out' ? 'out' : 'in'}`}>
                <h2 className="modal-form-heading">{displayedMode === 'signin' ? 'XUSH\nKELIBSIZ.' : "QO'SHILING."}</h2>
                <p className="modal-form-sub">{displayedMode === 'signin' ? 'Hisobingizga kiring va o\'rganishni davom eting.' : 'Boshlang — professional tayyorlov sari birinchi qadam.'}</p>

                {mode === 'signin' ? (
                  <form className="modal-form" onSubmit={handleSignIn}>
                    <div className="modal-input-group">
                      <label className="modal-input-label">EMAIL</label>
                      <input
                        type="email"
                        className="modal-input"
                        value={signIn.email}
                        onChange={(e) => setSignIn({ ...signIn, email: e.target.value })}
                        placeholder="email@example.com"
                        autoFocus
                      />
                      {errors.email && <span className="modal-error">{errors.email}</span>}
                    </div>
                    <div className="modal-input-group">
                      <label className="modal-input-label">PAROL</label>
                      <input
                        type="password"
                        className="modal-input"
                        value={signIn.password}
                        onChange={(e) => setSignIn({ ...signIn, password: e.target.value })}
                        placeholder="••••••••"
                      />
                      {errors.password && <span className="modal-error">{errors.password}</span>}
                    </div>
                    {errors.general && <span className="modal-error modal-error-block">{errors.general}</span>}
                    <span className="modal-forgot" onClick={() => setShowForgot(true)}>Parolni unutdingizmi?</span>
                    <button type="submit" className="modal-submit" disabled={submitting}>
                      {submitting ? 'KIRILMOQDA...' : 'KIRISH →'}
                    </button>
                  </form>
                ) : (
                  <form className="modal-form" onSubmit={handleSignUp}>
                    <div className="modal-input-group">
                      <label className="modal-input-label">EMAIL</label>
                      <input
                        type="email"
                        className="modal-input"
                        value={signUp.email}
                        onChange={(e) => setSignUp({ ...signUp, email: e.target.value })}
                        placeholder="email@example.com"
                        autoFocus
                      />
                      {errors.email && <span className="modal-error">{errors.email}</span>}
                    </div>
                    <div className="modal-input-group">
                      <label className="modal-input-label">PAROL</label>
                      <input
                        type="password"
                        className="modal-input"
                        value={signUp.password}
                        onChange={(e) => setSignUp({ ...signUp, password: e.target.value })}
                        placeholder="Kamida 6 ta belgi"
                      />
                      {errors.password && <span className="modal-error">{errors.password}</span>}
                    </div>
                    <div className="modal-input-group">
                      <label className="modal-input-label">PAROLNI QAYTARING</label>
                      <input
                        type="password"
                        className="modal-input"
                        value={signUp.confirm}
                        onChange={(e) => setSignUp({ ...signUp, confirm: e.target.value })}
                        placeholder="••••••••"
                      />
                      {errors.confirm && <span className="modal-error">{errors.confirm}</span>}
                    </div>
                    <label className="modal-checkbox">
                      <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
                      Foydalanish shartlarini qabul qilaman
                    </label>
                    {errors.terms && <span className="modal-error">{errors.terms}</span>}
                    {errors.general && <span className="modal-error modal-error-block">{errors.general}</span>}
                    <button type="submit" className="modal-submit" disabled={submitting}>
                      {submitting ? 'YARATILMOQDA...' : 'RO\'YXATDAN O\'TISH →'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
