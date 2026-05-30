import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useLayout } from '../components/DashLayout'

export default function SatTestList() {
  const { setPageTitle, setPageSub, setPageClass } = useLayout()
  const navigate = useNavigate()
  const [tests, setTests] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setPageTitle('FULL SAT TESTS')
    setPageSub('Take complete SAT practice exams')
    setPageClass('')
    supabase.from('sat_tests').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      if (data) setTests(data)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="page-loading" />

  return (
    <div className="sat-list-page">
      {tests.length === 0 ? (
        <div className="admin-empty">No SAT tests available yet.</div>
      ) : (
        tests.map(t => (
          <div key={t.id} className="sat-list-row">
            <div className="sat-list-left">
              <span className="sat-list-title">{t.title}</span>
              <span className="sat-list-meta">{t.total_questions || '4 modules'}</span>
            </div>
            <button className="btn btn-primary" onClick={() => navigate('/sat-test/' + t.id)}>START</button>
          </div>
        ))
      )}
    </div>
  )
}
