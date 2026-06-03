import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import useScrollReveal from '../hooks/useScrollReveal'
import useHeroParallax from '../hooks/useHeroParallax'

export default function Home() {
  useScrollReveal()
  const heroRef = useHeroParallax()

  useEffect(() => { document.title = 'SATAP Academy — SAT & AP Prep' }, [])

  useEffect(() => {
    const handleClick = (e) => {
      const a = e.target.closest('a[href^="#"]')
      if (!a || a.getAttribute('href') === '#') return
      const href = a.getAttribute('href')
      if (href.length <= 1) return
      e.preventDefault()
      const target = document.querySelector(href)
      if (target) {
        const offset = 60
        const top = target.getBoundingClientRect().top + window.scrollY - offset
        window.scrollTo({ top, behavior: 'smooth' })
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  return (
    <>
      <nav className="unitap-nav u-navbar">
        <a href="#home" className="unitap-nav-brand">
          <span className="unitap-nav-brand-mark">S</span>
          SATAP Academy
        </a>
        <div className="unitap-nav-links">
          <a href="#methodology" className="unitap-nav-link">METHODOLOGY</a>
          <a href="#curriculum" className="unitap-nav-link">CURRICULUM</a>
          <a href="#results" className="unitap-nav-link">RESULTS</a>
          <a href="#pricing" className="unitap-nav-link">PRICING</a>
        </div>
        <div className="unitap-nav-actions">
          <Link to="/auth" className="unitap-nav-cta login">LOGIN</Link>
          <Link to="/auth" className="unitap-nav-cta">OPEN APP →</Link>
        </div>
      </nav>

      <main>
      <section className="unitap-hero" id="home" ref={heroRef}>
        <div className="unitap-hero-inner">
          <div className="unitap-hero-text u-hero u-stagger">
            <span className="unitap-hero-eyebrow">
              <span className="unitap-hero-eyebrow-dot" />
              2026 COHORT — ENROLLING NOW
            </span>
            <h1>
              Imtihon natijangni<br />
              <em>uch barobar</em> oshir.
            </h1>
            <p className="unitap-hero-sub">
              Bizning ekzotik tayyorlov platformamiz SAT va AP imtihonlariga tayyorgarlik ko'rishning
              yangi usulini taklif etadi. Maqsadli darslar, real imtihon simulyatsiyalari va AI-yordam.
            </p>
            <div className="unitap-hero-actions">
              <Link to="/auth" className="unitap-btn primary">BEPUL BOSHLASH →</Link>
              <a href="#methodology" className="unitap-btn secondary">QANDAY ISHLAYDI</a>
            </div>
            <div className="unitap-hero-meta u-hero-meta">
              <div className="unitap-hero-meta-item">
                <span className="unitap-hero-meta-num">12,400+</span>
                <span className="unitap-hero-meta-label">FAOL TALABALAR</span>
              </div>
              <div className="unitap-hero-meta-item">
                <span className="unitap-hero-meta-num">1520</span>
                <span className="unitap-hero-meta-label">O'RTACHA SAT</span>
              </div>
              <div className="unitap-hero-meta-item">
                <span className="unitap-hero-meta-num">98%</span>
                <span className="unitap-hero-meta-label">MAQSADGA ERISHGAN</span>
              </div>
            </div>
          </div>

          <div className="unitap-hero-illu">
            <svg className="unitap-illu-svg" viewBox="0 0 400 360" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1a1a2e" strokeWidth="0.4" opacity="0.1" />
                </pattern>
              </defs>

              {/* Subtle grid background — static */}
              <g data-parallax-speed="0">
                <rect width="400" height="360" fill="url(#grid)" />
              </g>

              {/* 1. Back peach card — slides in from right, deepest */}
              <g className="unitap-illu-a-right unitap-illu-idle-inv" data-parallax-speed="0.12" data-parallax-rotate="3" data-parallax-range="26">
                <g transform="rotate(6 230 200)">
                  <rect x="126" y="76" width="200" height="260" fill="#ffb89a" stroke="#1a1a2e" strokeWidth="2.5" />
                </g>
              </g>

              {/* 2. Main lavender score card — scales in big */}
              <g className="unitap-illu-a-scale unitap-illu-idle" data-parallax-speed="0.05" data-parallax-rotate="7" data-parallax-range="30">
                <g transform="rotate(-4 200 200)">
                  {/* shadow */}
                  <rect className="unitap-illu-a-left" x="106" y="56" width="200" height="260" fill="#1a1a2e" style={{ animationDelay: '0.4s' }} />
                  {/* main card */}
                  <rect className="unitap-illu-a-stomp" x="100" y="50" width="200" height="260" fill="#a8a2e8" stroke="#1a1a2e" strokeWidth="2.5" style={{ animationDelay: '0.3s' }} />
                  {/* ACHIEVED tag (pink) */}
                  <g className="unitap-illu-a-tag">
                    <rect x="160" y="70" width="80" height="22" fill="#ff5b7e" stroke="#1a1a2e" strokeWidth="2" />
                    <text x="200" y="86" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="800" fontSize="10" fill="#1a1a2e" letterSpacing="1.5">ACHIEVED</text>
                  </g>
                  {/* small star above number — burst */}
                  <g className="unitap-illu-a-burst">
                    <polygon points="200,115 204,125 214,125 206,131 209,141 200,135 191,141 194,131 186,125 196,125" fill="#1a1a2e" />
                  </g>
                  {/* Big 1520 — stomp in */}
                  <g className="unitap-illu-a-stomp" style={{ animationDelay: '1.05s' }}>
                    <text x="200" y="200" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="900" fontSize="58" fill="#1a1a2e" letterSpacing="-2">1520</text>
                  </g>
                  {/* SAT SCORE label — reveal up */}
                  <g className="unitap-illu-a-reveal" style={{ animationDelay: '1.3s' }}>
                    <text x="200" y="228" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="11" fill="#1a1a2e" letterSpacing="2.5">SAT SCORE</text>
                  </g>
                  {/* Divider line — draws in */}
                  <line className="unitap-illu-a-line" x1="130" y1="250" x2="270" y2="250" stroke="#1a1a2e" strokeWidth="1.5" />
                  {/* 3 bottom dots — sequential pop */}
                  <circle className="unitap-illu-a-dot d1" cx="180" cy="275" r="3" fill="#1a1a2e" />
                  <circle className="unitap-illu-a-dot d2" cx="200" cy="275" r="3" fill="#1a1a2e" />
                  <circle className="unitap-illu-a-dot d3" cx="220" cy="275" r="3" fill="#1a1a2e" />
                </g>
              </g>

              {/* 3. Yellow card with star (top-right) — burst */}
              <g className="unitap-illu-a-scale" data-parallax-speed="0.32" data-parallax-rotate="9" data-parallax-range="42" style={{ animationDelay: '0.45s' }}>
                <g transform="rotate(10 340 70)">
                  <rect className="unitap-illu-a-left" x="306" y="36" width="70" height="70" fill="#1a1a2e" style={{ animationDelay: '0.6s' }} />
                  <rect className="unitap-illu-a-stomp" x="300" y="30" width="70" height="70" fill="#ffe066" stroke="#1a1a2e" strokeWidth="2.5" style={{ animationDelay: '0.5s' }} />
                  {/* star inside — rotate burst */}
                  <g className="unitap-illu-a-rotate" style={{ animationDelay: '1.2s' }}>
                    <polygon points="335,45 339,60 354,60 342,69 346,84 335,75 324,84 328,69 316,60 331,60" fill="#1a1a2e" />
                  </g>
                </g>
              </g>

              {/* 4. Green check card (bottom-left) — slides from left */}
              <g className="unitap-illu-a-left" data-parallax-speed="0.24" data-parallax-rotate="8" data-parallax-range="38">
                <g transform="rotate(-10 75 280)">
                  <rect className="unitap-illu-a-top" x="51" y="256" width="56" height="56" fill="#1a1a2e" style={{ animationDelay: '0.7s' }} />
                  <rect className="unitap-illu-a-btm" x="45" y="250" width="56" height="56" fill="#a8e6a3" stroke="#1a1a2e" strokeWidth="2.5" style={{ animationDelay: '0.6s' }} />
                  {/* check mark — draw */}
                  <path className="unitap-illu-check unitap-illu-a-fadein f2" d="M58 278 L70 290 L88 268" fill="none" stroke="#0d0d1a" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" style={{ animationDelay: '1.15s' }} />
                </g>
              </g>

              {/* 5. Small green +250 pill (mid-left) — slides from top */}
              <g className="unitap-illu-a-top" data-parallax-speed="0.38" data-parallax-rotate="10" data-parallax-range="48">
                <g transform="rotate(-15 50 170)">
                  <rect className="unitap-illu-a-top" x="20" y="155" width="60" height="30" fill="#1a1a2e" style={{ animationDelay: '0.95s' }} />
                  <rect className="unitap-illu-a-tag" x="16" y="151" width="60" height="30" fill="#a8e6a3" stroke="#1a1a2e" strokeWidth="2" style={{ animationDelay: '0.85s' }} />
                  {/* +250 text — glitch reveal */}
                  <text className="unitap-illu-a-glitch" x="46" y="171" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="800" fontSize="11" fill="#1a1a2e">+250</text>
                </g>
              </g>

              {/* 6. Three small sparkles — burst, staggered */}
              <g data-parallax-speed="0.5" data-parallax-rotate="6" data-parallax-range="55">
                <g className="unitap-illu-a-burst" style={{ animationDelay: '1.0s' }} transform="translate(60 50)">
                  <polygon points="0,-7 2,-2 7,-2 3,1.5 4.5,7 0,3.5 -4.5,7 -3,1.5 -7,-2 -2,-2" fill="#1a1a2e" />
                </g>
                <g className="unitap-illu-a-burst" style={{ animationDelay: '1.2s' }} transform="translate(370 200)">
                  <polygon points="0,-6 1.8,-1.8 6,-1.8 2.4,1.2 3.6,6 0,2.5 -3.6,6 -2.4,1.2 -6,-1.8 -1.8,-1.8" fill="#1a1a2e" />
                </g>
                <g className="unitap-illu-a-burst" style={{ animationDelay: '1.4s' }} transform="translate(340 320)">
                  <polygon points="0,-5 1.5,-1.5 5,-1.5 2,1 3,5 0,2.5 -3,5 -2,1 -5,-1.5 -1.5,-1.5" fill="#1a1a2e" />
                </g>
              </g>
            </svg>
          </div>
        </div>
      </section>

      <div className="unitap-marquee">
        <div className="unitap-marquee-track">
          <span className="unitap-marquee-item">SAT MATH <span className="unitap-marquee-dot">✦</span></span>
          <span className="unitap-marquee-item">SAT R&amp;W <span className="unitap-marquee-dot">✦</span></span>
          <span className="unitap-marquee-item">AP BIOLOGY <span className="unitap-marquee-dot">✦</span></span>
          <span className="unitap-marquee-item">AP CALCULUS <span className="unitap-marquee-dot">✦</span></span>
          <span className="unitap-marquee-item">PRACTICE TESTS <span className="unitap-marquee-dot">✦</span></span>
          <span className="unitap-marquee-item">AI TUTOR <span className="unitap-marquee-dot">✦</span></span>
          <span className="unitap-marquee-item">STUDY PLAN <span className="unitap-marquee-dot">✦</span></span>
          <span className="unitap-marquee-item">PROCTORED EXAMS <span className="unitap-marquee-dot">✦</span></span>
          <span className="unitap-marquee-item">SAT MATH <span className="unitap-marquee-dot">✦</span></span>
          <span className="unitap-marquee-item">SAT R&amp;W <span className="unitap-marquee-dot">✦</span></span>
          <span className="unitap-marquee-item">AP BIOLOGY <span className="unitap-marquee-dot">✦</span></span>
          <span className="unitap-marquee-item">AP CALCULUS <span className="unitap-marquee-dot">✦</span></span>
          <span className="unitap-marquee-item">PRACTICE TESTS <span className="unitap-marquee-dot">✦</span></span>
          <span className="unitap-marquee-item">AI TUTOR <span className="unitap-marquee-dot">✦</span></span>
          <span className="unitap-marquee-item">STUDY PLAN <span className="unitap-marquee-dot">✦</span></span>
          <span className="unitap-marquee-item">PROCTORED EXAMS <span className="unitap-marquee-dot">✦</span></span>
        </div>
      </div>

      <section className="unitap-section" id="methodology">
        <div className="unitap-section-inner">
          <span className="unitap-eyebrow u-reveal">METHODOLOGY</span>
          <h2 className="unitap-h2 u-reveal" data-reveal-delay="0.05s">
            To'rtta oddiy <span className="unitap-h2-line">qadam</span> bilan
            natijaga erishing.
          </h2>
          <p className="unitap-h2-sub u-reveal" data-reveal-delay="0.1s">
            Bizning platformamiz imtihonga tayyorlanish jarayonini soddalashtiradi.
            Faqat ro'yxatdan o'ting, darajangizni aniqlang, va har kuni 20 daqiqa mashq qiling.
          </p>
          <div className="unitap-steps u-stagger">
            <div className="unitap-step">
              <span className="unitap-step-num">01 / DIAGNOSE</span>
              <h3 className="unitap-step-title">Darajangizni aniqlang</h3>
              <p className="unitap-step-desc">5 daqiqalik diagnostik test orqali hozirgi SAT/AP darajangiz va kuchli/zaif tomonlaringiz aniqlanadi.</p>
              <div className="unitap-step-bar" />
            </div>
            <div className="unitap-step">
              <span className="unitap-step-num">02 / PERSONALIZE</span>
              <h3 className="unitap-step-title">Shaxsiy reja tuzing</h3>
              <p className="unitap-step-desc">AI sizning maqsadlaringiz va jadvalingizga mos ravishda har kun uchun aniq darslar va mashqlar tanlaydi.</p>
              <div className="unitap-step-bar" />
            </div>
            <div className="unitap-step">
              <span className="unitap-step-num">03 / PRACTICE</span>
              <h3 className="unitap-step-title">Har kuni mashq qiling</h3>
              <p className="unitap-step-desc">Real imtihon formatidagi 5,000+ savol, batafsil tushuntirishlar, va AI tutor yordamida mustahkamlang.</p>
              <div className="unitap-step-bar" />
            </div>
            <div className="unitap-step">
              <span className="unitap-step-num">04 / DOMINATE</span>
              <h3 className="unitap-step-title">Imtihonni zabt eting</h3>
              <p className="unitap-step-desc">Proktorlangan mock imtihonlar bilan haqiqiy sharoitda mashq qiling va natijangizni kafolatlang.</p>
              <div className="unitap-step-bar" />
            </div>
          </div>
        </div>
      </section>

      <section className="unitap-section" id="results" style={{ padding: 0 }}>
        <div className="unitap-stats u-stagger">
          <div className="unitap-stat">
            <span className="unitap-stat-num u-count" data-count-to="12400" data-count-duration="2000">0</span>
            <span className="unitap-stat-label">Faol talabalar</span>
          </div>
          <div className="unitap-stat">
            <span className="unitap-stat-num u-count" data-count-to="1520" data-count-duration="2000">0</span>
            <span className="unitap-stat-label">O'rtacha SAT ball</span>
          </div>
          <div className="unitap-stat">
            <span className="unitap-stat-num u-count" data-count-to="4.9" data-count-decimals="1" data-count-duration="2000">0</span>
            <span className="unitap-stat-label">Foydalanuvchi reytingi</span>
          </div>
          <div className="unitap-stat">
            <span className="unitap-stat-num u-count" data-count-to="98" data-count-suffix="%" data-count-duration="2000">0</span>
            <span className="unitap-stat-label">Maqsadga erishgan</span>
          </div>
        </div>
      </section>

      <section className="unitap-section lavender" id="curriculum">
        <div className="unitap-section-inner">
          <span className="unitap-eyebrow u-reveal">EMPOWER</span>
          <h2 className="unitap-h2 u-reveal" data-reveal-delay="0.05s">
            Sizga kerak bo'lgan <span className="unitap-h2-line">hamma narsa</span> bitta platformada.
          </h2>
          <p className="unitap-h2-sub u-reveal" data-reveal-delay="0.1s">
            Boshqa darsliklar, qo'shimcha darslar yoki qimmat repetitorlar kerak emas. Hammasi shu yerda.
          </p>
          <div className="unitap-empower">
            <div className="unitap-empower-list u-stagger">
              <div className="unitap-empower-item">
                <span className="unitap-empower-check">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                </span>
                <div>
                  <strong>5,000+ amaliy savollar</strong>
                  <span>SAT Math, R&amp;W, AP Bio, AP Calc — barchasi real imtihon formatida</span>
                </div>
              </div>
              <div className="unitap-empower-item">
                <span className="unitap-empower-check">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                </span>
                <div>
                  <strong>AI Tutor on-demand</strong>
                  <span>Har bir savol bo'yicha batafsil tushuntirish va shaxsiy maslahat</span>
                </div>
              </div>
              <div className="unitap-empower-item">
                <span className="unitap-empower-check">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                </span>
                <div>
                  <strong>Proktorlangan mock imtihonlar</strong>
                  <span>Haqiqiy imtihon sharoitida, timer bilan, to'liq hisobot bilan</span>
                </div>
              </div>
              <div className="unitap-empower-item">
                <span className="unitap-empower-check">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                </span>
                <div>
                  <strong>Kundalik progress tracking</strong>
                  <span>Natijangizni har kuni kuzatib boring, zaif tomonlaringizga e'tibor qarating</span>
                </div>
              </div>
              <div className="unitap-empower-item">
                <span className="unitap-empower-check">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                </span>
                <div>
                  <strong>Video darsliklar va strategiyalar</strong>
                  <span>Expertlar tomonidan tayyorlangan qisqa va aniq videolar</span>
                </div>
              </div>
            </div>
            <div className="unitap-card-large yellow u-reveal" data-reveal-delay="0.2s">
              <div className="unitap-card-large-deco">PRO</div>
              <h3>Bitta obuna — to'liq kirish</h3>
              <p>Barcha fanlar, barcha darajalar, barcha imkoniyatlar. Yashirin to'lovlar yo'q, qo'shimcha xarajatlar yo'q.</p>
              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-block', padding: '0.4rem 0.75rem', background: 'var(--dark)', color: 'var(--yellow)', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em' }}>ALL SUBJECTS</span>
                <span style={{ display: 'inline-block', padding: '0.4rem 0.75rem', background: 'var(--dark)', color: 'var(--yellow)', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em' }}>AI ACCESS</span>
                <span style={{ display: 'inline-block', padding: '0.4rem 0.75rem', background: 'var(--dark)', color: 'var(--yellow)', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em' }}>UNLIMITED</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="unitap-section" id="features">
        <div className="unitap-section-inner">
          <span className="unitap-eyebrow u-reveal">FEATURES</span>
          <h2 className="unitap-h2 u-reveal" data-reveal-delay="0.05s">
            Nega <span className="unitap-h2-line">SATAP Academy</span>?
          </h2>
          <p className="unitap-h2-sub u-reveal" data-reveal-delay="0.1s">
            Boshqa platformalardan farqli — har bir xususiyat natijaga yo'naltirilgan.
          </p>
          <div className="unitap-features u-stagger">
            <div className="unitap-feature yellow">
              <span className="unitap-feature-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg></span>
              <span className="unitap-feature-ico">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              </span>
              <h3>Adaptive Learning</h3>
              <p>AI sizning kuchli va zaif tomonlaringizga qarab savollarni avtomatik ravishda tanlaydi. Vaqtni yo'qotmang.</p>
            </div>
            <div className="unitap-feature lavender">
              <span className="unitap-feature-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg></span>
              <span className="unitap-feature-ico">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              </span>
              <h3>Real Test Conditions</h3>
              <p>Proktorlangan mock imtihonlar, timer bilan, haqiqiy imtihon sharoitida. Hech qanday chalg'itish yo'q.</p>
            </div>
            <div className="unitap-feature peach">
              <span className="unitap-feature-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg></span>
              <span className="unitap-feature-ico">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              </span>
              <h3>Expert Explanations</h3>
              <p>Har bir savol bo'yicha video va matnli tushuntirishlar. Nima uchun bu javob to'g'ri ekanini tushunasiz.</p>
            </div>
            <div className="unitap-feature green">
              <span className="unitap-feature-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg></span>
              <span className="unitap-feature-ico">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 3v18h18" /><path d="M7 16l4-4 4 4 5-5" /></svg>
              </span>
              <h3>Smart Analytics</h3>
              <p>Har bir mashqdan keyin batafsil hisobot. Qayerda yutqazayotganingizni aniq ko'ring.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="unitap-section" id="testimonials">
        <div className="unitap-section-inner">
          <span className="unitap-eyebrow u-reveal">TESTIMONIALS</span>
          <h2 className="unitap-h2 u-reveal" data-reveal-delay="0.05s">
            Talabalar <span className="unitap-h2-line">nima deydi</span>?
          </h2>
          <div className="unitap-testimonials u-stagger">
            <div className="unitap-testi">
              <span className="unitap-testi-stars">
                {[0, 1, 2, 3, 4].map((i) => (
                  <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="12 2 15 8.5 22 9.3 17 14 18.2 21 12 17.8 5.8 21 7 14 2 9.3 9 8.5" />
                  </svg>
                ))}
              </span>
              <p className="unitap-testi-quote">"3 oyda SAT ballimni 1180 dan 1480 gacha ko'tardim. AI tutor har bir savolni tushuntirib bergani juda yoqdi. Eng yaxshi sarmoya!"</p>
              <div className="unitap-testi-author">
                <div className="unitap-testi-avatar">S</div>
                <div className="unitap-testi-meta">
                  <span className="unitap-testi-name">SARDOR A.</span>
                  <span className="unitap-testi-role">+300 POINTS</span>
                </div>
              </div>
            </div>
            <div className="unitap-testi peach">
              <span className="unitap-testi-stars">
                {[0, 1, 2, 3, 4].map((i) => (
                  <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="12 2 15 8.5 22 9.3 17 14 18.2 21 12 17.8 5.8 21 7 14 2 9.3 9 8.5" />
                  </svg>
                ))}
              </span>
              <p className="unitap-testi-quote">"AP Biology'da 5 oldim! Mock imtihonlar va batafsil tushuntirishlar juda foydali bo'ldi. Repetitorga pul sarflash kerak emas edi."</p>
              <div className="unitap-testi-author">
                <div className="unitap-testi-avatar">M</div>
                <div className="unitap-testi-meta">
                  <span className="unitap-testi-name">MADINA Y.</span>
                  <span className="unitap-testi-role">AP BIO — SCORE 5</span>
                </div>
              </div>
            </div>
            <div className="unitap-testi green">
              <span className="unitap-testi-stars">
                {[0, 1, 2, 3, 4].map((i) => (
                  <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="12 2 15 8.5 22 9.3 17 14 18.2 21 12 17.8 5.8 21 7 14 2 9.3 9 8.5" />
                  </svg>
                ))}
              </span>
              <p className="unitap-testi-quote">"Kundalik 20 daqiqa mashq qilib, imtihonda 1520 ball oldim. Platformaning adaptive tizimi juda zo'r — faqat zaif joylarimga e'tibor berdi."</p>
              <div className="unitap-testi-author">
                <div className="unitap-testi-avatar">J</div>
                <div className="unitap-testi-meta">
                  <span className="unitap-testi-name">JASUR K.</span>
                  <span className="unitap-testi-role">SAT — 1520</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="unitap-final-cta">
        <div className="unitap-final-cta-bg" />
        <div className="unitap-final-cta-shape s1" />
        <div className="unitap-final-cta-shape s2" />
        <div className="unitap-final-cta-shape s3" />
        <div className="unitap-final-cta-inner u-stagger">
          <h2>Imtihongacha <em>vaqtingizni</em><br />behuda ketkazmang.</h2>
          <p>12,400+ talaba allaqachon SATAP Academy bilan natijalarini oshirdi. Siz ham qo'shiling — birinchi mock imtihon bepul.</p>
          <Link to="/auth" className="unitap-btn primary">HOZIROQ BOSHLASH →</Link>
        </div>
      </section>

      <footer className="unitap-footer">
        <div className="unitap-footer-inner">
          <div className="unitap-footer-grid">
            <div>
              <div className="unitap-footer-brand-mark">
                <span className="mark">S</span>
                SATAP Academy
              </div>
              <p className="unitap-footer-tag">
                SAT va AP imtihonlariga tayyorlanish uchun eng zamonaviy platforma.
                Maqsadingizga biz bilan erishing.
              </p>
            </div>
            <div className="unitap-footer-col">
              <span className="unitap-footer-heading">PLATFORM</span>
              <a href="#methodology">Methodology</a>
              <a href="#curriculum">Curriculum</a>
              <a href="#results">Results</a>
              <a href="#pricing">Pricing</a>
            </div>
            <div className="unitap-footer-col">
              <span className="unitap-footer-heading">SUBJECTS</span>
              <Link to="/sat-math">SAT Math</Link>
              <Link to="/sat-rw">SAT R&amp;W</Link>
              <Link to="/ap-bio">AP Biology</Link>
              <Link to="/ap-calc">AP Calculus</Link>
            </div>
            <div className="unitap-footer-col">
              <span className="unitap-footer-heading">SUPPORT</span>
              <Link to="/support">Help Center</Link>
              <Link to="/auth">Sign In</Link>
              <Link to="/auth">Sign Up</Link>
              <a href="mailto:umrqulov8@gmail.com">Contact</a>
            </div>
          </div>
          <div className="unitap-footer-bottom">
            <span>© 2026 SATAP Academy. All rights reserved.</span>
            <span>Built for ambitious students.</span>
          </div>
        </div>
      </footer>
      </main>
    </>
  )
}
