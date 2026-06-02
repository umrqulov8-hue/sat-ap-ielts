import { useEffect } from 'react'

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

const animateCount = (el) => {
  const target = parseFloat(el.dataset.countTo)
  if (isNaN(target)) return
  const duration = parseFloat(el.dataset.countDuration || '1800')
  const decimals = parseInt(el.dataset.countDecimals || '0', 10)
  const prefix = el.dataset.countPrefix || ''
  const suffix = el.dataset.countSuffix || ''
  const start = performance.now()
  const tick = (now) => {
    const elapsed = now - start
    const t = Math.min(1, elapsed / duration)
    const v = target * easeOutCubic(t)
    el.textContent = prefix + v.toFixed(decimals) + suffix
    if (t < 1) requestAnimationFrame(tick)
    else el.textContent = prefix + target.toFixed(decimals) + suffix
  }
  requestAnimationFrame(tick)
}

const animateProgress = (el) => {
  const target = parseFloat(el.dataset.progressTo || '100')
  const duration = parseFloat(el.dataset.progressDuration || '1400')
  el.style.width = '0%'
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.transition = `width ${duration}ms cubic-bezier(0.16, 1, 0.3, 1)`
      el.style.width = target + '%'
    })
  })
}

export default function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target
          const delay = el.dataset.revealDelay
          if (delay) el.style.transitionDelay = delay
          el.classList.add('active')
          if (el.classList.contains('u-count')) animateCount(el)
          if (el.classList.contains('u-progress')) animateProgress(el)
          observer.unobserve(el)
        }
      })
    }, { root: null, rootMargin: '0px 0px 70px 0px', threshold: 0.05 })

    const els = document.querySelectorAll(
      '.reveal-fade, .reveal-hero, .reveal-heading, .reveal-card, .reveal-epic, .u-reveal, .u-count, .u-progress, .u-stagger'
    )
    els.forEach((el) => observer.observe(el))

    const navbar = document.querySelector('.unitap-nav')
    const onScroll = () => {
      if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 50)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [])
}
