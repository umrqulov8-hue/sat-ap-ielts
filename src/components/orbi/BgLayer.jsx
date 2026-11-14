import { useBackgrounds } from './assets'

// Background art with a CSS gradient underneath. If `bg-<name>` has been
// prepared (see scripts/prepare-assets.mjs) it fades over the gradient.
export default function BgLayer({ name, priority = false }) {
  const bgs = useBackgrounds()
  const desktop = bgs.get(`bg-${name}`)
  const mobile = bgs.get(`bg-${name}-mobile`)
  return (
    <div className="ob-bg" aria-hidden="true">
      <div className="ob-bg-fallback" />
      {desktop && (
        <picture>
          {mobile && <source media="(max-width: 767px)" type="image/avif" srcSet={`/bg/bg-${name}-mobile-720.avif 720w, /bg/bg-${name}-mobile-1080.avif 1080w`} sizes="100vw" />}
          {mobile && <source media="(max-width: 767px)" type="image/webp" srcSet={`/bg/bg-${name}-mobile-720.webp 720w, /bg/bg-${name}-mobile-1080.webp 1080w`} sizes="100vw" />}
          <source type="image/avif" srcSet={desktop.widths.map(w => `/bg/bg-${name}-${w}.avif ${w}w`).join(', ')} sizes="100vw" />
          <source type="image/webp" srcSet={desktop.widths.map(w => `/bg/bg-${name}-${w}.webp ${w}w`).join(', ')} sizes="100vw" />
          <img className="ob-bg-img" src={`/bg/bg-${name}-1280.webp`} alt="" width="1920" height="1080" fetchPriority={priority ? 'high' : undefined} loading={priority ? 'eager' : 'lazy'} decoding="async" />
        </picture>
      )}
    </div>
  )
}
