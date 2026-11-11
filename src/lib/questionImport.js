// CSV/JSON question import helpers shared by the question bank and SAT test importers.
export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
export const DIFFICULTIES = ['easy', 'medium', 'hard', 'elite', 'mixing']
export const BATCH = 100
export const MAX_ROWS = 5000

export const TEMPLATE = [
  'question_text,option_a,option_b,option_c,option_d,correct,difficulty,explanation,passage,image_url',
  '"If x + 3 = 7, what is x?",2,3,4,5,C,easy,"Subtract 3 from both sides.",,',
  '"What is the value of 2^3?",6,8,9,12,B,medium,"2 x 2 x 2 = 8",,',
  '"Solve 3x = 12. Write only the number.",,,,,,easy,4,,',
].join('\n')

function detectDelimiter(headerLine) {
  const counts = [',', ';', '\t'].map(d => [d, headerLine.split(d).length])
  counts.sort((a, b) => b[1] - a[1])
  return counts[0][0]
}

// Minimal RFC-4180 style parser: quoted fields, escaped quotes, newlines in quotes.
export function parseCsv(text) {
  const src = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text
  const delim = detectDelimiter(src.split(/\r?\n/)[0] || '')
  const rows = []
  let row = [], cell = '', inQuotes = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') inQuotes = false
      else cell += c
    } else if (c === '"') inQuotes = true
    else if (c === delim) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some(v => v.trim() !== '')) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some(v => v.trim() !== '')) rows.push(row)
  if (rows.length < 2) return []
  const header = rows[0].map(h => h.trim().toLowerCase())
  return rows.slice(1).map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])))
}

function parseCorrect(value, optionCount) {
  const v = String(value ?? '').trim().toUpperCase()
  if (!v) return -1
  const letter = LETTERS.indexOf(v)
  if (letter >= 0) return letter < optionCount ? letter : -1
  const n = parseInt(v, 10)
  if (Number.isInteger(n) && n >= 1 && n <= optionCount) return n - 1
  return -1
}

export function normalizeRow(raw, rowNo, defaultDifficulty, order) {
  const get = k => (raw[k] === undefined || raw[k] === null ? '' : String(raw[k]).trim())
  const text = get('question_text') || get('question')
  if (!text) return { error: `Row ${rowNo}: question_text is empty` }

  let options
  if (Array.isArray(raw.options)) options = raw.options.map(o => String(o).trim())
  else if (get('options')) options = get('options').split('|').map(o => o.trim())
  else options = LETTERS.map(l => get('option_' + l.toLowerCase())).filter(o => o !== '')

  const difficultyRaw = get('difficulty').toLowerCase()
  const difficulty = DIFFICULTIES.includes(difficultyRaw) ? difficultyRaw : defaultDifficulty
  const passage = get('passage')
  const question_text = passage
    ? '<!--PASSAGE_START-->' + passage + '<!--PASSAGE_END-->' + text
    : text

  const base = {
    question_text,
    difficulty,
    image_url: get('image_url'),
    image_file: get('image_file'),
    desmos_text: get('desmos_text'),
    desmos_image_url: get('desmos_image_url'),
    order_index: order,
  }

  const wantsWritten = get('type').toLowerCase() === 'written' || options.length === 0
  if (wantsWritten) {
    const answer = get('correct_answer') || get('explanation')
    if (!answer) return { error: `Row ${rowNo}: written question needs correct_answer (or explanation)` }
    return { row: { ...base, options: [], correct_index: -1, explanation: answer, question_type: 'written' } }
  }

  if (options.length < 2 || options.length > 6) return { error: `Row ${rowNo}: needs 2 to 6 options (found ${options.length})` }
  if (options.some(o => !o)) return { error: `Row ${rowNo}: an option is empty` }
  const correct = parseCorrect(raw.correct ?? raw.correct_index_letter ?? raw.answer, options.length)
  if (correct < 0) return { error: `Row ${rowNo}: "correct" must be a letter A-${LETTERS[options.length - 1]} or a number 1-${options.length}` }
  return { row: { ...base, options, correct_index: correct, explanation: get('explanation'), question_type: 'multiple_choice' } }
}

