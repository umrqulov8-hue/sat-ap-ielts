import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useLayout } from '../components/DashLayout'
import { useToast } from '../components/Toast'
import * as pdfjsLib from 'pdfjs-dist'
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker'

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfjsWorker()

const MODULE_DEFS = [
  { name: 'Reading & Writing Module 1', section: 'rw', num: 1, count: 27 },
  { name: 'Reading & Writing Module 2', section: 'rw', num: 2, count: 27 },
  { name: 'Math Module 1', section: 'math', num: 1, count: 22 },
  { name: 'Math Module 2', section: 'math', num: 2, count: 22 },
]

export default function SatTestAdmin() {
  const { setPageTitle, setPageSub, setPageClass } = useLayout()
  const navigate = useNavigate()
  const toast = useToast()
  const [tab, setTab] = useState('list')
  const [tests, setTests] = useState([])
  const [subjects, setSubjects] = useState([])
  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [pdfFile, setPdfFile] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState(null)
  const [moduleQs, setModuleQs] = useState({})
  const [rawText, setRawText] = useState('')

  useEffect(() => {
    setPageTitle('SAT TESTS')
    setPageSub('Import and manage full SAT practice tests')
    setPageClass('sat-test-admin')
    supabase.from('subjects').select('*').order('order_index').then(({ data }) => {
      if (data?.length) { setSubjects(data); setSubjectId(data[0].id) }
    })
    loadTests()
  }, [])

  const loadTests = async () => {
    const { data } = await supabase.from('sat_tests').select('*').order('created_at', { ascending: false })
    if (data) setTests(data)
  }

  const handleUploadPdf = async () => {
    if (!pdfFile || !title.trim() || !subjectId) { toast.error('Fill all fields'); return }
    setParsing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const uid = session?.user?.id
      if (!uid) { toast.error('Not authenticated'); setParsing(false); return }
      const ext = pdfFile.name.split('.').pop()
      const pdfPath = uid + '/sat-tests/' + Date.now() + '.' + ext
      const { error: upErr } = await supabase.storage.from('avav2').upload(pdfPath, pdfFile, { upsert: true })
      if (upErr) { toast.error('Upload error: ' + upErr.message); setParsing(false); return }
      const { data: { publicUrl } } = supabase.storage.from('avav2').getPublicUrl(pdfPath)

      const buffer = await pdfFile.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: buffer, isEvalSupported: false }).promise
      let allText = []
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        const text = content.items.map(item => item.str).join(' ')
        allText.push({ page: i, text })
      }
      const fullText = allText.map(p => p.text).join('\n\n')
      setRawText(fullText)
      const questions = parseQuestions(fullText)
      if (questions.length < 10) {
        toast.warning('Only ' + questions.length + ' questions parsed. Check the RAW TEXT tab below and adjust.')
      }
      setParsed({ pdfUrl: publicUrl, questions, rawText: fullText })
      const perModule = Math.ceil(Math.max(questions.length, 1) / 4)
      setModuleQs({ 0: questions.slice(0, perModule), 1: questions.slice(perModule, perModule * 2), 2: questions.slice(perModule * 2, perModule * 3), 3: questions.slice(perModule * 3) })
      toast.success(questions.length + ' questions parsed!')
    } catch (e) { toast.error('Parse error: ' + e.message) }
    setParsing(false)
  }

  const parseQuestions = (text) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const qs = []
    let current = null
    for (const line of lines) {
      const qMatch = line.match(/^(?:\d+[.)]?\s{0,3})(.+)/)
      if (qMatch && !line.match(/^[A-D][.)]/) && qMatch[1].length > 5) {
        if (current && current.options.length >= 2) qs.push(current)
        current = { text: qMatch[1], options: [], correct: -1, explanation: '' }
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
      const expMatch = line.match(/^Explanation[:\s]*(.+)/i)
      if (expMatch && current) {
        current.explanation = expMatch[1]
        continue
      }
      if (current && !line.match(/^[A-D][.)]/) && !line.match(/^Question\s*\d+/i)) {
        current.text += ' ' + line
      }
    }
    if (current && current.options.length >= 2) qs.push(current)
    return qs.filter(q => q.text.length > 5 && q.options.length >= 2)
  }

  const updateQ = (modIdx, qIdx, field, val) => {
    setModuleQs(prev => {
      const next = { ...prev }
      const mod = [...next[modIdx]]
      mod[qIdx] = { ...mod[qIdx], [field]: val }
      next[modIdx] = mod
      return next
    })
  }

  const moveQ = (fromMod, fromIdx, toMod, toIdx) => {
    setModuleQs(prev => {
      const next = { ...prev }
      const src = [...next[fromMod]]
      const dst = [...next[toMod]]
      const [item] = src.splice(fromIdx, 1)
      dst.splice(toIdx, 0, item)
      next[fromMod] = src
      next[toMod] = dst
      return next
    })
  }

  const importTest = async () => {
    if (!parsed) return
    setParsing(true)
    try {
      const { data: testRes, error: testErr } = await supabase.from('sat_tests').insert({
        title: title.trim(), subject_id: subjectId, pdf_url: parsed.pdfUrl,
      }).select('id').single()
      if (testErr) { toast.error('Error creating test: ' + testErr.message); setParsing(false); return }
      const testId = testRes.id

      for (let mi = 0; mi < MODULE_DEFS.length; mi++) {
        const def = MODULE_DEFS[mi]
        const qs = moduleQs[mi] || []
        const { data: modRes, error: modErr } = await supabase.from('sat_modules').insert({
          test_id: testId, name: def.name, section: def.section, module_number: def.num,
          question_count: qs.length, order_index: mi,
        }).select('id').single()
        if (modErr) { toast.error('Error creating module: ' + modErr.message); setParsing(false); return }
        const moduleId = modRes.id

        for (let qi = 0; qi < qs.length; qi++) {
          const q = qs[qi]
          const { error: qErr } = await supabase.from('sat_questions').insert({
            module_id: moduleId, question_number: qi + 1,
            question_text: q.text,
            options: q.options.length >= 2 ? q.options : ['A', 'B', 'C', 'D'],
            correct_index: q.correct >= 0 ? q.correct : 0,
            explanation: q.explanation || '',
          })
          if (qErr) { toast.error('Error saving Q' + (qi + 1) + ': ' + qErr.message); setParsing(false); return }
        }
      }
      toast.success('Test imported! ' + MODULE_DEFS.reduce((a, m, i) => a + (moduleQs[i]?.length || 0), 0) + ' questions')
      setParsed(null); setPdfFile(null); setTitle(''); setModuleQs({}); setTab('list')
      loadTests()
    } catch (e) { toast.error('Import error: ' + e.message) }
    setParsing(false)
  }

  const deleteTest = async (id) => {
    if (!window.confirm('Delete this test permanently?')) return
    const { error } = await supabase.from('sat_tests').delete().eq('id', id)
    if (error) { toast.error('Delete error'); return }
    toast.success('Deleted')
    loadTests()
  }

  return (
    <div className="sat-admin-wrap">
      <div className="admin-tabs">
        <button className={'admin-tab' + (tab === 'list' ? ' active' : '')} onClick={() => setTab('list')}>ALL TESTS</button>
        <button className={'admin-tab' + (tab === 'import' ? ' active' : '')} onClick={() => setTab('import')}>IMPORT NEW</button>
      </div>

      {tab === 'list' && (
        <div className="sat-list">
          {tests.length === 0 ? <p style={{ color: '#888' }}>No SAT tests imported yet.</p> : (
            tests.map(t => (
              <div key={t.id} className="sat-list-row">
                <div className="sat-list-left">
                  <span className="sat-list-title">{t.title}</span>
                  <span className="sat-list-meta">{t.total_questions} questions</span>
                </div>
                <div className="sat-list-right">
                  <button className="btn btn-primary" onClick={() => navigate('/sat-test/' + t.id)}>START TEST</button>
                  <button className="sat-del-btn" onClick={() => deleteTest(t.id)}>DEL</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'import' && (
        <div className="sat-import">
          <div className="admin-layer">
            <label className="admin-label">TEST TITLE</label>
            <input className="admin-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. March 2024 SAT" />
          </div>
          <div className="admin-layer">
            <label className="admin-label">SUBJECT</label>
            <select className="admin-select" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>
          <div className="admin-layer">
            <label className="admin-label">PDF FILE</label>
            <input type="file" accept=".pdf" onChange={e => setPdfFile(e.target.files[0])} />
          </div>
          <button className="btn btn-primary" onClick={handleUploadPdf} disabled={parsing}>
            {parsing ? 'PARSING...' : 'UPLOAD & PARSE'}
          </button>

          {parsed && (
            <div className="sat-preview">
              <h3>Preview — Adjust Questions Before Import</h3>
              <p className="sat-preview-hint">Drag questions between modules or edit text. Click SAVE when ready.</p>

              {parsed.rawText && (
                <details style={{ marginBottom: '1rem' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '0.7rem' }}>📄 RAW TEXT EXTRACTED ({parsed.rawText.length} chars)</summary>
                  <textarea className="admin-input" rows={10} style={{ marginTop: '0.5rem', fontFamily: 'monospace', fontSize: '0.65rem', whiteSpace: 'pre-wrap' }}
                    value={parsed.rawText} onChange={e => setParsed({ ...parsed, rawText: e.target.value })} />
                </details>
              )}

              {MODULE_DEFS.map((def, mi) => {
                const qs = moduleQs[mi] || []
                return (
                  <div key={mi} className="sat-module-preview">
                    <div className="sat-module-header">{def.name} <span className="sat-module-count">{qs.length} Q</span></div>
                    {qs.length === 0 && <div className="admin-empty">No questions</div>}
                    {qs.map((q, qi) => (
                      <div key={qi} className="sat-preview-q">
                        <div className="sat-preview-q-top">
                          <span className="sat-preview-q-num">{qi + 1}.</span>
                          <textarea className="sat-preview-q-text" rows={2} value={q.text} onChange={e => updateQ(mi, qi, 'text', e.target.value)} />
                        </div>
                        <div className="sat-preview-options">
                          {q.options.map((opt, oi) => (
                            <div key={oi} className="sat-preview-opt-row">
                              <span className="sat-preview-opt-letter">{String.fromCharCode(65 + oi)}</span>
                              <input className="admin-input" value={opt} onChange={e => {
                                const opts = [...q.options]; opts[oi] = e.target.value; updateQ(mi, qi, 'options', opts)
                              }} />
                              <input type="radio" name={'c-' + mi + '-' + qi} checked={q.correct === oi} onChange={() => updateQ(mi, qi, 'correct', oi)} />
                            </div>
                          ))}
                        </div>
                        <div className="sat-preview-explanation">
                          <input className="admin-input" placeholder="Explanation" value={q.explanation} onChange={e => updateQ(mi, qi, 'explanation', e.target.value)} />
                        </div>
                        <div className="sat-preview-move">
                          {mi > 0 && <button className="sat-move-btn" onClick={() => moveQ(mi, qi, mi - 1, (moduleQs[mi - 1] || []).length)}>▲ Move to {def.name}</button>}
                          {mi < 3 && <button className="sat-move-btn" onClick={() => moveQ(mi, qi, mi + 1, (moduleQs[mi + 1] || []).length)}>▼ Move to {MODULE_DEFS[mi + 1].name}</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}

              <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={importTest} disabled={parsing}>
                {parsing ? 'IMPORTING...' : 'IMPORT ALL (' + MODULE_DEFS.reduce((a, _, i) => a + (moduleQs[i]?.length || 0), 0) + ' QUESTIONS)'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
