import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { loadPoses, usePoses, poseSrc } from './assets'
import { prefersReducedMotion } from '../../hooks/useOrbiPage'

const HIDDEN_KEY = 'ufq_orbi_hidden'
const SLEEP_AFTER_MS = 45000
const SUBJECT_ROUTES = ['/algebra', '/geometry', '/advanced-math', '/data-analysis', '/problem-solving']

const SAY = {
  think: 'Avval darajangni aniqlaymiz, atigi 5 daqiqa!',
  study: "Har kuni 20 daqiqa. Shuning o'zi yetarli.",
  celebrate: 'Ana natija! Sen ham shunday qila olasan.',
  'celebrate-2': 'Ana natija! Sen ham shunday qila olasan.',
  pricing: 'Birinchi mock imtihon bepul 😉',
  cta: 'Qani, boshladik!',
  tea: 'Bir piyola choy, keyin yana mashq.',
  wake: 'Uxlab qolibman... Qaytganingdan xursandman!',
}

// Inside the app (dashboard, subjects) the interface is English, so Orbi speaks English there.
const SAY_EN = {
  study: 'Just 20 minutes a day is enough.',
  wake: 'I fell asleep... glad you are back!',
}
const MENU_EN = { ask: 'How can I help?', start: 'Get started', subjects: 'View subjects', help: 'Support', hide: 'Hide Orbi', close: 'Close', show: 'Bring Orbi back', label: 'Orbi assistant' }
const MENU_UZ = { ask: 'Qanday yordam beray?', start: 'Bepul boshlash', subjects: 'Fanlarni koʻrish', help: 'Yordam', hide: 'Orbini yashirish', close: 'Yopish', show: 'Orbini qaytarish', label: 'Orbi yordamchi' }

const readHidden = () => {
  try { return localStorage.getItem(HIDDEN_KEY) === '1' } catch { return false }
}
const writeHidden = value => {
  try { localStorage.setItem(HIDDEN_KEY, value ? '1' : '0') } catch { /* storage may be blocked */ }
}

export default function OrbiCompanion() {
  const { pathname } = useLocation()
  const onLanding = pathname === '/'
  const onSubject = SUBJECT_ROUTES.includes(pathname)
  const enabled = onLanding || onSubject
  const poses = usePoses()

  const [hidden, setHidden] = useState(readHidden)
  const [sectionPose, setSectionPose] = useState(onSubject ? 'study' : 'idle')
  const [heroInView, setHeroInView] = useState(onLanding)
  const [asleep, setAsleep] = useState(false)
  const [waving, setWaving] = useState(false)
  const [bubble, setBubble] = useState(null) // { text } | { menu: true }
  const [lifted, setLifted] = useState(false)

  const rootRef = useRef(null)
  const shownSays = useRef(new Set())
  const bubbleTimer = useRef(0)
  const sleepTimer = useRef(0)
  const waveTimer = useRef(0)
  const asleepRef = useRef(false)

  const showBubble = useCallback((next, autoHide = true) => {
    clearTimeout(bubbleTimer.current)
    setBubble(next)
    if (autoHide) bubbleTimer.current = setTimeout(() => setBubble(null), 4000)
  }, [])

  // Which pose is on screen: the section with the largest visible share wins.
  useEffect(() => {
    if (!enabled) return undefined
    shownSays.current = new Set()
    if (onSubject) {
      setSectionPose('study')
      setHeroInView(false)
      const id = setTimeout(() => {
        if (!shownSays.current.has('subject')) {
          shownSays.current.add('subject')
          showBubble({ text: SAY_EN.study })
        }
      }, 1200)
      return () => clearTimeout(id)
    }
    setSectionPose('idle')
    setHeroInView(true)
    // The section under the middle of the screen sets Orbi's pose (works for tall
    // sections on phones, where an intersection ratio would never get high enough).
    let frame = 0
    let lastEl = null
    const pick = () => {
      frame = 0
      const mid = window.innerHeight * 0.5
      // The page is lazy-loaded, so look the sections up on every check.
      const all = [...document.querySelectorAll('[data-orbi]')]
      const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4
      const current = atBottom ? all[all.length - 1] : all.find(el => {
        const r = el.getBoundingClientRect()
        return r.top <= mid && r.bottom > mid
      })
      if (!current || current === lastEl) return
      lastEl = current
      const pose = current.dataset.orbi
      const hide = pose === 'hidden' || current.dataset.orbiHide === 'true'
      setHeroInView(hide)
      if (hide) setBubble(prev => (prev?.menu ? prev : null))
      else setSectionPose(pose)
      const say = current.dataset.orbiSay
      const key = current.id || say
      if (!hide && say && SAY[say] && !shownSays.current.has(key)) {
        shownSays.current.add(key)
        showBubble({ text: SAY[say] })
      }
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(pick) }
    pick()
    const late = [300, 1200].map(ms => setTimeout(schedule, ms))
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      late.forEach(clearTimeout)
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [enabled, onSubject, showBubble, pathname])

  // Preload every available pose once the page is idle.
  useEffect(() => {
    if (!enabled) return undefined
    const run = () => {
      const small = window.matchMedia('(max-width: 767px)').matches
      loadPoses().then(set => set.forEach(p => { new Image().src = poseSrc(p, small) }))
    }
    const idle = window.requestIdleCallback || (cb => setTimeout(cb, 1500))
    const id = idle(run)
    return () => (window.cancelIdleCallback ? window.cancelIdleCallback(id) : clearTimeout(id))
  }, [enabled])

  // Sleep after 45s without activity; any activity wakes Orbi with a short wave.
  useEffect(() => {
    if (!enabled || hidden) return undefined
    const arm = () => {
      clearTimeout(sleepTimer.current)
      sleepTimer.current = setTimeout(() => { asleepRef.current = true; setAsleep(true) }, SLEEP_AFTER_MS)
    }
    const onActivity = () => {
      if (asleepRef.current) {
        asleepRef.current = false
        setAsleep(false)
        setWaving(true)
        showBubble({ text: onSubject ? SAY_EN.wake : SAY.wake })
        clearTimeout(waveTimer.current)
        waveTimer.current = setTimeout(() => setWaving(false), 1500)
      }
      arm()
    }
    const events = ['scroll', 'pointermove', 'pointerdown', 'touchstart', 'keydown']
    events.forEach(ev => window.addEventListener(ev, onActivity, { passive: true }))
    arm()
    return () => {
      events.forEach(ev => window.removeEventListener(ev, onActivity))
      clearTimeout(sleepTimer.current)
      clearTimeout(waveTimer.current)
    }
  }, [enabled, hidden, showBubble, onSubject])

  // Never cover buttons: if Orbi overlaps a CTA or link, lift him out of the way.
  useEffect(() => {
    if (!enabled || hidden) return undefined
    let frame = 0
    const check = () => {
      frame = 0
      const me = rootRef.current
      if (!me) return
      const r = me.getBoundingClientRect()
      const natural = { left: r.left, right: r.right, top: r.top + (lifted ? 96 : 0), bottom: r.bottom + (lifted ? 96 : 0) }
      const clash = [...document.querySelectorAll('.ob-btn, .ob-footer a, .ob-subject-chip, .ob-nav a')].some(el => {
        if (me.contains(el)) return false
        const b = el.getBoundingClientRect()
        return b.width > 0 && b.right > natural.left && b.left < natural.right && b.bottom > natural.top && b.top < natural.bottom
      })
      setLifted(clash)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(check) }
    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [enabled, hidden, lifted, heroInView])

  useEffect(() => {
    if (!bubble) return undefined
    const onKey = e => { if (e.key === 'Escape') setBubble(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [bubble])

  useEffect(() => () => { clearTimeout(bubbleTimer.current) }, [])

  const wanted = asleep ? 'sleep' : waving ? 'wave' : sectionPose
  const pose = poses.has(wanted) ? wanted : 'idle'

  // Two stacked images crossfade when the pose changes.
  const [layers, setLayers] = useState({ current: pose, previous: null, tick: 0 })
  useEffect(() => {
    setLayers(prev => {
      if (prev.current === pose) return prev
      return { current: pose, previous: prev.current, tick: prev.tick + 1 }
    })
  }, [pose])
  useEffect(() => {
    if (!layers.previous) return undefined
    const id = setTimeout(() => setLayers(prev => ({ ...prev, previous: null })), 200)
    return () => clearTimeout(id)
  }, [layers.previous, layers.tick])

  const reduced = useMemo(() => prefersReducedMotion(), [])
  const small = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  const src = p => poseSrc(p, small)

  const hide = () => {
    setBubble(null)
    setHidden(true)
    writeHidden(true)
  }
  const show = () => {
    setHidden(false)
    writeHidden(false)
  }
  const toSubjects = () => {
    setBubble(null)
    document.querySelector('#fanlar')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  }

  if (!enabled) return null
  const T = onSubject ? MENU_EN : MENU_UZ

  if (hidden) {
    return (
      <button type="button" className="orbi-tab" onClick={show} aria-label={T.show} title={T.show}>
        <svg viewBox="0 0 28 18" aria-hidden="true"><path d="M2 17C2 7 8 1 14 1s12 6 12 16z" fill="#fff" /><path d="M2 17C2 7 8 1 14 1s12 6 12 16z" fill="#121212" /><path d="M5 13h18" stroke="#fff" strokeWidth="1.6" strokeDasharray="2 2.4" /></svg>
      </button>
    )
  }

  const visible = !heroInView
  return (
    <div ref={rootRef} className={`orbi-companion${visible ? ' show' : ''}${lifted ? ' lifted' : ''}${asleep ? ' sleeping' : ''}`}>
      {bubble && (
        <div className="orbi-bubble" role="status" aria-live="polite">
          {bubble.menu ? (
            <>
              <span>{T.ask}</span>
              <div className="orbi-menu">
                <Link to="/auth" className="ob-btn small" onClick={() => setBubble(null)}>{T.start}</Link>
                <button type="button" className="ob-btn secondary small" onClick={toSubjects}>{T.subjects}</button>
                <Link to="/support" className="ob-btn secondary small" onClick={() => setBubble(null)}>{T.help}</Link>
                <button type="button" className="ob-btn secondary small" onClick={hide}>{T.hide}</button>
              </div>
            </>
          ) : bubble.text}
          <button type="button" className="orbi-bubble-x" onClick={() => setBubble(null)} aria-label={T.close}>×</button>
        </div>
      )}
      <button
        type="button"
        className="orbi-btn orbi-float"
        aria-label={T.label}
        aria-expanded={Boolean(bubble?.menu)}
        tabIndex={visible ? 0 : -1}
        onClick={() => (bubble?.menu ? setBubble(null) : showBubble({ menu: true }, false))}
      >
        {layers.previous && <img key={`p${layers.tick}`} className="orbi-layer out" src={src(layers.previous)} alt="" aria-hidden="true" width="320" height="320" />}
        <img
          key={`c${layers.tick}`}
          className={`orbi-layer${!reduced && layers.tick ? (layers.current === 'celebrate' ? ' swap hop' : ' swap') : ''}`}
          src={src(layers.current)}
          alt=""
          aria-hidden="true"
          width="320"
          height="320"
        />
      </button>
    </div>
  )
}
