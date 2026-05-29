import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Auth() {
  const [mode, setMode] = useState('signin')
  const [signUp, setSignUp] = useState({ email: '', password: '', confirm: '' })
  const [signIn, setSignIn] = useState({ email: '', password: '' })
  const [terms, setTerms] = useState(false)
  const [errors, setErrors] = useState({})
  const [visible, setVisible] = useState(false)
  const [sliding, setSliding] = useState(false)
  const [pulsing, setPulsing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [signedUp, setSignedUp] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotErr, setForgotErr] = useState('')
  const navigate = useNavigate()
  const containerRef = useRef(null)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/dashboard', { replace: true })
    })
  }, [navigate])

  const validateEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
  const validate = (type) => {
    const e = {}
    if (type === 'signup') {
      if (!signUp.email.trim()) e.email = 'Email kiriting'
      else if (!validateEmail(signUp.email)) e.email = 'Noto\'g\'ri email format'
      if (!signUp.password) e.password = 'Parol kiriting'
      else if (signUp.password.length < 6) e.password = 'Parol kamida 6 belgi'
      if (signUp.password !== signUp.confirm) e.confirm = 'Parollar mos kelmadi'
      if (!terms) e.terms = 'Shartlarni qabul qiling'
    } else {
      if (!signIn.email.trim()) e.email = 'Email kiriting'
      if (!signIn.password) e.password = 'Parol kiriting'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    if (!validate('signup') || submitting) return
    setSubmitting(true)
    setErrors({})

    const { error } = await supabase.auth.signUp({
      email: signUp.email,
      password: signUp.password,
    })

    setSubmitting(false)

    if (error) {
      if (error.message.includes('already registered')) {
        setErrors({ email: 'Bu email allaqachon ro\'yxatdan o\'tgan' })
      } else if (error.message.includes('rate limit')) {
        setErrors({ form: 'Juda ko\'p urinish. 1 daqiqa kuting va qayta urinib ko\'ring.' })
      } else {
        setErrors({ form: error.message })
      }
      return
    }

    setSignedUp(true)
  }

  const handleSignIn = async (e) => {
    e.preventDefault()
    if (!validate('signin') || submitting) return
    setSubmitting(true)
    setErrors({})

    const { error } = await supabase.auth.signInWithPassword({
      email: signIn.email,
      password: signIn.password,
    })

    setSubmitting(false)

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setErrors({ form: 'Email yoki parol noto\'g\'ri' })
      } else if (error.message.includes('rate limit')) {
        setErrors({ form: 'Juda ko\'p urinish. 1 daqiqa kuting va qayta urinib ko\'ring.' })
      } else if (error.message.includes('Email not confirmed')) {
        setErrors({ form: 'Email tasdiqlanmagan. Pochtangizni tekshiring.' })
      } else {
        setErrors({ form: error.message })
      }
      return
    }

    navigate('/dashboard')
  }

  const handleForgot = async () => {
    if (!forgotEmail.trim() || !validateEmail(forgotEmail)) { setForgotErr('Email kiriting'); return }
    setForgotErr('')
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail)
    if (error) { setForgotErr(error.message); return }
    setForgotSent(true)
  }

  const switchMode = (newMode) => {
    if (newMode === mode || sliding) return
    setSliding(true)
    setPulsing(true)
    setMode(newMode)
    setErrors({})
    setTimeout(() => setSliding(false), 650)
    setTimeout(() => setPulsing(false), 400)
  }

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    e.currentTarget.style.setProperty('--mx', x + '%')
    e.currentTarget.style.setProperty('--my', y + '%')
  }

  if (signedUp) {
    return (
      <div className="auth-page-wrapper">
        <div className={`modal${visible ? ' active' : ''}`}>
          <div className="modal-backdrop" />
          <div className="modal-shadow-wrap" style={{ maxWidth: 480 }}>
            <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>&#9993;</div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem' }}>CHECK YOUR EMAIL</h2>
              <p style={{ fontSize: '0.8rem', color: '#888', fontWeight: 500, marginBottom: '1.5rem', lineHeight: 1.6 }}>
                We sent a confirmation link to <strong>{signUp.email}</strong>.<br />
                Click the link to verify your account, then sign in.
              </p>
              <button className="auth-submit-btn" onMouseMove={handleMouseMove} onClick={() => { setSignedUp(false); switchMode('signin') }}>
                GO TO SIGN IN
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page-wrapper">
      <div className={`modal${visible ? ' active' : ''}`}>
        <div className="modal-backdrop" />
        <div className="modal-shadow-wrap">
          <div className={`auth-container${mode === 'signup' ? ' signup-active' : ''}${pulsing ? ' auth-pulse' : ''}`} ref={containerRef}>
            <button className="auth-close-btn" onClick={() => window.history.back()}>&times;</button>

            <div className="auth-panel auth-panel-black">
              <div className="auth-black-inner">
                <div className="auth-black-half">
                  <h2 className="auth-black-title">NEW<br />HERE?</h2>
                  <p className="auth-black-desc">Ro'yxatdan o'ting va SATAP tajribasini kashf eting.</p>
                  <button className="auth-black-btn" onMouseMove={handleMouseMove} onClick={() => switchMode('signup')}>CREATE ACCOUNT</button>
                </div>
                <div className="auth-black-half">
                  <h2 className="auth-black-title">WELCOME<br />BACK!</h2>
                  <p className="auth-black-desc">Hisobingizga kiring va davom eting.</p>
                  <button className="auth-black-btn" onMouseMove={handleMouseMove} onClick={() => switchMode('signin')}>SIGN IN</button>
                </div>
              </div>
            </div>

            <div className="auth-panel auth-panel-white">
              <div className="auth-white-inner">
                <div className="auth-white-half">
                  <h2 className="auth-form-title">WELCOME.</h2>
                  <p className="auth-form-sub">ACCESS YOUR DASHBOARD</p>
                  <p className="auth-tagline">mukammalikka intiling</p>
                  {errors.form && <div className="auth-form-error">{errors.form}</div>}
                  <form onSubmit={handleSignIn} noValidate>
                    <div className="auth-input-group">
                      <label className="auth-label">EMAIL</label>
                      <input type="email" placeholder="EMAIL ADDRESS" value={signIn.email} onChange={e => setSignIn({ ...signIn, email: e.target.value })} className={errors.email ? 'input-error' : ''} disabled={submitting} />
                      {errors.email && <span className="field-error">{errors.email}</span>}
                    </div>
                    <div className="auth-input-group">
                      <label className="auth-label">PASSWORD</label>
                      <input type="password" placeholder="PASSWORD" value={signIn.password} onChange={e => setSignIn({ ...signIn, password: e.target.value })} className={errors.password ? 'input-error' : ''} disabled={submitting} />
                      {errors.password && <span className="field-error">{errors.password}</span>}
                    </div>
                    <a href="javascript:void(0)" className="auth-forgot" onClick={() => setShowForgot(true)}>FORGOT PASSWORD?</a>
                    <button type="submit" className="auth-submit-btn" onMouseMove={handleMouseMove} disabled={submitting}>{submitting ? 'LOADING...' : 'ENTER →'}</button>
                  </form>
                </div>

                <div className="auth-white-half">
                  <h2 className="auth-form-title">CREATE<br />ACCOUNT.</h2>
                  <p className="auth-form-sub">START YOUR JOURNEY</p>
                  <p className="auth-tagline">mukammalikka intiling</p>
                  {errors.form && <div className="auth-form-error">{errors.form}</div>}
                  <form onSubmit={handleSignUp} noValidate>
                    <div className="auth-input-group">
                      <label className="auth-label">EMAIL</label>
                      <input type="email" placeholder="EMAIL ADDRESS" value={signUp.email} onChange={e => setSignUp({ ...signUp, email: e.target.value })} className={errors.email ? 'input-error' : ''} disabled={submitting} />
                      {errors.email && <span className="field-error">{errors.email}</span>}
                    </div>
                    <div className="auth-input-group">
                      <label className="auth-label">PASSWORD</label>
                      <input type="password" placeholder="PASSWORD" value={signUp.password} onChange={e => setSignUp({ ...signUp, password: e.target.value })} className={errors.password ? 'input-error' : ''} disabled={submitting} />
                      {errors.password && <span className="field-error">{errors.password}</span>}
                    </div>
                    <div className="auth-input-group">
                      <label className="auth-label">CONFIRM PASSWORD</label>
                      <input type="password" placeholder="CONFIRM PASSWORD" value={signUp.confirm} onChange={e => setSignUp({ ...signUp, confirm: e.target.value })} className={errors.confirm ? 'input-error' : ''} disabled={submitting} />
                      {errors.confirm && <span className="field-error">{errors.confirm}</span>}
                    </div>
                    <div className="auth-checkbox-group">
                      <input type="checkbox" id="terms" checked={terms} onChange={e => setTerms(e.target.checked)} disabled={submitting} />
                      <label htmlFor="terms">Shartlar va maxfiylikka roziman</label>
                      {errors.terms && <span className="field-error" style={{ marginLeft: '0.5rem' }}>{errors.terms}</span>}
                    </div>
                    <button type="submit" className="auth-submit-btn" onMouseMove={handleMouseMove} disabled={submitting}>{submitting ? 'LOADING...' : 'SIGN UP →'}</button>
                    <button type="button" className="auth-switch-link" onClick={() => switchMode('signin')}>Already have an account? Sign in</button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showForgot && (
        <div className="bb-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowForgot(false); setForgotSent(false); setForgotErr('') } }}>
          <div className="bb-modal" style={{ maxWidth: 400 }}>
            <div className="bb-modal-header">
              RESET PASSWORD
              <button className="bb-modal-close" onClick={() => { setShowForgot(false); setForgotSent(false); setForgotErr('') }}>&times;</button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              {forgotSent ? (
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>&#9993;</div>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>Reset link sent to <strong>{forgotEmail}</strong></p>
                  <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.5rem' }}>Check your email and follow the instructions.</p>
                  <button className="onboarding-btn" style={{ marginTop: '1rem' }} onClick={() => { setShowForgot(false); setForgotSent(false) }}>OK</button>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '1rem', fontWeight: 500 }}>Enter your email and we'll send you a reset link.</p>
                  <input className="onboarding-input" type="email" placeholder="EMAIL ADDRESS" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} />
                  {forgotErr && <p style={{ fontSize: '0.7rem', color: 'red', marginTop: '0.5rem', fontWeight: 600 }}>{forgotErr}</p>}
                  <button className="onboarding-btn" style={{ marginTop: '1rem', width: '100%' }} onClick={handleForgot}>SEND RESET LINK</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
