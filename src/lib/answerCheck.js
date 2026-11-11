// Grading for student-produced (written / grid-in) answers.
// The stored key may list alternatives: "87/2 or 43.5".

function toNumber(raw) {
  const s = String(raw ?? '').trim().replace(/[$,\s]/g, '').replace(/^\+/, '')
  if (!s) return NaN
  const frac = s.match(/^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/)
  if (frac) return Number(frac[2]) === 0 ? NaN : Number(frac[1]) / Number(frac[2])
  if (/^-?\d*\.?\d+$/.test(s)) return Number(s)
  return NaN
}

export function isWrittenAnswerCorrect(input, key) {
  const given = String(input ?? '').trim()
  if (!given) return false
  const candidates = String(key ?? '').split(/\s+or\s+/i).map(s => s.trim()).filter(Boolean)
  const g = toNumber(given)
  for (const cand of candidates) {
    if (given.toLowerCase() === cand.toLowerCase()) return true
    const c = toNumber(cand)
    if (Number.isNaN(g) || Number.isNaN(c)) continue
    if (Math.abs(g - c) <= 1e-9 * Math.max(1, Math.abs(c))) return true
    // A fraction key (e.g. 145/12) also accepts its decimal rounded to 2-3 places, as SAT grid-ins do.
    if (cand.includes('/') && /^-?\d*\.\d{2,3}$/.test(given.replace(/,/g, '')) && Math.abs(g - c) <= 0.0051) return true
  }
  return false
}
