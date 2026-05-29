import { useEffect } from 'react'
import useScrollReveal from '../hooks/useScrollReveal'

export default function Home() {
  useScrollReveal()

  useEffect(() => { document.title = 'SATAP Academy — SAT & AP Prep' }, [])

  useEffect(() => {
    const handleClick = (e) => {
      const a = e.target.closest('a[href^="#"]')
      if (!a || a.getAttribute('href') === '#') return
      e.preventDefault()
      const target = document.querySelector(a.getAttribute('href'))
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
      <nav className="navbar" id="navbar">
        <a href="#methodology" className="nav-item nav-link">METHODOLOGY</a>
        <a href="#curriculum" className="nav-item nav-link">CURRICULUM</a>
        <a href="#results" className="nav-item nav-link">RESULTS</a>
        <a href="#pricing" className="nav-item nav-link">PRICING</a>
        <a href="/auth" className="nav-item btn-nav">BEGIN JOURNEY &rarr;</a>
      </nav>

      <main className="container">
        <section className="hero" id="home">
          <div className="reveal-hero">
            <h1 className="hero-title">SATAP<br />ACADEMY.</h1>
          </div>
          <div className="h-divider reveal-fade" />
          <div className="hero-bottom reveal-fade" style={{ transitionDelay: '0.2s' }}>
            <div className="hero-desc">
              Kelajakning eng mukammal <em>o'quv ekotizimi.</em><br />
              Biz bilan natija kafolatlangan.
            </div>
            <div className="hero-meta">
              <div className="meta-line">REF: SA-2026-V5.2</div>
              <div className="meta-line">BRUTALIST EDITION</div>
            </div>
          </div>
        </section>

        <div className="marquee-strip reveal-fade">
          <div className="marquee-content">
            &mdash; MUVAFFAQIYAT GAROVI SATAP &mdash; THE SCIENCE OF SCORING &mdash; MUVAFFAQIYAT GAROVI SATAP &mdash; THE SCIENCE OF SCORING &mdash; MUVAFFAQIYAT GAROVI SATAP &mdash; THE SCIENCE OF SCORING
          </div>
        </div>

        <section className="philosophy" id="methodology">
          <div className="b-grid reveal-fade">
            <div className="b-cell p-cell-left">
              <div className="reveal-heading">
                <h2 className="huge-text">BIZNING<br />FALSAFA.</h2>
              </div>
              <p className="desc-text reveal-fade" style={{ transitionDelay: '0.2s' }}>Biz shunchaki SAT va AP o'rgatmaymiz. Biz fanni his qilish va imtihon algoritmlarini boshqarishni o'rgatamiz.</p>
            </div>
            <div className="b-cell p-cell-right">
              <div className="reveal-heading" style={{ transitionDelay: '0.1s' }}>
                <div className="huge-number">94%</div>
              </div>
              <div className="small-caps reveal-fade" style={{ transitionDelay: '0.3s' }}>MUVAFFAQIYAT</div>
            </div>
          </div>
          <div className="b-grid b-grid-bottom reveal-fade">
            <div className="b-cell m-cell-left">
              <div className="reveal-heading">
                <div className="huge-number">50k</div>
              </div>
              <div className="small-caps reveal-fade" style={{ transitionDelay: '0.2s' }}>MATERIALLAR</div>
            </div>
            <a href="/auth" className="b-cell black-cell">
              <div className="action-text">BOSHLASH &rarr;</div>
            </a>
          </div>
        </section>

        <section className="system" id="curriculum">
          <div className="system-header">
            <div className="reveal-heading">
              <h2 className="massive-text">O'QUV<br />TIZIMI.</h2>
            </div>
            <div className="system-meta small-caps reveal-fade" style={{ transitionDelay: '0.2s' }}>
              HAR BIR KO'NIKMA<br />UCHUN MUKAMMAL<br />YECHIM.
            </div>
          </div>
          <div className="h-divider reveal-fade" />
          <div className="sys-grid">
            <div className="sys-item reveal-card">
              <div className="bg-num parallax-bg">01</div>
              <div className="sys-content">
                <h3>SAT MATH</h3>
                <p>Analitik tahlil va intensiv mashg'ulotlar orqali math ko'nikmalarini yangi bosqichga olib chiqamiz.</p>
              </div>
            </div>
            <div className="sys-item reveal-card" style={{ transitionDelay: '0.1s' }}>
              <div className="bg-num parallax-bg">02</div>
              <div className="sys-content">
                <h3>READING</h3>
                <p>Analitik tahlil va intensiv mashg'ulotlar orqali reading ko'nikmalarini yangi bosqichga olib chiqamiz.</p>
              </div>
            </div>
            <div className="sys-item reveal-card" style={{ transitionDelay: '0.2s' }}>
              <div className="bg-num parallax-bg">03</div>
              <div className="sys-content">
                <h3>WRITING</h3>
                <p>Analitik tahlil va intensiv mashg'ulotlar orqali writing ko'nikmalarini yangi bosqichga olib chiqamiz.</p>
              </div>
            </div>
            <div className="sys-item reveal-card" style={{ transitionDelay: '0.3s' }}>
              <div className="bg-num parallax-bg">04</div>
              <div className="sys-content">
                <h3>SPEAKING</h3>
                <p>Analitik tahlil va intensiv mashg'ulotlar orqali speaking ko'nikmalarini yangi bosqichga olib chiqamiz.</p>
              </div>
            </div>
          </div>
          <div className="h-divider reveal-fade" />
        </section>

        <section className="results" id="results">
          <div className="results-header">
            <div className="reveal-heading">
              <h2 className="massive-text">NATIJALAR.</h2>
            </div>
            <div className="results-meta small-caps reveal-fade" style={{ transitionDelay: '0.2s' }}>
              BIZNING<br />TALABALARNING<br />HAQIQIY<br />MUVAFFAQIYATI.
            </div>
          </div>
          <div className="h-divider reveal-fade" />
          <div className="results-grid">
            <div className="r-card reveal-card">
              <div className="r-top"><span className="r-name small-caps">ASRORBEK</span><span className="r-line" /></div>
              <div className="r-score">1520</div>
              <div className="r-label small-caps">SAT SCORE</div>
              <div className="r-ap-row"><span className="r-ap-score">5</span><span className="r-ap-label small-caps">AP SCORE</span></div>
              <div className="r-divider" />
              <div className="r-bottom"><span className="r-target small-caps">TARGET: 1500</span><span className="r-arrow">&rarr;</span></div>
            </div>
            <div className="r-card reveal-card" style={{ transitionDelay: '0.1s' }}>
              <div className="r-top"><span className="r-name small-caps">MALIKA</span><span className="r-line" /></div>
              <div className="r-score">1450</div>
              <div className="r-label small-caps">SAT SCORE</div>
              <div className="r-ap-row"><span className="r-ap-score">4</span><span className="r-ap-label small-caps">AP SCORE</span></div>
              <div className="r-divider" />
              <div className="r-bottom"><span className="r-target small-caps">TARGET: 1400</span><span className="r-arrow">&rarr;</span></div>
            </div>
            <div className="r-card reveal-card" style={{ transitionDelay: '0.2s' }}>
              <div className="r-top"><span className="r-name small-caps">JASUR</span><span className="r-line" /></div>
              <div className="r-score">1380</div>
              <div className="r-label small-caps">SAT SCORE</div>
              <div className="r-ap-row"><span className="r-ap-score">4</span><span className="r-ap-label small-caps">AP SCORE</span></div>
              <div className="r-divider" />
              <div className="r-bottom"><span className="r-target small-caps">TARGET: 1350</span><span className="r-arrow">&rarr;</span></div>
            </div>
          </div>
          <div className="h-divider reveal-fade" />
        </section>

        <section className="pricing" id="pricing">
          <div className="pricing-header">
            <div className="reveal-heading">
              <h2 className="massive-text text-center">SARMOYA.</h2>
            </div>
            <div className="small-caps text-center pricing-sub reveal-fade" style={{ transitionDelay: '0.2s' }}>KELAJAGINGIZ UCHUN MUNOSIB TANLOV</div>
          </div>
          <div className="h-divider reveal-fade" />
          <div className="pricing-grid">
            <div className="p-card reveal-card">
              <div className="p-name small-caps">PRO</div>
              <div className="p-price"><span className="price-val price-free">FREE</span></div>
              <div className="p-desc">2 Mock imtihon</div>
              <div className="p-action"><a href="/auth" className="btn-outline btn-smooth-hover">TANLASH</a></div>
            </div>
            <div className="p-card p-dark reveal-card" style={{ transitionDelay: '0.1s' }}>
              <div className="p-name small-caps">PREMIUM</div>
              <div className="p-price"><span className="price-val price-free">FREE</span></div>
              <div className="p-desc">3 Mock imtihon</div>
              <div className="p-action"><a href="/auth" className="btn-outline btn-smooth-hover">TANLASH</a></div>
            </div>
            <div className="p-card reveal-card" style={{ transitionDelay: '0.2s' }}>
              <div className="p-name small-caps">ULTIMATE</div>
              <div className="p-price"><span className="price-val price-free">FREE</span></div>
              <div className="p-desc">4 Mock imtihon</div>
              <div className="p-action"><a href="/auth" className="btn-outline btn-smooth-hover">TANLASH</a></div>
            </div>
            <div className="p-card reveal-card" style={{ transitionDelay: '0.3s' }}>
              <div className="p-name small-caps">LIFETIME</div>
              <div className="p-price"><span className="price-val price-free">TEZ KUNDA</span></div>
              <div className="p-desc">Bir umrlik</div>
              <div className="p-action"><a href="/auth" className="btn-outline btn-smooth-hover">TANLASH</a></div>
            </div>
          </div>
          <div className="h-divider reveal-fade" />
        </section>

        <section className="final-cta">
          <div className="reveal-epic" style={{ marginBottom: '4rem', width: '100%', textAlign: 'center' }}>
            <h2 className="massive-text text-center" style={{ fontSize: 'clamp(4rem, 12vw, 10rem)', lineHeight: 1 }}>MUKAMMALIKKA<br />INTILING.</h2>
          </div>
          <div className="cta-btn-wrapper reveal-card" style={{ transitionDelay: '0.3s' }}>
            <a href="/auth" className="btn-massive btn-smooth-hover">HOZIROQ KIRISH</a>
          </div>
        </section>
      </main>
    </>
  )
}
