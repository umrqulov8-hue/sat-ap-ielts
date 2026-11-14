import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import OrbiImage from '../components/orbi/OrbiImage'

function getAuthErrorMessage(error, action = 'signin') {
  const message = String(error?.message || '').toLowerCase()
  const code = String(error?.code || '').toLowerCase()
  const name = String(error?.name || '').toLowerCase()

  if (action === 'signin' && (code === 'invalid_credentials' || message.includes('invalid login credentials') || message.includes('invalid email or password'))) {
    return 'Email yoki parol noto\'g\'ri.'
  }
  if (code === 'email_exists' || message.includes('user already registered') || message.includes('email already registered')) {
    return 'Bu email bilan hisob allaqachon mavjud. Kirishga urinib ko\'ring.'
  }
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return 'Email manzilingiz tasdiqlanmagan. Pochtangizni tekshiring.'
  }
  if (error?.status === 429 || message.includes('rate limit') || message.includes('too many requests')) {
    return 'Juda ko\'p urinish bo\'ldi. Biroz kutib, qayta urinib ko\'ring.'
  }
  if (name === 'typeerror' || name === 'aborterror' || name === 'timeouterror' || ['failed to fetch', 'networkerror', 'load failed', 'timed out', 'timeout', 'aborted', 'connection refused'].some((part) => message.includes(part))) {
    return 'Kirish xizmati bilan aloqa uzildi. Internetni tekshiring va birozdan so\'ng qayta urinib ko\'ring.'
  }
  if (message.includes('invalid response')) {
    return 'Kirish serveridan noto\'g\'ri javob keldi. Birozdan so\'ng qayta urinib ko\'ring.'
  }
  if (message.includes('api key') || message.includes('project not found') || message.includes('project is disabled')) {
    return 'Kirish xizmati hozircha mavjud emas. Keyinroq qayta urinib ko\'ring.'
  }
  if (error?.status >= 500 || message.includes('project is paused') || message.includes('service unavailable')) {
    return 'Kirish serverida vaqtinchalik uzilish bor. Birozdan so\'ng qayta urinib ko\'ring.'
  }

  return action === 'signin'
    ? 'Kirish amalga oshmadi. Email va parolni tekshirib, qayta urinib ko\'ring.'
    : 'So\'rov bajarilmadi. Ma\'lumotlarni tekshirib, qayta urinib ko\'ring.'
}

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
  }, [navigate])

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
    try {
      const { error } = await supabase.auth.signUp({
        email: signUp.email,
        password: signUp.password,
        options: { emailRedirectTo: window.location.origin }
      })
      if (error) {
        setErrors({ general: getAuthErrorMessage(error, 'signup') })
      } else {
        setSignedUp(true)
      }
    } catch (error) {
      setErrors({ general: getAuthErrorMessage(error, 'signup') })
    } finally {
      setSubmitting(false)
    }
  }

  const handleSignIn = async (e) => {
    e.preventDefault()
    const errs = validateSignIn()
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSubmitting(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: signIn.email,
        password: signIn.password
      })
      if (error) {
        setErrors({ general: getAuthErrorMessage(error) })
      }
    } catch (error) {
      console.error('Sign-in request failed:', error?.name, error?.message)
      setErrors({ general: getAuthErrorMessage(error) })
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogle = async () => {
    setErrors({})
    setSubmitting(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/auth' },
      })
      if (error) {
        setErrors({ general: error.code === 'provider_disabled'
          ? 'Google orqali kirish hozircha yoqilmagan. Email va parol bilan kiring.'
          : getAuthErrorMessage(error) })
        setSubmitting(false)
      }
    } catch (error) {
      setErrors({ general: getAuthErrorMessage(error) })
      setSubmitting(false)
    }
  }

  const googleButton = (
    <>
      <div className="modal-or"><span>YOKI</span></div>
      <button type="button" className="modal-google" onClick={handleGoogle} disabled={submitting}>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/>
          <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/>
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
        </svg>
        GOOGLE ORQALI DAVOM ETISH
      </button>
    </>
  )

  const handleForgot = async (e) => {
    e.preventDefault()
    setForgotErr('')
    if (!forgotEmail.includes('@')) {
      setForgotErr('Email noto\'g\'ri')
      return
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: window.location.origin + '/auth'
      })
      if (error) {
        setForgotErr(getAuthErrorMessage(error, 'recovery'))
      } else {
        setForgotSent(true)
      }
    } catch (error) {
      setForgotErr(getAuthErrorMessage(error, 'recovery'))
    }
  }

  return (
    <div className="modal-backdrop ob-auth" ref={containerRef} onClick={(e) => { if (e.target === e.currentTarget) navigate('/') }}>
      <div className={`modal ${mode}${visible ? ' active' : ''}`} onClick={(e) => e.stopPropagation()}>

        <div className="modal-marketing">
          <div className="modal-marketing-brand">UFQ</div>
          <div className="modal-marketing-center" key={`center-${displayedMode}`}>
            <div className={`modal-text ${textPhase === 'out' ? 'out' : 'in'}`}>
              {displayedMode === 'signin' ? (
                <>
                  <h2 className="modal-marketing-heading">YANGI<br />MISIZ?</h2>
                  <p className="modal-marketing-sub">Ro'yxatdan o'ting va professional matematika tayyorlovni boshlang.</p>
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
          <button className="modal-close" onClick={() => navigate('/')} aria-label="Yopish">×</button>
          <div className="ob-auth-orbi">
            <OrbiImage pose="wave" size={320} eager alt="Orbi salomlashmoqda" />
            <span>Xush kelibsan!</span>
          </div>

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
                    {googleButton}
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
                    {googleButton}
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
