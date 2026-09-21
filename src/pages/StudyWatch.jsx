import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLayout } from '../components/DashLayout'
import { supabase } from '../lib/supabaseClient'
import { getEmbedUrl, detectVideoType } from '../lib/video'

export default function StudyWatch() {
  const { subjectId, videoId } = useParams()
  const navigate = useNavigate()
  const { setPageTitle, setPageSub, setPageClass } = useLayout()
  const [subject, setSubject] = useState(null)
  const [video, setVideo] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setPageClass('')
    ;(async () => {
      const [{ data: s }, { data: v }] = await Promise.all([
        supabase.from('subjects').select('id, title, slug').eq('id', subjectId).maybeSingle(),
        supabase.from('videos').select('*').eq('id', videoId).maybeSingle(),
      ])
      if (!s || !v) { navigate('/study'); return }
      setSubject(s)
      setVideo(v)
      setPageTitle(v.title.toUpperCase())
      setPageSub(s.title)
      setLoading(false)
    })()
  }, [subjectId, videoId, navigate, setPageTitle, setPageSub, setPageClass])

  if (loading || !subject || !video) return null

  const type = video.video_type || detectVideoType(video.video_url)

  return (
    <>
      <div className="topics-header">
        <button className="topics-back" onClick={() => navigate('/study/subject/' + subjectId)}>&larr; BACK</button>
      </div>

      <div className="video-watch shadow-wrap">
        <div className="shadow-box" />
        <div className="video-player-wrap video-player-standalone" onContextMenu={e => e.preventDefault()}>
          {type === 'youtube' ? (
            <iframe
              src={getEmbedUrl(video.video_url)}
              title={video.title}
              sandbox="allow-scripts allow-same-origin allow-presentation"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video src={video.video_url} controls playsInline preload="metadata" autoPlay />
          )}
        </div>
      </div>

      <h2 className="section-title" style={{ marginTop: '1.5rem' }}>{video.title.toUpperCase()}</h2>
      {video.description ? <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '1rem' }}>{video.description}</p> : null}

      <div className="topic-row shadow-wrap" onClick={() => navigate('/' + subject.slug)}>
        <div className="shadow-box" />
        <div className="topic-inner">
          <div className="topic-left">
            <span className="topic-num">▶</span>
            <div>
              <div className="topic-name">Practice {subject.title}</div>
              <div className="topic-desc">Test what you learned from this lesson</div>
            </div>
          </div>
          <div className="topic-right">
            <button className="btn-module" onClick={(e) => { e.stopPropagation(); navigate('/' + subject.slug) }}>START TEST</button>
          </div>
        </div>
      </div>
    </>
  )
}
