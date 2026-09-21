import { useState, useEffect, useCallback } from 'react'
import { useLayout } from '../components/DashLayout'
import { useUser } from '../context/UserContext'
import { supabase } from '../lib/supabaseClient'
import { useToast } from '../components/Toast'
import { detectVideoType, getThumbnail, isValidVideoUrl } from '../lib/video'

export default function AdminVideos() {
  const { setPageTitle, setPageSub, setPageClass } = useLayout()
  const { isAdmin, isOwner } = useUser()
  const toast = useToast()

  const [subjects, setSubjects] = useState([])
  const [videos, setVideos] = useState([])
  const [selSubject, setSelSubject] = useState('')

  const [vTitle, setVTitle] = useState('')
  const [vUrl, setVUrl] = useState('')
  const [vDesc, setVDesc] = useState('')
  const [vOrder, setVOrder] = useState(0)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const loadVideos = useCallback(async () => {
    if (!selSubject) {
      setVideos([])
      return
    }
    const { data } = await supabase.from('videos').select('*').eq('subject_id', selSubject).order('order_index')
    setVideos(data || [])
  }, [selSubject])

  useEffect(() => {
    setPageTitle('VIDEO ADMIN')
    setPageSub('Manage study videos')
    setPageClass('')
    ;(async () => {
      const { data } = await supabase.from('subjects').select('id, title').order('order_index')
      if (data?.length) {
        setSubjects(data)
        setSelSubject(data[0].id)
      }
    })()
  }, [setPageTitle, setPageSub, setPageClass])

  useEffect(() => {
    loadVideos()
  }, [loadVideos])

  const resetForm = () => {
    setEditing(null); setVTitle(''); setVUrl(''); setVDesc(''); setVOrder(videos.length)
  }

  const handleSave = async () => {
    if (!selSubject) { setMsg('Select a subject first'); return }
    if (!vTitle.trim()) { setMsg('Enter a video title'); return }
    if (!isValidVideoUrl(vUrl)) { setMsg('Enter a valid YouTube or file URL'); return }
    setSaving(true)
    const payload = {
      subject_id: selSubject,
      title: vTitle.trim(),
      video_url: vUrl.trim(),
      video_type: detectVideoType(vUrl),
      description: vDesc.trim(),
      order_index: Number(vOrder) || 0,
    }
    const { error } = editing
      ? await supabase.from('videos').update(payload).eq('id', editing.id)
      : await supabase.from('videos').insert(payload)
    setSaving(false)
    if (error) { setMsg('Error: ' + error.message); toast.error('Error saving video') }
    else {
      setMsg(editing ? 'Video updated!' : 'Video added!')
      toast.success(editing ? 'Video updated!' : 'Video added!')
      resetForm()
      loadVideos()
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this video?')) return
    const { error } = await supabase.from('videos').delete().eq('id', id)
    if (error) { setMsg('Error: ' + error.message); return }
    setMsg('Video deleted')
    if (editing?.id === id) resetForm()
    loadVideos()
  }

  const startEdit = (v) => {
    setEditing(v)
    setVTitle(v.title)
    setVUrl(v.video_url)
    setVDesc(v.description || '')
    setVOrder(v.order_index || 0)
  }

  const previewType = vUrl ? detectVideoType(vUrl) : null
  const previewThumb = vUrl ? getThumbnail(vUrl, null) : null
  const colors = ['admin-stat-lavender', 'admin-stat-peach', 'admin-stat-green', 'admin-stat-yellow', 'admin-stat-pink']

  return (
    <>
      {!isAdmin && !isOwner ? (
        <div className="admin-no-access">
          <p>You do not have admin access.</p>
        </div>
      ) : (<>
        {msg && <div className="admin-msg-toast"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>{msg}<button className="admin-msg-close" onClick={() => setMsg('')}>×</button></div>}

        <div className="admin-layers">
          <div className="admin-layer">
            <label className="admin-label">SUBJECT</label>
            <select className="admin-select" value={selSubject} onChange={e => setSelSubject(e.target.value)}>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>
        </div>

        <div className="admin-layer" style={{ marginTop: '1rem' }}>
          <label className="admin-label">{editing ? 'EDIT VIDEO' : 'NEW VIDEO'}</label>
          <input className="admin-input" value={vTitle} onChange={e => setVTitle(e.target.value)} placeholder="Video title" />
          <input className="admin-input" value={vUrl} onChange={e => setVUrl(e.target.value)} placeholder="YouTube link or direct file URL (mp4...)" style={{ marginTop: '0.5rem' }} />
          {vUrl ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
              <span className={'video-type ' + previewType}>{previewType === 'youtube' ? 'YOUTUBE' : 'VIDEO FILE'}</span>
              {previewThumb && <img src={previewThumb} alt="" style={{ width: 120, aspectRatio: '16/9', objectFit: 'cover', border: '2px solid #000' }} />}
            </div>
          ) : null}
          <input className="admin-input" value={vDesc} onChange={e => setVDesc(e.target.value)} placeholder="Description (optional)" style={{ marginTop: '0.5rem' }} />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <input className="admin-input" type="number" min="0" value={vOrder} onChange={e => setVOrder(Number(e.target.value))} placeholder="Order" style={{ width: '40%' }} />
            <button className="btn-solid-black" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>
              {saving ? 'SAVING...' : (editing ? 'UPDATE VIDEO' : 'ADD VIDEO')}
            </button>
            {editing && <button className="btn-solid-black" style={{ background: 'transparent', color: '#000' }} onClick={resetForm}>CANCEL</button>}
          </div>
        </div>

        <div className="admin-layer" style={{ marginTop: '1rem' }}>
          <label className="admin-label">VIDEOS IN THIS SUBJECT ({videos.length})</label>
          {videos.length === 0 ? (
            <div className="admin-empty">No videos yet. Add the first one above.</div>
          ) : (
            <div className="admin-card-list">
              {videos.map((v, idx) => (
                <div key={v.id} className={'admin-card-item ' + colors[idx % colors.length]}>
                  <div className="admin-card-num">#{idx + 1}</div>
                  {(() => { const th = getThumbnail(v.video_url, v.thumbnail_url); return th ? <img src={th} alt="" style={{ width: 96, aspectRatio: '16/9', objectFit: 'cover', border: '2px solid #000', flexShrink: 0 }} /> : null })()}
                  <div className="admin-card-body">
                    <div className="admin-card-title">{v.title}</div>
                    <div className="admin-card-desc">{v.video_url}</div>
                    <div className="admin-card-meta">
                      <span className="admin-card-tag">{(v.video_type || 'youtube').toUpperCase()}</span>
                      <span className="admin-card-tag">ORDER {v.order_index}</span>
                    </div>
                  </div>
                  <div className="admin-card-actions">
                    <button className="admin-icon-btn" onClick={() => startEdit(v)} title="Edit">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                    </button>
                    <button className="admin-icon-btn admin-icon-btn-danger" onClick={() => handleDelete(v.id)} title="Delete">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </>)}
    </>
  )
}
