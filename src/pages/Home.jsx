import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import OrbiImage from '../components/orbi/OrbiImage'
import BgLayer from '../components/orbi/BgLayer'
import { useBgExtras } from '../components/orbi/assets'
import Icon, { Star, Sparkle, Majolica } from '../components/orbi/Icons'
import { useReveal, useScrolled, useAnchorScroll, useHeroParallax, useStackCards, useCountUp } from '../hooks/useOrbiPage'

const NAV = [
  ['#uslub', 'USLUB'],
  ['#fanlar', 'FANLAR'],
  ['#natijalar', 'NATIJALAR'],
]

const MARQUEE = ['Algebra', 'Geometriya', 'Murakkab matematika', "Ma'lumotlar tahlili", 'Masala yechish', 'Amaliy testlar', 'AI ustoz', 'Oʻquv reja', 'Nazoratli imtihonlar']

const STEPS = [
  { n: '01', tag: 'ANIQLA', icon: 'target', color: 'var(--ob-lapis)', title: 'Darajangizni aniqlang', text: "5 daqiqalik diagnostik test orqali hozirgi matematika darajangiz va kuchli/zaif tomonlaringiz aniqlanadi." },
  { n: '02', tag: 'REJA TUZ', icon: 'route', color: 'var(--ob-emerald)', title: 'Shaxsiy reja tuzing', text: "AI sizning maqsadlaringiz va jadvalingizga mos ravishda har kun uchun aniq darslar va mashqlar tanlaydi." },
  { n: '03', tag: 'MASHQ QIL', icon: 'pencil', color: 'var(--ob-pomegranate)', title: 'Har kuni mashq qiling', text: "Real imtihon formatidagi 5,000+ savol, batafsil tushuntirishlar va AI ustoz yordamida mustahkamlang." },
  { n: '04', tag: 'ZABT ET', icon: 'trophy', color: 'var(--ob-gold-dark)', title: 'Imtihonni zabt eting', text: "Nazoratli mock imtihonlar bilan haqiqiy sharoitda mashq qiling va natijangizni kafolatlang." },
]

const FEATURES = [
  { icon: 'book', color: 'var(--ob-lapis)', title: '5,000+ amaliy savollar', text: "Algebra, Geometriya, Murakkab matematika, Ma'lumotlar tahlili, Masala yechish — barchasi real imtihon formatida." },
  { icon: 'chat', color: 'var(--ob-emerald)', title: 'AI ustoz — istalgan payt', text: "Har bir savol boʻyicha batafsil tushuntirish va shaxsiy maslahat." },
  { icon: 'clock', color: 'var(--ob-pomegranate)', title: 'Nazoratli mock imtihonlar', text: "Haqiqiy imtihon sharoitida, taymer bilan, toʻliq hisobot bilan." },
  { icon: 'chart', color: 'var(--ob-turquoise)', title: 'Kundalik natija kuzatuvi', text: "Natijangizni har kuni kuzatib boring, zaif tomonlaringizga eʼtibor qarating." },
  { icon: 'play', color: 'var(--ob-gold-dark)', title: 'Video darslar va strategiyalar', text: "Mutaxassislar tayyorlagan qisqa va aniq videolar." },
]

const SUBJECTS = [
  { to: '/algebra', uz: 'Algebra', en: 'Algebra', color: '#1F45A8' },
  { to: '/geometry', uz: 'Geometriya', en: 'Geometry', color: '#13804F' },
  { to: '/advanced-math', uz: 'Murakkab matematika', en: 'Advanced Math', color: '#C8372D' },
  { to: '/data-analysis', uz: "Ma'lumotlar tahlili", en: 'Data Analysis', color: '#1BA3B0' },
  { to: '/problem-solving', uz: 'Masala yechish', en: 'Problem Solving', color: '#B9852A' },
]

const WHY = [
  { icon: 'pulse', color: 'var(--ob-lapis)', title: 'Moslashuvchan oʻqish', text: "AI sizning kuchli va zaif tomonlaringizga qarab savollarni avtomatik ravishda tanlaydi. Vaqtni yoʻqotmang." },
  { icon: 'clock', color: 'var(--ob-emerald)', title: 'Haqiqiy imtihon sharoiti', text: "Nazoratli mock imtihonlar, taymer bilan, haqiqiy imtihon sharoitida. Hech qanday chalgʻitish yoʻq." },
  { icon: 'chat', color: 'var(--ob-pomegranate)', title: 'Ekspert tushuntirishlari', text: "Har bir savol boʻyicha video va matnli tushuntirishlar. Nima uchun bu javob toʻgʻri ekanini tushunasiz." },
  { icon: 'chart', color: 'var(--ob-turquoise)', title: 'Aqlli tahlil', text: "Har bir mashqdan keyin batafsil hisobot. Qayerda yutqazayotganingizni aniq koʻring." },
]

// TODO(jasper): real data? — the three testimonials below are placeholder copy from the old site.
const TESTIS = [
  { initial: 'S', color: 'var(--ob-lapis)', name: 'SARDOR A.', badge: '+300 BALL', quote: "3 oyda SAT ballimni 1180 dan 1480 gacha koʻtardim. AI ustoz har bir savolni tushuntirib bergani juda yoqdi. Eng yaxshi sarmoya!" },
  { initial: 'M', color: 'var(--ob-pomegranate)', name: 'MADINA Y.', badge: 'ALGEBRA — 800', quote: "Algebra'da 800 oldim! Mock imtihonlar va batafsil tushuntirishlar juda foydali boʻldi. Repetitorga pul sarflash kerak emas edi." },
  { initial: 'J', color: 'var(--ob-emerald)', name: 'JASUR K.', badge: 'SAT — 1520', quote: "Kundalik 20 daqiqa mashq qilib, imtihonda 1520 ball oldim. Platformaning moslashuvchan tizimi juda zoʻr — faqat zaif joylarimga eʼtibor berdi." },
]

function BrandMark() {
  return (
    <a href="#home" className="ob-brand" aria-label="UFQ — bosh sahifa">
      <span className="ob-brand-u">
        <svg className="ob-brand-doppi" viewBox="0 0 20 11" aria-hidden="true">
          <path d="M1 10C1 4.5 5 1 10 1s9 3.5 9 9z" fill="#121212" />
          <path d="M3 8.2h14" stroke="#fff" strokeWidth="1.2" strokeDasharray="1.5 1.8" />
        </svg>
        U
      </span>FQ
    </a>
  )
}

function Stat({ to, decimals = 0, suffix = '', label, className }) {
  const [ref, text] = useCountUp({ to, decimals, suffix })
  return (
    <div className={`ob-tile ${className}`} data-reveal>
      <div className="ob-num" ref={ref} aria-label={`${to}${suffix}`}>{text}</div>
      <div className="ob-num-label">{label}</div>
    </div>
  )
}

function Ring() {
  const ref = useRef(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) { setOn(true); return undefined }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect() } }, { threshold: 0.5 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <svg ref={ref} className={`ob-ring${on ? ' is-in' : ''}`} viewBox="0 0 120 120" aria-hidden="true">
      <circle className="bg" cx="60" cy="60" r="46" />
      <circle className="fg" cx="60" cy="60" r="46" />
    </svg>
  )
}

export default function Home() {
  const heroRef = useRef(null)
  const stackRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const scrolled = useScrolled(40)
  const extras = useBgExtras()
  useReveal()
  useAnchorScroll()
  useHeroParallax(heroRef)
  useStackCards(stackRef)

  useEffect(() => { document.title = 'UFQ — SAT Math Prep' }, [])
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])
  useEffect(() => {
    if (!menuOpen) return undefined
    const onKey = e => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="ob-page" id="home">
      <nav className={`ob-nav${scrolled ? ' scrolled' : ''}`} aria-label="Asosiy menyu">
        <BrandMark />
        <div className="ob-nav-links">
          {NAV.map(([href, label]) => <a key={href} href={href} className="ob-nav-link">{label}</a>)}
        </div>
        <div className="ob-nav-actions">
          <Link to="/auth" className="ob-nav-login">KIRISH</Link>
          <Link to="/auth" className="ob-btn small">ILOVANI OCHISH</Link>
          <button type="button" className="ob-burger" aria-label={menuOpen ? 'Menyuni yopish' : 'Menyuni ochish'} aria-expanded={menuOpen} aria-controls="ob-sheet" onClick={() => setMenuOpen(o => !o)}>
            <span /><span /><span />
          </button>
        </div>
      </nav>
      <div id="ob-sheet" className={`ob-sheet${menuOpen ? ' open' : ''}`} aria-hidden={!menuOpen} inert={!menuOpen}>
        {NAV.map(([href, label]) => <a key={href} href={href} className="big-link" onClick={closeMenu}>{label}</a>)}
        <Link to="/auth" className="big-link" onClick={closeMenu}>KIRISH</Link>
        <Link to="/auth" className="ob-btn big" onClick={closeMenu}>ILOVANI OCHISH</Link>
      </div>

      <main>
        {/* 2. HERO */}
        <section className="ob-hero" id="hero" data-orbi="hidden" ref={heroRef}>
          <div className="ob-bg-par" data-depth="6"><BgLayer name="hero" priority /></div>
          <div className="ob-container ob-hero-grid">
            <div className="ob-hero-text">
              <span className="ob-hero-chip" data-reveal><span className="ob-dot" aria-hidden="true" />2026-yil qabuli ochiq</span>
              <h1 data-reveal style={{ '--i': 1 }}>
                Imtihon natijangni <span className="ob-underline">uch barobar
                  <svg viewBox="0 0 300 20" preserveAspectRatio="none" aria-hidden="true"><path d="M4 13 C 60 3, 120 17, 180 8 S 270 6, 296 11" /></svg>
                </span> oshir.
              </h1>
              <p className="ob-hero-sub" data-reveal style={{ '--i': 2 }}>
                Bizning zamonaviy tayyorlov platformamiz matematika imtihonlariga tayyorgarlik koʻrishning
                yangi usulini taklif etadi. Maqsadli darslar, real imtihon simulyatsiyalari va AI yordam.
              </p>
              <div className="ob-hero-actions" data-reveal style={{ '--i': 3 }}>
                <Link to="/auth" className="ob-btn big">BEPUL BOSHLASH <Icon name="arrow" width="22" height="22" /></Link>
                <a href="#uslub" className="ob-btn secondary big">QANDAY ISHLAYDI</a>
              </div>
              {/* TODO(jasper): real data? — the three hero stats are placeholder numbers from the old site. */}
              <div className="ob-stat-chips" data-reveal style={{ '--i': 4 }}>
                <div className="ob-stat-chip ob-glass"><b>12,400+</b><span>Faol talabalar</span></div>
                <div className="ob-stat-chip ob-glass"><b>1520</b><span>Oʻrtacha SAT</span></div>
                <div className="ob-stat-chip ob-glass"><b>98%</b><span>Maqsadga erishgan</span></div>
              </div>
            </div>

            <div className="ob-hero-art">
              <div className="ob-podium ob-parallax" data-depth="14" aria-hidden="true">
                {extras.has('podium') ? <img src="/bg/podium.webp" alt="" width="720" height="240" loading="eager" /> : <div className="ob-podium-css" />}
              </div>
              <div className="ob-parallax ob-hero-orbi-wrap" data-depth="14">
                <OrbiImage pose="wave" className="ob-hero-orbi" eager alt="Orbi qoʻl silkitib salomlashmoqda" />
              </div>
              <div className="ob-float-card ob-glass a" aria-hidden="true"><b>1520</b><span>SAT ball</span></div>
              <div className="ob-float-card ob-glass b" aria-hidden="true"><b>+250</b><span>Algebra</span></div>
              <Sparkle style={{ top: '12%', left: '18%' }} />
              <Sparkle style={{ top: '30%', right: '6%', width: 14, height: 14, animationDelay: '0.8s' }} />
            </div>
          </div>
        </section>

        {/* 3. MARQUEE */}
        <div className="ob-marquees" aria-hidden="true">
          {['lapis', 'emerald'].map(tone => (
            <div key={tone} className={`ob-marquee ${tone}`}>
              <div className="ob-marquee-track">
                {[0, 1, 2, 3].map(rep => MARQUEE.map(item => (
                  <span className="ob-marquee-item" key={`${rep}-${item}`}>{item} <i>✦</i></span>
                )))}
              </div>
            </div>
          ))}
        </div>

        {/* 4. USLUB */}
        <section className="ob-section ob-uslub ob-pattern" id="uslub" data-orbi="think" data-orbi-say="think">
          <BgLayer name="study" />
          <div className="ob-container ob-uslub-grid">
            <div className="ob-uslub-side">
              <span className="ob-eyebrow" data-reveal>USLUB</span>
              <h2 className="ob-h2" data-reveal style={{ '--i': 1 }}>Toʻrtta oddiy <span className="hl">qadam</span> bilan natijaga erishing.</h2>
              <p className="ob-lead" data-reveal style={{ '--i': 2 }}>
                Bizning platformamiz imtihonga tayyorlanish jarayonini soddalashtiradi.
                Faqat roʻyxatdan oʻting, darajangizni aniqlang va har kuni 20 daqiqa mashq qiling.
              </p>
            </div>
            <div className="ob-stack" ref={stackRef}>
              {STEPS.map((s, i) => (
                <article className="ob-stack-card ob-card" style={{ '--n': i }} key={s.n}>
                  <div className="ob-step-num" aria-hidden="true">{s.n}</div>
                  <div>
                    <span className="ob-step-tag">{s.n} / {s.tag}</span>
                    <h3 className="ob-step-title">{s.title}</h3>
                    <p className="ob-step-desc">{s.text}</p>
                  </div>
                  <span className="ob-ico" style={{ '--ic': s.color }}><Icon name={s.icon} /></span>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 5. STATS / BENTO */}
        <section className="ob-section" id="natijalar" data-orbi="celebrate" data-orbi-say="celebrate" style={{ paddingTop: 40 }}>
          <div className="ob-container">
            <div className="ob-head">
              <span className="ob-eyebrow" data-reveal>NATIJALAR</span>
              <h2 className="ob-h2" data-reveal style={{ '--i': 1 }}>Raqamlar <span className="hl">gapiradi</span>.</h2>
            </div>
            {/* TODO(jasper): real data? — the numbers below are placeholder stats from the old site. */}
            <div className="ob-bento">
              <div className="ob-tile big" data-reveal>
                <OrbiImage pose="score" size={640} alt="Orbi natija kartochkasini ushlab turibdi" />
                <Sparkle style={{ top: '10%', left: '12%' }} />
                <Sparkle style={{ top: '34%', left: '4%', width: 14, height: 14, animationDelay: '1s' }} />
                <BigNum />
              </div>
              <Stat to={12400} label="Faol talabalar" className="t2" />
              <Stat to={4.9} decimals={1} label="Foydalanuvchi reytingi" className="t3" />
              <div className="ob-tile t4" data-reveal style={{ '--i': 2 }}>
                <div>
                  <div className="ob-num">98%</div>
                  <div className="ob-num-label">Maqsadga erishgan</div>
                </div>
                <Ring />
              </div>
            </div>
          </div>
        </section>

        {/* 6. FANLAR */}
        <section className="ob-section ob-fanlar" id="fanlar" data-orbi="study" data-orbi-say="study">
          <BgLayer name="sky" />
          <div className="ob-container">
            <div className="ob-head center">
              <span className="ob-eyebrow" data-reveal>FANLAR</span>
              <h2 className="ob-h2" data-reveal style={{ '--i': 1, maxWidth: '20ch' }}>Sizga kerak boʻlgan <span className="hl">hamma narsa</span> bitta platformada.</h2>
              <p className="ob-lead" data-reveal style={{ '--i': 2 }}>Boshqa darsliklar, qoʻshimcha darslar yoki qimmat repetitorlar kerak emas. Hammasi shu yerda.</p>
            </div>
            <div className="ob-feature-grid">
              {FEATURES.map((f, i) => (
                <article className="ob-feature ob-glass" key={f.title} data-reveal style={{ '--i': i }}>
                  <span className="ob-ico sm" style={{ '--ic': f.color }}><Icon name={f.icon} /></span>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </article>
              ))}
            </div>
            <div className="ob-subjects" data-reveal>
              {SUBJECTS.map(s => (
                <Link key={s.to} to={s.to} className="ob-subject-chip" style={{ '--sc': s.color }}>
                  <b>{s.uz}</b>
                  <small>{s.en}</small>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* 7. NEGA UFQ */}
        <section className="ob-section ob-nega ob-pattern" id="nega" data-orbi="point">
          <div className="ob-container">
            <div className="ob-head">
              <span className="ob-eyebrow" data-reveal>NEGA UFQ?</span>
              <h2 className="ob-h2" data-reveal style={{ '--i': 1 }}>Nega <span className="hl">UFQ</span>?</h2>
              <p className="ob-lead" data-reveal style={{ '--i': 2 }}>Boshqa platformalardan farqli — har bir xususiyat natijaga yoʻnaltirilgan.</p>
            </div>
            <div className="ob-why-grid">
              {WHY.map((w, i) => (
                <article className="ob-why ob-card" key={w.title} data-reveal style={{ '--i': i }}>
                  <Majolica />
                  <span className="ob-ico sm" style={{ '--ic': w.color }}><Icon name={w.icon} /></span>
                  <h3>{w.title}</h3>
                  <p>{w.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 9. FIKRLAR */}
        <section className="ob-section ob-fikrlar" id="fikrlar" data-orbi="celebrate" data-orbi-say="celebrate-2">
          <BgLayer name="results" />
          <div className="ob-container">
            <div className="ob-head">
              <span className="ob-eyebrow" style={{ color: 'var(--ob-lapis-dark)' }} data-reveal>FIKRLAR</span>
              <h2 className="ob-h2" data-reveal style={{ '--i': 1 }}>Talabalar <span className="hl">nima deydi</span>?</h2>
            </div>
            <div className="ob-testis">
              {TESTIS.map((t, i) => (
                <article className="ob-testi ob-glass" key={t.name} data-reveal style={{ '--i': i }}>
                  <div className="ob-stars" role="img" aria-label="5 ta yulduz">{[0, 1, 2, 3, 4].map(k => <Star key={k} />)}</div>
                  <p className="ob-quote">“{t.quote}”</p>
                  <div className="ob-testi-author">
                    <span className="ob-avatar" style={{ '--av': t.color }} aria-hidden="true">{t.initial}</span>
                    <div>
                      <span className="ob-testi-name">{t.name}</span>
                      <span className="ob-badge">{t.badge}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 10. OXIRGI CHAQIRIQ */}
        <section className="ob-section ob-night" id="cta" data-orbi="point" data-orbi-hide="true">
          <BgLayer name="night" />
          <div className="ob-stars-bg" aria-hidden="true">
            {Array.from({ length: 36 }, (_, i) => (
              <i key={i} style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, '--d': `${(i % 9) * 0.35}s`, width: i % 5 === 0 ? 4 : 3, height: i % 5 === 0 ? 4 : 3 }} />
            ))}
          </div>
          <div className="ob-container ob-cta-grid">
            <div>
              <h2 data-reveal>Imtihongacha <em>vaqtingizni</em> behuda ketkazmang.</h2>
              <p className="lead" data-reveal style={{ '--i': 1 }}>12,400+ talaba allaqachon UFQ bilan natijalarini oshirdi. Siz ham qoʻshiling — birinchi mock imtihon bepul.</p>
              <div data-reveal style={{ '--i': 2 }}>
                <Link to="/auth" className="ob-btn big cta-gold">HOZIROQ BOSHLASH <Icon name="arrow" width="22" height="22" /></Link>
              </div>
            </div>
            <div className="ob-cta-orbi" data-reveal>
              <div className="ob-say" aria-hidden="true">Qani, boshladik!</div>
              <OrbiImage pose="point" alt="Orbi sizni boshlashga chorlayapti" />
            </div>
          </div>
        </section>
      </main>

      {/* 11. FOOTER */}
      <footer className="ob-footer" id="footer" data-orbi="tea">
        <div className="ob-ikat" aria-hidden="true" />
        <div className="ob-container ob-footer-inner">
          <div className="ob-footer-grid">
            <div>
              <BrandMark />
              <p className="ob-footer-tag">Matematika imtihonlariga tayyorlanish uchun eng zamonaviy platforma. Maqsadingizga biz bilan erishing.</p>
            </div>
            <div className="ob-footer-col">
              <h4>PLATFORMA</h4>
              <a href="#uslub">Uslub</a>
              <a href="#fanlar">Fanlar</a>
              <a href="#natijalar">Natijalar</a>
            </div>
            <div className="ob-footer-col">
              <h4>FANLAR</h4>
              <Link to="/advanced-math">Murakkab matematika</Link>
              <Link to="/data-analysis">Ma'lumotlar tahlili</Link>
              <Link to="/problem-solving">Masala yechish</Link>
              <Link to="/algebra">Algebra</Link>
              <Link to="/geometry">Geometriya</Link>
            </div>
            <div className="ob-footer-col">
              <h4>YORDAM</h4>
              <Link to="/support">Yordam markazi</Link>
              <Link to="/auth">Kirish</Link>
              <Link to="/auth">Roʻyxatdan oʻtish</Link>
              <a href="mailto:umrqulov8@gmail.com">Aloqa</a>
            </div>
          </div>
          <div className="ob-footer-bottom">
            <span>© 2026 UFQ. Barcha huquqlar himoyalangan.</span>
            <span>Maqsadli talabalar uchun yaratilgan.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

function BigNum() {
  const [ref, text] = useCountUp({ to: 1520 })
  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div className="ob-num" ref={ref} aria-label="1520">{text}</div>
      <div className="ob-num-label">Oʻrtacha SAT ball</div>
    </div>
  )
}
