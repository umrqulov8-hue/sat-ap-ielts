import { useState, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useToast } from './Toast'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
const DIFFICULTIES = ['easy', 'medium', 'hard', 'elite', 'mixing']
const BATCH = 100
const MAX_ROWS = 5000

const TEMPLATE = [
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
function parseCsv(text) {
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

function normalizeRow(raw, rowNo, defaultDifficulty, order) {
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

export default function BulkQuestionImport({ subjectId, subjectTitle, startOrder, defaultDifficulty, onDone }) {
  const toast = useToast()
  const fileRef = useRef(null)
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = 'questions-template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const handleFile = async e => {
    const file = e.target.files[0]
    setParsed(null)
    if (!file) return
    setFileName(file.name)
    try {
      const text = await file.text()
      let records
      if (file.name.toLowerCase().endsWith('.json')) {
        const json = JSON.parse(text)
        records = Array.isArray(json) ? json : json.questions
        if (!Array.isArray(records)) throw new Error('JSON must be an array of questions')
      } else {
        records = parseCsv(text)
      }
      if (records.length === 0) throw new Error('No rows found in file')
      if (records.length > MAX_ROWS) throw new Error(`Too many rows (${records.length}). Max ${MAX_ROWS} per file.`)
      const rows = [], errors = []
      records.forEach((raw, i) => {
        const res = normalizeRow(raw, i + 2, defaultDifficulty, startOrder + rows.length)
        if (res.error) errors.push(res.error)
        else rows.push(res.row)
      })
      setParsed({ rows, errors })
    } catch (err) {
      setParsed({ rows: [], errors: [err.message] })
    }
  }

  const handleImport = async () => {
    if (!parsed?.rows.length || !subjectId) return
    setBusy(true); setProgress(0)
    let done = 0
    for (let i = 0; i < parsed.rows.length; i += BATCH) {
      const chunk = parsed.rows.slice(i, i + BATCH).map(r => ({ ...r, subject_id: subjectId }))
      const { error } = await supabase.from('questions').insert(chunk)
      if (error) {
        toast.error(`Stopped at rows ${i + 1}-${i + chunk.length}: ${error.message}. ${done} saved.`)
        setBusy(false)
        if (done > 0) onDone?.()
        return
      }
      done += chunk.length
      setProgress(done)
    }
    toast.success(`${done} questions imported`)
    setBusy(false); setParsed(null); setFileName('')
    if (fileRef.current) fileRef.current.value = ''
    onDone?.()
  }

  return (
    <div className="admin-layer">
      <label className="admin-label">BULK IMPORT (CSV / JSON) — {subjectTitle || 'select subject'}</label>
      <p style={{ fontSize: 13, margin: '4px 0 10px', lineHeight: 1.5 }}>
        Columns: <b>question_text</b>, option_a … option_f, <b>correct</b> (A-F), difficulty, explanation, passage, image_url.
        Leave options empty for a written question and put the answer in <b>correct_answer</b>. Up to {MAX_ROWS} rows per file.
        Images: upload them one by one in the Questions tab, or paste an existing image_url.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <button type="button" className="btn-solid-black" style={{ background: 'transparent', color: '#000' }} onClick={downloadTemplate}>
          DOWNLOAD CSV TEMPLATE
        </button>
        <input ref={fileRef} type="file" accept=".csv,.json,text/csv,application/json" onChange={handleFile} disabled={busy} />
      </div>

      {parsed && (
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          <div><b>{fileName}</b>: {parsed.rows.length} valid, {parsed.errors.length} with errors</div>
          {parsed.errors.length > 0 && (
            <ul style={{ color: '#b00020', maxHeight: 160, overflow: 'auto', paddingLeft: 18, margin: '6px 0' }}>
              {parsed.errors.slice(0, 50).map((er, i) => <li key={i}>{er}</li>)}
              {parsed.errors.length > 50 && <li>…and {parsed.errors.length - 50} more</li>}
            </ul>
          )}
          {parsed.rows.length > 0 && (
            <button type="button" className="btn-solid-black" disabled={busy} onClick={handleImport}>
              {busy ? `IMPORTING ${progress}/${parsed.rows.length}…` : `IMPORT ${parsed.rows.length} QUESTIONS${parsed.errors.length ? ' (skip errors)' : ''}`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
