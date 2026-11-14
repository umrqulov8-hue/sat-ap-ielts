import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useLayout } from '../components/DashLayout'
import { useUser } from '../context/UserContext'

export default function SatTestList() {
  const { setPageTitle, setPageSub, setPageClass } = useLayout()
  const navigate = useNavigate()
  const [tests, setTests] = useState([])
  const [loading, setLoading] = useState(true)
  const { isAdmin, profileLoading } = useUser()

  useEffect(() => {
    setPageTitle('TOʻLIQ SAT TESTLAR')
    setPageSub('Toʻliq SAT amaliy imtihonlarini topshiring')
    setPageClass('')
    if (profileLoading) return
    // Students only see tests that really contain questions; admins also see empty drafts.
    let query = supabase.from('sat_tests').select('*').order('created_at', { ascending: false })
    if (!isAdmin) query = query.gt('total_questions', 0)
    query.then(({ data, error }) => {
      if (error) console.error('Could not load SAT tests:', error)
      setTests(data || [])
      setLoading(false)
    })
  }, [setPageTitle, setPageSub, setPageClass, isAdmin, profileLoading])

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
              <span className="sat-list-meta">{t.total_questions > 0 ? `${t.total_questions} questions` : 'Draft (no questions yet)'}</span>
            </div>
            <button className="btn btn-primary" onClick={() => navigate('/sat-test/' + t.id)}>START</button>
          </div>
        ))
      )}
    </div>
  )
}
