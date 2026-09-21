import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useLayout } from '../components/DashLayout'
import { useToast } from '../components/Toast'
import { useUser } from '../context/UserContext'

export default function SatTestAdmin() {
  const { setPageTitle, setPageSub, setPageClass } = useLayout()
  const { isAdmin, isOwner, profileLoading } = useUser()
  const navigate = useNavigate()
  const toast = useToast()
  const [tests, setTests] = useState([])
  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [subjects, setSubjects] = useState([])

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
    const { data, error } = await supabase.from('sat_tests').insert({
      title: title.trim(),
      subject_id: subjectId,
    }).select('id').single()

    if (error) {
      toast.error('Error: ' + error.message)
      return
    }

    const defs = [
      { name: 'Reading & Writing Module 1', section: 'rw', module_number: 1, question_count: 27, order_index: 0, test_id: data.id },
      { name: 'Reading & Writing Module 2', section: 'rw', module_number: 2, question_count: 27, order_index: 1, test_id: data.id },
      { name: 'Math Module 1', section: 'math', module_number: 1, question_count: 22, order_index: 2, test_id: data.id },
      { name: 'Math Module 2', section: 'math', module_number: 2, question_count: 22, order_index: 3, test_id: data.id },
    ]

    await supabase.from('sat_modules').insert(defs)
    toast.success('Test created with 4 empty modules')
    setTitle('')
    loadTests()
  }

  const deleteTest = async (id) => {
    if (!window.confirm('Delete this test and all its questions?')) return
    const { error } = await supabase.from('sat_tests').delete().eq('id', id)
    if (error) {
      toast.error('Delete error: ' + error.message)
      return
    }
    toast.success('Deleted')
    loadTests()
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
          <button className="btn btn-primary" onClick={createTest}>CREATE</button>
        </div>
      </div>

      <div className="sat-list" style={{ marginTop: '1.5rem' }}>
        {tests.length === 0 ? (
          <p style={{ color: '#888' }}>No SAT tests yet.</p>
        ) : (
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
