import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useLayout } from '../components/DashLayout'
import { useToast } from '../components/Toast'

export default function SatTestAdmin() {
  const { setPageTitle, setPageSub, setPageClass } = useLayout()
  const navigate = useNavigate()
  const toast = useToast()
  const [tests, setTests] = useState([])
  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [subjects, setSubjects] = useState([])

  useEffect(() => {
    setPageTitle('TEST ADMIN')
    setPageSub('Manage full SAT practice tests')
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

  const createTest = async () => {
    if (!title.trim() || !subjectId) { toast.error('Fill all fields'); return }
    const { data, error } = await supabase.from('sat_tests').insert({
      title: title.trim(), subject_id: subjectId,
    }).select('id').single()
    if (error) { toast.error('Error: ' + error.message); return }
    const defs = [
      { name: 'Reading & Writing Module 1', section: 'rw', num: 1, count: 27 },
      { name: 'Reading & Writing Module 2', section: 'rw', num: 2, count: 27 },
      { name: 'Math Module 1', section: 'math', num: 1, count: 22 },
      { name: 'Math Module 2', section: 'math', num: 2, count: 22 },
    ]
    for (let i = 0; i < defs.length; i++) {
      await supabase.from('sat_modules').insert({
        test_id: data.id, name: defs[i].name, section: defs[i].section,
        module_number: defs[i].num, question_count: defs[i].count, order_index: i,
      })
    }
    toast.success('Test created with 4 empty modules')
    setTitle('')
    loadTests()
  }

  const deleteTest = async (id) => {
    if (!window.confirm('Delete this test and all its questions?')) return
    const { error } = await supabase.from('sat_tests').delete().eq('id', id)
    if (error) { toast.error('Delete error'); return }
    toast.success('Deleted')
    loadTests()
  }

  return (
    <div className="sat-admin-wrap">
      <div className="admin-layer">
        <label className="admin-label">CREATE NEW TEST</label>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="admin-input" style={{ flex: 1, minWidth: '200px' }} value={title}
            onChange={e => setTitle(e.target.value)} placeholder="e.g. March 2024 SAT" />
          <select className="admin-select" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
          <button className="btn btn-primary" onClick={createTest}>CREATE</button>
        </div>
      </div>

      <div className="sat-list" style={{ marginTop: '1.5rem' }}>
        {tests.length === 0 ? <p style={{ color: '#888' }}>No SAT tests yet.</p> : (
          tests.map(t => (
            <div key={t.id} className="sat-list-row">
              <div className="sat-list-left">
                <span className="sat-list-title">{t.title}</span>
                <span className="sat-list-meta">4 modules</span>
              </div>
              <div className="sat-list-right">
                <button className="btn btn-primary" onClick={() => navigate('/sat-test/' + t.id)}>START</button>
                <button className="sat-del-btn" onClick={() => deleteTest(t.id)}>DEL</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
