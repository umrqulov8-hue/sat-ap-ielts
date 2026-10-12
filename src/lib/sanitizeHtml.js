const ALLOWED_TAGS = new Set([
  'A', 'B', 'BLOCKQUOTE', 'BR', 'CAPTION', 'CODE', 'DD', 'DIV', 'DL', 'DT',
  'EM', 'H1', 'H2', 'H3', 'H4', 'HR', 'I', 'IMG', 'LI', 'MARK', 'OL', 'P',
  'PRE', 'S', 'SMALL', 'SPAN', 'STRONG', 'SUB', 'SUP', 'TABLE', 'TBODY',
  'TD', 'TH', 'THEAD', 'TR', 'U', 'UL',
])
const DROP_CONTENT_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'FORM', 'TEMPLATE'])
const SAFE_STYLE_PROPERTIES = new Set([
  'background-color', 'border-left-color', 'border-left-style', 'border-left-width',
  'color', 'display', 'font-size', 'font-style', 'font-weight', 'height',
  'margin-left', 'margin-right', 'max-width', 'padding-left', 'padding-right',
  'position', 'text-align', 'text-decoration', 'top', 'vertical-align', 'white-space', 'width',
])

function safeUrl(value, allowMailto = false) {
  try {
    const url = new URL(value, window.location.origin)
    if (url.protocol === 'https:' || url.protocol === 'http:' || (allowMailto && url.protocol === 'mailto:')) return value
  } catch {
    if (value.startsWith('/') && !value.startsWith('//')) return value
  }
  return null
}

export function sanitizeHtml(value) {
  if (!value) return ''
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
  }

  const parsed = new DOMParser().parseFromString(String(value), 'text/html')
  const elements = [...parsed.body.querySelectorAll('*')]
  for (const element of elements) {
    if (!element.isConnected) continue
    if (DROP_CONTENT_TAGS.has(element.tagName)) {
      element.remove()
      continue
    }
    if (!ALLOWED_TAGS.has(element.tagName)) {
      element.replaceWith(...element.childNodes)
      continue
    }

    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase()
      if (name === 'class' && /^[a-z0-9 _-]{1,200}$/i.test(attribute.value)) continue
      if (name === 'title' || (element.tagName === 'IMG' && ['alt', 'width', 'height'].includes(name))) continue
      if (name.startsWith('aria-') && /^[a-z0-9_-]+$/i.test(attribute.value)) continue
      if (name === 'style') {
        const safeStyles = []
        for (const declaration of attribute.value.split(';')) {
          const separator = declaration.indexOf(':')
          if (separator < 0) continue
          const property = declaration.slice(0, separator).trim().toLowerCase()
          const value = declaration.slice(separator + 1).trim()
          const safeValue = /^[a-z0-9#.,%()\s+-]+$/i.test(value) && !/(url|expression|javascript|var\s*\()/i.test(value)
          if (!SAFE_STYLE_PROPERTIES.has(property) || !safeValue) continue
          if (property === 'display' && !/^(inline|inline-block|block|table|table-row|table-cell|none)$/i.test(value)) continue
          if (property === 'position' && !/^(static|relative)$/i.test(value)) continue
          safeStyles.push(`${property}: ${value}`)
        }
        if (safeStyles.length) element.setAttribute('style', safeStyles.join('; '))
        else element.removeAttribute(name)
        continue
      }
      if (element.tagName === 'IMG' && name === 'src') {
        const url = safeUrl(attribute.value)
        if (url) element.setAttribute('src', url)
        else element.removeAttribute(name)
        continue
      }
      if (element.tagName === 'A' && name === 'href') {
        const url = safeUrl(attribute.value, true)
        if (url) element.setAttribute('href', url)
        else element.removeAttribute(name)
        continue
      }
      element.removeAttribute(name)
    }
    if (element.tagName === 'IMG') {
      element.setAttribute('loading', 'lazy')
      element.setAttribute('draggable', 'false')
    }
  }
  return parsed.body.innerHTML
}
