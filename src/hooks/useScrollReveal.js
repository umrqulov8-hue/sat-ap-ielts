import { useEffect } from 'react'

export default function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const delay = entry.target.style.transitionDelay || '0s'
          entry.target.style.transitionDelay = delay
          entry.target.classList.add('active')
          observer.unobserve(entry.target)
        }
      })
    }, { root: null, rootMargin: '0px 0px 60px 0px', threshold: 0 })

    const els = document.querySelectorAll('.reveal-fade, .reveal-hero, .reveal-heading, .reveal-card, .reveal-epic')
    els.forEach(el => observer.observe(el))

    const parallaxConfigs = [
      { selector: '.parallax-slow', speed: 0.015 },
      { selector: '.parallax-medium', speed: 0.025 },
      { selector: '.parallax-fast', speed: 0.04 },
      { selector: '.parallax-bg', speed: -0.02 }
    ]

    const parallaxCache = parallaxConfigs.map(({ selector, speed }) => ({
      elements: [...document.querySelectorAll(selector)],
      speed
    }))

    const state = new Map()
    let id = 0

    let rafId
    const loop = () => {
      const sy = window.scrollY
      parallaxCache.forEach(({ elements, speed }) => {
        elements.forEach(el => {
          if (!el.isConnected) return
          const rect = el.getBoundingClientRect()
          const key = el.dataset.pid || (el.dataset.pid = id++)
          if (rect.top < window.innerHeight + 200 && rect.bottom > -200) {
            const dc = rect.top + rect.height / 2 - window.innerHeight / 2
            const target = -(dc * speed)
            const cur = state.get(key) || 0
            const smooth = cur + (target - cur) * 0.1
            state.set(key, smooth)
            el.style.transform = `translateY(${smooth}px)`
          }
        })
      })
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)

    const navbar = document.getElementById('navbar')
    const onScroll = () => navbar?.classList.toggle('scrolled', window.scrollY > 50)
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      observer.disconnect()
      cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])
}
