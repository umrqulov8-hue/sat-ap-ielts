import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLayout } from '../components/DashLayout'
import { supabase } from '../lib/supabaseClient'
import { getThumbnail } from '../lib/video'

export default function StudySubject() {
  const { subjectId } = useParams()
  const navigate = useNavigate()
  const { setPageTitle, setPageSub, setPageClass } = useLayout()
  const [subject, setSubject] = useState(null)
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setPageClass('')
    ;(async () => {
      const { data: s } = await supabase.from('subjects').select('id, title, color').eq('id', subjectId).maybeSingle()
      if (!s) { navigate('/study'); return }
      setSubject(s)
      setPageTitle(s.title.toUpperCase())
      setPageSub('Video lessons')
      const { data: vs } = await supabase.from('videos').select('*').eq('subject_id', subjectId).order('order_index')
      setVideos(vs || [])
      setLoading(false)
    })()
  }, [subjectId, navigate, setPageTitle, setPageSub, setPageClass])

  if (loading || !subject) return null

  return (
    <>
      <div className="topics-header">
        <button className="topics-back" onClick={() => navigate('/study')}>&larr; BACK</button>
        <span className="topics-count">{videos.length} VIDEO{videos.length !== 1 ? 'S' : ''}</span>
      </div>
      {videos.length === 0 ? (
        <div className="topics-list">
          <div className="topic-row shadow-wrap"><div className="shadow-box" />
            <div className="topic-inner">
              <div className="topic-left">
                <div>
                  <div className="topic-name">No videos yet</div>
                  <div className="topic-desc">Lessons will appear here soon</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="video-list">
          {videos.map((v, i) => {
            const thumb = getThumbnail(v.video_url, v.thumbnail_url)
            return (
              <div key={v.id} className="video-card shadow-wrap" onClick={() => navigate(`/study/subject/${subjectId}/watch/${v.id}`)}>
                <div className="shadow-box" />
                <div className="video-inner">
                  {thumb ? (
                    <div className="video-thumb-wrap">
                      <img className="video-thumb" src={thumb} alt="" loading="lazy" />
                      <span className="video-play">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3" /></svg>
                      </span>
                    </div>
                  ) : (
                    <div className="video-thumb-fallback">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3" /></svg>
                    </div>
                  )}
                  <div className="video-info">
                    <div className="video-title">{i + 1}. {v.title}</div>
                    {v.description ? <div className="video-desc">{v.description}</div> : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
