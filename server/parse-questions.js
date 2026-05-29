import { readFileSync, writeFileSync } from 'fs'

const jsonPath = process.argv[2]
if (!jsonPath) { console.error('Usage: node server/parse-questions.js <extracted-json>'); process.exit(1) }

const { pages, fullText } = JSON.parse(readFileSync(jsonPath, 'utf8'))

// Try to reconstruct lines with position info for multi-column PDFs
for (const page of pages) {
  // Group items by approximate y-position (same line)
  const lines = {}
  for (const item of page.items) {
    const yKey = Math.round(item.y * 10) / 10
    if (!lines[yKey]) lines[yKey] = []
    lines[yKey].push(item)
  }
  // Sort lines top-to-bottom, items left-to-right within each line
  const sortedY = Object.keys(lines).sort((a, b) => parseFloat(b) - parseFloat(a))
  page.reconstructed = sortedY.map(y => {
    const items = lines[y].sort((a, b) => a.x - b.x)
    return { y: parseFloat(y), text: items.map(i => i.str).join(' '), xMin: items[0].x, xMax: items[items.length - 1].x }
  })
}

// Determine columns by looking at x positions
const allLines = pages.flatMap(p => p.reconstructed)
const xPositions = allLines.map(l => l.xMin).filter(x => x > 20)
const midX = xPositions.reduce((a, b) => a + b, 0) / xPositions.length + 80 // rough column split

const leftCol = allLines.filter(l => l.xMin < midX)
const rightCol = allLines.filter(l => l.xMin >= midX)

function parseTextToQuestions(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const qs = []
  let current = null
  for (const line of lines) {
    const qMatch = line.match(/^(\d+)[.)\s]*(.+)/)
    if (qMatch && parseInt(qMatch[1]) > 0 && parseInt(qMatch[1]) < 200 && qMatch[2].length > 3) {
      if (current && current.options.length >= 2) qs.push(current)
      current = { num: parseInt(qMatch[1]), text: qMatch[2], options: [], correct: -1, explanation: '' }
      continue
    }
    const optMatch = line.match(/^([A-D])[.)]\s*(.*)/)
    if (optMatch && current && optMatch[2].length > 0) {
      current.options.push(optMatch[2])
      continue
    }
    const ansMatch = line.match(/(?:Answer|Correct)[:\s]*([A-D])/i)
    if (ansMatch && current) {
      current.correct = 'ABCD'.indexOf(ansMatch[1].toUpperCase())
      continue
    }
    if (current && !line.match(/^[A-D][.)]/) && !line.match(/^Question\s*\d+/i)) {
      current.text += ' ' + line
    }
  }
  if (current && current.options.length >= 2) qs.push(current)
  return qs.filter(q => q.options.length >= 2)
}

// Try parsing: full text, left column, right column, and combined
const results = {
  fullText: parseTextToQuestions(fullText),
  leftCol: parseTextToQuestions(leftCol.map(l => l.text).join('\n')),
  rightCol: parseTextToQuestions(rightCol.map(l => l.text).join('\n')),
  combined: parseTextToQuestions(leftCol.map(l => l.text).concat(rightCol.map(l => l.text)).join('\n')),
}

console.log('Questions found:')
console.log('  Full text:', results.fullText.length)
console.log('  Left col:', results.leftCol.length)
console.log('  Right col:', results.rightCol.length)
console.log('  Combined:', results.combined.length)

// Pick the best result (most questions)
let best = results.fullText
let bestKey = 'fullText'
for (const key of ['fullText', 'leftCol', 'rightCol', 'combined']) {
  if (results[key].length > best.length) { best = results[key]; bestKey = key }
}

console.log('\nBest result:', bestKey, 'with', best.length, 'questions')
if (best.length > 0) {
  console.log('\nFirst 3 questions:')
  best.slice(0, 3).forEach((q, i) => {
    console.log(`  ${i + 1}. ${q.text.substring(0, 80)}`)
    q.options.forEach((o, j) => console.log(`     ${String.fromCharCode(65 + j)}) ${o.substring(0, 60)}`))
    if (q.correct >= 0) console.log(`     Correct: ${String.fromCharCode(65 + q.correct)}`)
  })
}

writeFileSync(jsonPath.replace('-extracted.json', '') + '-questions.json', JSON.stringify(best, null, 2))
console.log('\nSaved to', jsonPath.replace('-extracted.json', '') + '-questions.json')
