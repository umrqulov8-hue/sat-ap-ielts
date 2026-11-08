import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useLayout } from '../components/DashLayout'
import { useToast } from '../components/Toast'
import { useUser } from '../context/UserContext'
import { parseCsv, normalizeRow, LETTERS } from '../lib/questionImport'

export default function SatTestAdmin() {
  const { setPageTitle, setPageSub, setPageClass } = useLayout()
  const { isAdmin, isOwner, profileLoading } = useUser()
  const navigate = useNavigate()
  const toast = useToast()
  const [tests, setTests] = useState([])
  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [subjects, setSubjects] = useState([])
  const [busy, setBusy] = useState(false)
  const [openTest, setOpenTest] = useState(null)
  const [modulesByTest, setModulesByTest] = useState({})

  const loadTests = useCallback(async () => {
    const { data } = await supabase.from('sat_tests').select('*').order('created_at', { ascending: false })
    if (data) setTests(data)
  }, [])

  useEffect(() => {
    setPageTitle('TEST ADMIN')
    setPageSub('Manage full SAT practice tests')
    setPageClass('sat-test-admin')

    supabase.from('subjects').select('*').order('order_index').then(({ data }) => {
      if (data?.length) {
        setSubjects(data)
        setSubjectId(data[0].id)
      }
    })

    loadTests()
  }, [setPageTitle, setPageSub, setPageClass, loadTests])

  const createTest = async () => {
    if (!title.trim() || !subjectId) {
      toast.error('Fill all fields')
      return
    }
    setBusy(true)
    const { data, error } = await supabase.from('sat_tests').insert({
      title: title.trim(),
      subject_id: subjectId,
    }).select('id').single()

    if (error || !data?.id) {
      setBusy(false)
      toast.error('Error: ' + (error?.message || 'Test was not created'))
      return
    }

    const defs = [
      { name: 'Reading & Writing Module 1', section: 'rw', module_number: 1, question_count: 0, order_index: 0, test_id: data.id },
      { name: 'Reading & Writing Module 2', section: 'rw', module_number: 2, question_count: 0, order_index: 1, test_id: data.id },
      { name: 'Math Module 1', section: 'math', module_number: 1, question_count: 0, order_index: 2, test_id: data.id },
      { name: 'Math Module 2', section: 'math', module_number: 2, question_count: 0, order_index: 3, test_id: data.id },
    ]

    const { data: mods, error: modErr } = await supabase.from('sat_modules').insert(defs).select('id')
    if (modErr || mods?.length !== defs.length) {
      // Do not leave a test without modules behind: roll the test back and say so.
      await supabase.from('sat_tests').delete().eq('id', data.id).allowEmpty()
      setBusy(false)
      toast.error('Test was NOT created: ' + (modErr?.message || 'modules could not be saved'))
      return
    }
    setBusy(false)
    toast.success('Test created with 4 modules. Now import questions into each module.')
    setTitle('')
    await loadTests()
    setOpenTest(data.id)
  }

  const deleteTest = async (id) => {
    if (!window.confirm('Delete this test and all its questions?')) return
    const { error } = await supabase.from('sat_tests').delete().eq('id', id)
    if (error) {
      toast.error('Delete error: ' + error.message)
      return
    }
    toast.success('Deleted')
    if (openTest === id) setOpenTest(null)
    loadTests()
  }

  // Recount questions and keep sat_modules.question_count / sat_tests.total_questions truthful.
  const refreshCounts = async (testId) => {
    const { data: mods, error } = await supabase.from('sat_modules').select('*').eq('test_id', testId).order('order_index')
    if (error) { toast.error('Could not load modules: ' + error.message); return }
    let total = 0
    const next = []
    for (const m of mods || []) {
      const { count } = await supabase.from('sat_questions').select('id', { count: 'exact', head: true }).eq('module_id', m.id)
      const n = count || 0
      total += n
      if (n !== m.question_count) await supabase.from('sat_modules').update({ question_count: n }).eq('id', m.id).allowEmpty()
      next.push({ ...m, question_count: n })
    }
    await supabase.from('sat_tests').update({ total_questions: total }).eq('id', testId).allowEmpty()
    setModulesByTest(prev => ({ ...prev, [testId]: next }))
    setTests(prev => prev.map(t => (t.id === testId ? { ...t, total_questions: total } : t)))
  }

  const toggleTest = async (id) => {
    if (openTest === id) { setOpenTest(null); return }
    setOpenTest(id)
    await refreshCounts(id)
  }

  const importIntoModule = async (testId, mod, file) => {
    if (!file) return
    setBusy(true)
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
      if (!records.length) throw new Error('No rows found in file')

      const { count: existing } = await supabase.from('sat_questions').select('id', { count: 'exact', head: true }).eq('module_id', mod.id)
      const rows = []
      const errors = []
      records.forEach((raw, i) => {
        const res = normalizeRow(raw, i + 2, 'medium', 0)
        if (res.error) { errors.push(res.error); return }
        if (res.row.correct_index < 0) { errors.push(`Row ${i + 2}: SAT modules need multiple-choice questions (A-${LETTERS[3]})`); return }
        rows.push({
          module_id: mod.id,
          question_number: (existing || 0) + rows.length + 1,
          question_text: res.row.question_text,
          options: res.row.options,
          correct_index: res.row.correct_index,
          explanation: res.row.explanation || '',
          image_url: res.row.image_url || '',
        })
      })
      if (errors.length) {
        toast.error(`${errors.length} row(s) invalid, nothing imported. First problem: ${errors[0]}`)
        return
      }
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await supabase.from('sat_questions').insert(rows.slice(i, i + 100))
        if (error) throw new Error(`Stopped at rows ${i + 1}-${Math.min(i + 100, rows.length)}: ${error.message}`)
      }
      toast.success(`${rows.length} questions imported into ${mod.name}`)
      await refreshCounts(testId)
    } catch (err) {
      toast.error('Import failed: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  const clearModule = async (testId, mod) => {
    if (!window.confirm(`Remove all questions from "${mod.name}"?`)) return
    const { error } = await supabase.from('sat_questions').delete().eq('module_id', mod.id).allowEmpty()
    if (error) { toast.error('Delete error: ' + error.message); return }
    toast.success('Module emptied')
    await refreshCounts(testId)
  }

  if (profileLoading) {
    return <div className="page-loading" />
  }

  if (!isAdmin && !isOwner) {
    return (
      <div className="admin-no-access" style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
        <h2>Kirish cheklangan</h2>
        <p>Sizda admin huquqlari mavjud emas.</p>
      </div>
    )
  }

  return (
    <div className="sat-admin-wrap">
      <div className="admin-layer">
        <label className="admin-label">CREATE NEW TEST</label>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="admin-input"
            style={{ flex: 1, minWidth: '200px' }}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. March 2024 SAT"
          />
          <select className="admin-select" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
          <button className="btn btn-primary" onClick={createTest} disabled={busy}>CREATE</button>
        </div>
      </div>

      <div className="sat-list" style={{ marginTop: '1.5rem' }}>
        {tests.length === 0 ? (
          <p style={{ color: '#888' }}>No SAT tests yet.</p>
        ) : (
          tests.map(t => (
            <div key={t.id} className="sat-list-block">
              <div className="sat-list-row">
                <div className="sat-list-left">
                  <span className="sat-list-title">{t.title}</span>
                  <span className="sat-list-meta">
                    {t.total_questions > 0 ? `${t.total_questions} questions` : 'EMPTY — hidden from students until questions are imported'}
                  </span>
                </div>
                <div className="sat-list-right">
                  <button className="btn btn-primary" onClick={() => toggleTest(t.id)}>{openTest === t.id ? 'CLOSE' : 'QUESTIONS'}</button>
                  <button className="btn btn-primary" onClick={() => navigate('/sat-test/' + t.id)} disabled={!(t.total_questions > 0)}>START</button>
                  <button className="sat-del-btn" onClick={() => deleteTest(t.id)}>DEL</button>
                </div>
              </div>
              {openTest === t.id && (
                <div className="admin-layer" style={{ marginTop: '0.5rem' }}>
                  <p style={{ fontSize: 13, margin: '0 0 8px', lineHeight: 1.5 }}>
                    CSV/JSON columns: <b>question_text</b>, option_a … option_f, <b>correct</b> (A-F), explanation, passage, image_url.
                  </p>
                  {(modulesByTest[t.id] || []).map(m => (
                    <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '6px 0', borderTop: '1px solid #ddd' }}>
                      <b style={{ minWidth: 220 }}>{m.name}</b>
                      <span>{m.question_count} questions</span>
                      <input type="file" accept=".csv,.json,text/csv,application/json" disabled={busy}
                        onChange={e => { importIntoModule(t.id, m, e.target.files[0]); e.target.value = '' }} />
                      {m.question_count > 0 && <button className="sat-del-btn" disabled={busy} onClick={() => clearModule(t.id, m)}>EMPTY</button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
