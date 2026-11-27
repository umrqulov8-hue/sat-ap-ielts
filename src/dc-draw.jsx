// Drawing tools (pen, highlight, 2D and 3D shapes, eraser, undo) for the design's practice screen.
// Built to public/dc/draw.js by vite.draw.config.js; the page talks to it through window.UfqDraw.
import { useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import DrawingCanvas from './components/DrawingCanvas'
import './dc-draw.css'

let state = { open: false, pageId: 'default', used: false }
const listeners = new Set()
function set(patch) {
  const next = { ...state, ...patch }
  if (next.open === state.open && next.pageId === state.pageId) return
  state = next
  listeners.forEach(fn => fn())
  window.dispatchEvent(new CustomEvent('ufq-draw', { detail: { open: state.open } }))
}

// The drawing area is the space between the test header and the bottom bar.
function bounds() {
  const top = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0
  const foot = document.querySelector('footer')?.getBoundingClientRect().top ?? window.innerHeight
  return { top, bottom: foot, left: 0, width: document.documentElement.clientWidth, height: Math.max(0, foot - top) }
}

function App() {
  const s = useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn) }, () => state)
  if (!s.used) return null
  return <div className="ufq-draw"><DrawingCanvas isOpen={s.open} onClose={() => set({ open: false })} pageId={s.pageId} getBounds={bounds} /></div>
}

let mounted = false
function mount() {
  if (mounted) return
  mounted = true
  const host = document.createElement('div')
  document.body.appendChild(host)
  createRoot(host).render(<App />)
}

window.UfqDraw = {
  toggle(pageId) { mount(); set({ used: true, open: !state.open, pageId: String(pageId) }) },
  setPage(pageId) { if (mounted) set({ pageId: String(pageId) }) },
  close() { if (mounted) set({ open: false }) },
  isOpen: () => state.open,
}
