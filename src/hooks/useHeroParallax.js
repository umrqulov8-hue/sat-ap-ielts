import { useEffect, useRef } from 'react'

const lerp = (a, b, t) => a + (b - a) * t
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

export default function useHeroParallax() {
  const sectionRef = useRef(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const layers = section.querySelectorAll('[data-parallax-speed]')
    if (!layers.length) return

    let targetMX = 0
    let targetMY = 0
    let targetScroll = 0
    let curMX = 0
    let curMY = 0
    let curScroll = 0
    let rafId = null
    let running = true

    const onMouseMove = (e) => {
      const rect = section.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      targetMX = clamp((e.clientX - cx) / rect.width, -1, 1)
      targetMY = clamp((e.clientY - cy) / rect.height, -1, 1)
    }

    const onMouseLeave = () => {
      targetMX = 0
      targetMY = 0
    }

    const onScroll = () => {
      const rect = section.getBoundingClientRect()
      const vh = window.innerHeight
      const progress = clamp((vh - rect.top) / (vh + rect.height), 0, 1) - 0.5
      targetScroll = progress
    }

    const tick = () => {
      if (!running) return

      curMX = lerp(curMX, targetMX, 0.085)
      curMY = lerp(curMY, targetMY, 0.085)
      curScroll = lerp(curScroll, targetScroll, 0.06)

      layers.forEach((layer) => {
        const speed = parseFloat(layer.dataset.parallaxSpeed || '0')
        const rot = parseFloat(layer.dataset.parallaxRotate || '6')
        const range = parseFloat(layer.dataset.parallaxRange || '34')

        const tx = curMX * range * speed
        const ty = curMY * range * speed + curScroll * -50 * speed
        const rx = (-curMY * rot * speed).toFixed(2) + 'deg'
        const ry = (curMX * rot * speed).toFixed(2) + 'deg'
        const scale = (1 + Math.abs(curMX) * 0.015 * speed + Math.abs(curMY) * 0.015 * speed).toFixed(3)

        layer.style.setProperty('--px', tx.toFixed(2) + 'px')
        layer.style.setProperty('--py', ty.toFixed(2) + 'px')
        layer.style.setProperty('--rx', rx)
        layer.style.setProperty('--ry', ry)
        layer.style.setProperty('--ps', scale)
      })

      rafId = requestAnimationFrame(tick)
    }

    section.addEventListener('mousemove', onMouseMove, { passive: true })
    section.addEventListener('mouseleave', onMouseLeave, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    rafId = requestAnimationFrame(tick)

    return () => {
      running = false
      section.removeEventListener('mousemove', onMouseMove)
      section.removeEventListener('mouseleave', onMouseLeave)
      window.removeEventListener('scroll', onScroll)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [])

  return sectionRef
}
