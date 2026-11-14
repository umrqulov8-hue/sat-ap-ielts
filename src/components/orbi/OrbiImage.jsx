import { usePoses, poseSrc } from './assets'

// Orbi in a given pose. A pose without a file yet falls back to orbi-idle.
export default function OrbiImage({ pose = 'idle', size = 640, alt = 'Orbi — UFQ maskoti', className, eager = false, ...rest }) {
  const poses = usePoses()
  const name = poses.has(pose) ? pose : 'idle'
  const small = size <= 320
  return (
    <img
      className={className}
      src={poseSrc(name, small)}
      srcSet={small ? undefined : `${poseSrc(name, true)} 320w, ${poseSrc(name)} 640w`}
      sizes={small ? undefined : '(max-width: 960px) 320px, 640px'}
      width={size}
      height={size}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      {...rest}
    />
  )
}
