// <ufq-math text="..."> for the design pages: question text from the bank (HTML with $latex$) shown as real,
// textbook-style math (KaTeX). Built to public/dc/math.js by vite.math.config.js.
import { renderMath } from './lib/mathHtml'

const ALLOWED = new Set(['P', 'BR', 'DIV', 'SPAN', 'B', 'I', 'EM', 'STRONG', 'U', 'SUB', 'SUP', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'UL', 'OL', 'LI'])

// Rebuild the markup keeping only plain formatting tags and centering; everything else becomes text.
function clean(node, out) {
  for (const child of node.childNodes) {
    if (child.nodeType === 3) { out.appendChild(document.createTextNode(child.nodeValue)); continue }
    if (child.nodeType !== 1) continue
    if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE') continue
    if (!ALLOWED.has(child.tagName)) { clean(child, out); continue }
    const el = document.createElement(child.tagName)
    if (/text-align\s*:\s*center/i.test(child.getAttribute('style') || '') || child.getAttribute('align') === 'center') el.style.textAlign = 'center'
    clean(child, el)
    out.appendChild(el)
  }
}

export function toHtml(raw) {
  let s = String(raw ?? '')
  // a bare LaTeX answer such as \frac{1}{2} without $ signs
  if (!s.includes('$') && /\\(d?frac|sqrt|cdot|pi|le|ge|times)\b/.test(s)) s = '$' + s + '$'
  s = s.replace(/\\\(([\s\S]+?)\\\)/g, '$$$1$$').replace(/\\\[([\s\S]+?)\\\]/g, '$$$1$$').replace(/\$\$([^$]+)\$\$/g, '$$$1$$')
  // "<" and ">" inside math must not be read as tags
  s = s.replace(/\$([^$]+)\$/g, (_, tex) => '$' + tex.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '$')
  if (!/<(p|br|div|table|ul|ol)\b/i.test(s)) s = s.replace(/\n/g, '<br>')
  const doc = new DOMParser().parseFromString('<body>' + s + '</body>', 'text/html')
  const box = document.createElement('div')
  clean(doc.body, box)
  // full-size fractions, as printed in the real test
  return renderMath(box.innerHTML.replace(/\$([^$<]+)\$/g, (_, tex) => '$\\displaystyle ' + tex + '$'))
}

class UfqMath extends HTMLElement {
  static get observedAttributes() { return ['text'] }
  connectedCallback() { this.draw() }
  attributeChangedCallback() { this.draw() }
  draw() {
    const raw = this.getAttribute('text') || ''
    if (raw.startsWith('{{') || raw === this._raw) return
    this._raw = raw
    this.innerHTML = toHtml(raw)
  }
}
if (!customElements.get('ufq-math')) customElements.define('ufq-math', UfqMath)
