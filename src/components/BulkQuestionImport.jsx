import { useState, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useToast } from './Toast'
import { BATCH, MAX_ROWS, TEMPLATE, parseCsv, normalizeRow } from '../lib/questionImport'

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
