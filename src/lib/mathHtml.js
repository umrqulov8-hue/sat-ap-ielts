import katex from 'katex'

const ENTITIES = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' }
const decode = s => s.replace(/&(lt|gt|amp|quot|#39|nbsp);/g, m => ENTITIES[m])

// Matches $...$ (an escaped \$ is a literal dollar sign and never opens/closes math).
const MATH = /(?<!\\)\$([^$<]+?)(?<!\\)\$/g

/**
 * Turn $latex$ segments of an ALREADY SAFE html string into KaTeX markup.
 * Call it on the output of sanitizeHtml()/escapeHTML(), never on raw input:
 * KaTeX output is trusted (throwOnError:false, trust:false), the surrounding
 * text is not.
 */
export function renderMath(safeHtml) {
  if (!safeHtml || typeof safeHtml !== 'string' || !safeHtml.includes('$')) return safeHtml || ''
  return safeHtml
    .replace(MATH, (whole, tex) => {
      try {
        return katex.renderToString(decode(tex).trim(), { throwOnError: false, output: 'html', trust: false, strict: 'ignore' })
      } catch {
        return whole
      }
    })
    .replace(/\\\$/g, '$')
}
