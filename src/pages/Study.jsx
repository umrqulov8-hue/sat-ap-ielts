import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLayout } from '../components/DashLayout'
import { supabase } from '../lib/supabaseClient'

export default function Study() {
  const navigate = useNavigate()
  const { setPageTitle, setPageSub, setPageClass } = useLayout()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setPageTitle('STUDY')
    setPageSub('Video lessons')
    setPageClass('')
    ;(async () => {
      const [subRes, vidRes] = await Promise.all([
        supabase.from('subjects').select('*').order('order_index'),
        supabase.from('videos').select('id, subject_id'),
      ])
      const countBySubject = {}
      for (const v of vidRes.data || []) {
        if (v.subject_id) countBySubject[v.subject_id] = (countBySubject[v.subject_id] || 0) + 1
      }
      
      const activeSubjects = (subRes.data || []).filter(s => s.is_active !== false)
      setGroups(activeSubjects.map(s => ({ subject: s, totalVideos: countBySubject[s.id] || 0 })))
      setLoading(false)
    })()
  }, [setPageTitle, setPageSub, setPageClass])

  if (loading) return null

  const totalVideos = groups.reduce((n, g) => n + g.totalVideos, 0)

  return (
    <>
      {groups.length === 0 ? (
        <div className="topics-list">
          <div className="topic-row shadow-wrap"><div className="shadow-box" />
            <div className="topic-inner">
              <div className="topic-left">
                <div>
                  <div className="topic-name">No lessons yet</div>
                  <div className="topic-desc">Videos will appear here soon</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="study-grid study-grid-5">
            {groups.map((g, gi) => (
              <div key={g.subject.id} className="study-card shadow-wrap" onClick={() => navigate('/study/subject/' + g.subject.id)}>
                <div className="shadow-box" />
                <div className="study-card-inner" style={{ '--sc': g.subject.color || '#000' }}>
                  <span className="study-card-num">{(gi + 1).toString().padStart(2, '0')}</span>
                  <div className="study-card-name">{g.subject.title.toUpperCase()}</div>
                  <div className="study-card-count">{g.totalVideos} video{g.totalVideos !== 1 ? 's' : ''}</div>
                  <button className="btn-module study-card-btn" onClick={(e) => { e.stopPropagation(); navigate('/study/subject/' + g.subject.id) }}>OPEN</button>
                </div>
              </div>
            ))}
          </div>
          <div className="study-info-grid">
            <div className="study-info-card shadow-wrap">
              <div className="shadow-box" />
              <div className="study-info-inner">
                <div className="study-info-title">HOW STUDY WORKS</div>
                <div className="study-steps">
                  <div className="study-step"><span className="study-step-num">01</span><div><div className="study-step-name">Choose a track</div><div className="study-step-desc">Pick one of the {groups.length} math tracks above</div></div></div>
                  <div className="study-step"><span className="study-step-num">02</span><div><div className="study-step-name">Watch lessons</div><div className="study-step-desc">Open videos and learn at your pace</div></div></div>
                  <div className="study-step"><span className="study-step-num">03</span><div><div className="study-step-name">Take the test</div><div className="study-step-desc">Each lesson links to its practice test</div></div></div>
                </div>
              </div>
            </div>
            <div className="study-info-card shadow-wrap">
              <div className="shadow-box" />
              <div className="study-info-inner">
                <div className="study-info-title">LIBRARY</div>
                <div className="study-totals">
                  <div className="study-total"><span className="study-total-num">{groups.length}</span><span className="study-total-lbl">TRACKS</span></div>
                  <div className="study-total"><span className="study-total-num">{totalVideos}</span><span className="study-total-lbl">VIDEOS</span></div>
                </div>
                <button className="btn-module" onClick={() => groups.length && navigate('/study/subject/' + groups[0].subject.id)}>START LEARNING</button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
