import { useEffect, useRef, useState } from 'react'

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Fade + rise once for every [data-reveal] element on the page.
export function useReveal() {
  useEffect(() => {
    const els = [...document.querySelectorAll('[data-reveal]')]
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      els.forEach(el => el.classList.add('is-in'))
      return undefined
    }
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in')
          io.unobserve(entry.target)
        }
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])
}

// Navbar gets more opaque after 40px of scroll.
export function useScrolled(offset = 40) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > offset)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [offset])
  return scrolled
}

// Smooth-scrolls in-page anchors (#uslub, ...) below the floating navbar.
export function useAnchorScroll(offset = 84) {
  useEffect(() => {
    const onClick = e => {
      const a = e.target.closest?.('a[href^="#"]')
      const href = a?.getAttribute('href')
      if (!href || href.length < 2) return
      const target = document.querySelector(href)
      if (!target) return
      e.preventDefault()
      const top = target.getBoundingClientRect().top + window.scrollY - offset + 1
      window.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
      history.replaceState(null, '', href)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [offset])
}

// Mouse parallax (desktop only): sets --px/--py on elements with [data-depth].
export function useHeroParallax(ref) {
  useEffect(() => {
    const root = ref.current
    if (!root || prefersReducedMotion() || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return undefined
    const layers = [...root.querySelectorAll('[data-depth]')]
    let frame = 0
    const onMove = e => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const r = root.getBoundingClientRect()
        const nx = ((e.clientX - r.left) / r.width - 0.5) * 2
        const ny = ((e.clientY - r.top) / r.height - 0.5) * 2
        layers.forEach(layer => {
          const depth = Number(layer.dataset.depth)
          layer.style.setProperty('--px', `${(-nx * depth).toFixed(1)}px`)
          layer.style.setProperty('--py', `${(-ny * depth).toFixed(1)}px`)
        })
      })
    }
    const onLeave = () => layers.forEach(l => { l.style.setProperty('--px', '0px'); l.style.setProperty('--py', '0px') })
    root.addEventListener('pointermove', onMove)
    root.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(frame)
      root.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerleave', onLeave)
    }
  }, [ref])
}

// Desktop step cards stack: each card shrinks slightly as the next one covers it.
export function useStackCards(ref) {
  useEffect(() => {
    const root = ref.current
    if (!root || prefersReducedMotion()) return undefined
    const cards = [...root.querySelectorAll('.ob-stack-card')]
    let frame = 0
    const update = () => {
      frame = 0
      if (window.innerWidth <= 960) {
        cards.forEach(c => c.style.setProperty('--s', '1'))
        return
      }
      cards.forEach((card, i) => {
        const next = cards[i + 1]
        if (!next) return
        const cardRect = card.getBoundingClientRect()
        const covered = Math.min(1, Math.max(0, (cardRect.bottom - next.getBoundingClientRect().top) / cardRect.height))
        card.style.setProperty('--s', (1 - covered * 0.06).toFixed(3))
      })
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [ref])
}

// Counts up when scrolled into view. Output keeps the thousands comma style of the old site.
export function useCountUp({ to, decimals = 0, suffix = '', duration = 1800 }) {
  const ref = useRef(null)
  const format = v => v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: to >= 10000 }) + suffix
  const [text, setText] = useState(() => format(0))
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      setText(format(to))
      return undefined
    }
    let frame = 0
    const io = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return
      io.disconnect()
      const start = performance.now()
      const tick = now => {
        const t = Math.min(1, (now - start) / duration)
        setText(format(to * (1 - Math.pow(1 - t, 3))))
        if (t < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }, { threshold: 0.4 })
    io.observe(el)
    return () => { io.disconnect(); cancelAnimationFrame(frame) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, decimals, suffix, duration])
  return [ref, text]
}
