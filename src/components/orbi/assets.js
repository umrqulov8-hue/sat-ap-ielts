// Reads the manifests written by scripts/prepare-assets.mjs, so a new pose or
// background shows up as soon as its optimized files are committed.
import { useEffect, useState } from 'react'

const cache = {}
function load(name, url) {
  if (!cache[name]) {
    cache[name] = fetch(url)
      .then(r => (r.ok && (r.headers.get('content-type') || '').includes('json') ? r.json() : {}))
      .catch(() => ({}))
  }
  return cache[name]
}

export const loadPoses = () => load('poses', '/companion/manifest.json').then(m => new Set(m.poses || ['idle']))
export const loadBackgrounds = () => load('bgs', '/bg/manifest.json').then(m => new Map((m.backgrounds || []).map(b => [b.name, b])))
export const loadExtras = () => load('bgs', '/bg/manifest.json').then(m => new Set(m.extras || []))

export function usePoses() {
  const [poses, setPoses] = useState(() => new Set(['idle']))
  useEffect(() => {
    let alive = true
    loadPoses().then(p => { if (alive) setPoses(p) })
    return () => { alive = false }
  }, [])
  return poses
}

export function useBackgrounds() {
  const [bgs, setBgs] = useState(() => new Map())
  useEffect(() => {
    let alive = true
    loadBackgrounds().then(b => { if (alive) setBgs(b) })
    return () => { alive = false }
  }, [])
  return bgs
}

export const poseSrc = (pose, small = false) => `/companion/orbi-${pose}${small ? '@320' : ''}.webp`

export function useBgExtras() {
  const [extras, setExtras] = useState(() => new Set())
  useEffect(() => {
    let alive = true
    loadExtras().then(e => { if (alive) setExtras(e) })
    return () => { alive = false }
  }, [])
  return extras
}
