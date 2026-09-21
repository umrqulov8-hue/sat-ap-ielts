import { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import '../styles/profile-style.css'
import { useLayout } from '../components/DashLayout'
import { supabase } from '../lib/supabaseClient'
import { useUser } from '../context/UserContext'

export default function Profile() {
  const { setPageTitle, setPageSub, setPageClass } = useLayout()
  const { refreshUser } = useUser()
  const [profile, setProfile] = useState({ name: 'STUDENT', email: '', lang: 'EN', avatar_url: '' })
  const [totalScore, setTotalScore] = useState(null)
  const [scores, setScores] = useState([])
  const [testCount, setTestCount] = useState(0)
  const [practiceHours, setPracticeHours] = useState(0)
  const [tier, setTier] = useState('free')
  const [editOpen, setEditOpen] = useState(false)
  const [edit, setEdit] = useState({ name: '', lang: 'EN', avatar_url: '' })
  const [memberSince, setMemberSince] = useState('')
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState('')
  const fileRef = useRef(null)

  const loadProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    const user = session.user

    setProfile(p => ({ ...p, email: user.email || '' }))
    if (user.created_at) {
      setMemberSince(new Date(user.created_at).toLocaleDateString())
    }

    const [profRes, tsRes, scRes, testsRes, durRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('user_total_scores').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('user_scores').select('*, subjects(slug, title)').eq('user_id', user.id),
      supabase.from('practice_tests').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('practice_tests').select('duration').eq('user_id', user.id),
    ])

    if (profRes.data) {
      const name = profRes.data.display_name || 'STUDENT'
      setProfile(p => ({
        ...p,
        name,
        lang: profRes.data.lang || 'EN',
        avatar_url: profRes.data.avatar_url || '',
      }))
      setPageTitle(`HI, ${name.toUpperCase()}`)
      setTier(profRes.data.plan_type || 'free')
    }
    if (tsRes.data) setTotalScore(tsRes.data)
    if (scRes.data) setScores(scRes.data)
    if (testsRes.count !== null && testsRes.count !== undefined) setTestCount(testsRes.count)
    if (durRes.data) {
      let mins = 0
      for (const d of durRes.data) {
        const m = parseInt(String(d.duration || '0'), 10)
        if (!isNaN(m)) mins += m
      }
      setPracticeHours(mins / 60)
    }
  }, [setPageTitle])

  useEffect(() => {
    setPageTitle('HI, STUDENT')
    setPageSub('READY TO LEVEL UP TODAY?')
    setPageClass('profile-page')
    loadProfile()
  }, [setPageTitle, setPageSub, setPageClass, loadProfile])

  const getScore = (slug) => {
    const s = scores.find(sc => sc.subjects?.slug === slug)
    return s ? s.score : null
  }

  const openEdit = () => {
    setEdit({ name: profile.name, lang: profile.lang, avatar_url: profile.avatar_url })
    setEditOpen(true)
  }

  const uploadAvatar = async (file) => {
    const localUrl = URL.createObjectURL(file)
    setEdit(e => ({ ...e, avatar_url: localUrl }))
    setUploading(true)

    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) { setUploading(false); return }

    const { data: existing } = await supabase.storage.from('avav2').list(user.id)
    if (existing?.length) {
      await supabase.storage.from('avav2').remove(existing.map(f => `${user.id}/${f.name}`))
    }

    const ext = file.name.split('.').pop()
    const filePath = `${user.id}/avatar.${ext}`

    const { error } = await supabase.storage.from('avav2').upload(filePath, file, { upsert: true })
    URL.revokeObjectURL(localUrl)

    if (error) { setMsg('Upload error: ' + error.message); setUploading(false); return }

    const { data: { publicUrl } } = supabase.storage.from('avav2').getPublicUrl(filePath)
    setEdit(e => ({ ...e, avatar_url: publicUrl }))
    setUploading(false)
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) uploadAvatar(file)
  }

  const saveEdit = async () => {
    setProfile(p => ({ ...p, name: edit.name, avatar_url: edit.avatar_url }))
    setPageTitle(`HI, ${edit.name.toUpperCase()}`)
    setEditOpen(false)

    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    await supabase.from('profiles').update({ display_name: edit.name, avatar_url: edit.avatar_url, lang: edit.lang }).eq('id', user.id)
    refreshUser()
  }

  const overallScore = totalScore?.total_score || 0
  const advScore = getScore('advanced-math') || 0
  const dataScore = getScore('data-analysis') || 0
  const probScore = getScore('problem-solving') || 0
  const algebraScore = getScore('algebra') || 0
  const geometryScore = getScore('geometry') || 0

  return (
    <>
      {msg && <div className="settings-toast" style={{ marginBottom: '1rem' }}>{msg}</div>}
      <div className="profile-top">
        <div className="settings-card profile-card">
          <div className="profile-avatar" style={profile.avatar_url ? { backgroundImage: `url(${profile.avatar_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}} />
          <h2 className="profile-name">{profile.name}</h2>
          <p className="profile-email">{profile.email}</p>
          <button className="profile-edit-btn" onClick={openEdit}>EDIT PROFILE</button>
        </div>

        <div className="profile-stats">
          <div className="stat-card">
            <div className="stat-card-top">
              <div className="stat-icon lavender">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>
              </div>
              <div className="stat-label-row">
                <span className="stat-tag lavender">MATH</span>
                <span className="stat-label">OVERALL SCORE</span>
              </div>
            </div>
            <div className="stat-value">{overallScore || '—'}</div>
            <div className="stat-footer">
              <span className="stat-footer-label">OUT OF 800</span>
              <div className="stat-bar"><div className="stat-bar-fill lavender" style={{ width: `${Math.min(100, (overallScore / 800) * 100)}%` }} /></div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-top">
              <div className="stat-icon peach">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              </div>
              <div className="stat-label-row">
                <span className="stat-tag peach">TOTAL</span>
                <span className="stat-label">TESTS TAKEN</span>
              </div>
            </div>
            <div className="stat-value">{testCount || '—'}</div>
            <div className="stat-footer">
              <span className="stat-footer-label">ALL TIME</span>
              <div className="stat-bar"><div className="stat-bar-fill peach" style={{ width: `${Math.min(100, testCount * 10)}%` }} /></div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-top">
              <div className="stat-icon green">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              </div>
              <div className="stat-label-row">
                <span className="stat-tag green">HOURS</span>
                <span className="stat-label">PRACTICE TIME</span>
              </div>
            </div>
            <div className="stat-value">{practiceHours ? practiceHours.toFixed(1) + 'h' : '—'}</div>
            <div className="stat-footer">
              <span className="stat-footer-label">ALL TIME</span>
              <div className="stat-bar"><div className="stat-bar-fill green" style={{ width: `${Math.min(100, practiceHours * 8)}%` }} /></div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-top">
              <div className="stat-icon yellow">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              </div>
              <div className="stat-label-row">
                <span className="stat-tag yellow">TIER</span>
                <span className="stat-label">ACCOUNT TYPE</span>
              </div>
            </div>
            <div className="stat-value">{tier === 'pro' ? 'PRO' : tier === 'enterprise' ? 'TEAM' : 'FREE'}</div>
            <div className="stat-footer">
              <span className="stat-footer-label">{tier === 'pro' ? 'FULL ACCESS' : tier === 'enterprise' ? 'ORGANIZATION' : 'BASIC ACCESS'}</span>
              <div className="stat-bar"><div className="stat-bar-fill yellow" style={{ width: tier === 'pro' ? '100%' : tier === 'enterprise' ? '75%' : '30%' }} /></div>
            </div>
          </div>
        </div>
      </div>

      <div className="section-header">
        <h2 className="section-title">SKILL ANALYTICS</h2>
      </div>

      <div className="skills-grid">
        <div className="module-card">
          <div className="module-info">
            <div className="module-icon lavender">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
            </div>
            <div className="module-text">
              <span className="module-name">ADVANCED MATH</span>
              <span className="module-sub">800 POINTS MAX</span>
            </div>
            <span className="module-score">{advScore || '—'}</span>
          </div>
          <div className="module-progress"><div className="module-progress-bar lavender-bar" style={{ width: `${Math.min(100, ((advScore || 0) / 800) * 100)}%` }} /></div>
        </div>
        <div className="module-card">
          <div className="module-info">
            <div className="module-icon yellow">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" /></svg>
            </div>
            <div className="module-text">
              <span className="module-name">DATA ANALYSIS</span>
              <span className="module-sub">800 POINTS MAX</span>
            </div>
            <span className="module-score">{dataScore || '—'}</span>
          </div>
          <div className="module-progress"><div className="module-progress-bar yellow-bar" style={{ width: `${Math.min(100, ((dataScore || 0) / 800) * 100)}%` }} /></div>
        </div>
        <div className="module-card">
          <div className="module-info">
            <div className="module-icon pink">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            </div>
            <div className="module-text">
              <span className="module-name">PROBLEM SOLVING</span>
              <span className="module-sub">800 POINTS MAX</span>
            </div>
            <span className="module-score">{probScore || '—'}</span>
          </div>
          <div className="module-progress"><div className="module-progress-bar pink-bar" style={{ width: `${Math.min(100, ((probScore || 0) / 800) * 100)}%` }} /></div>
        </div>
        <div className="module-card">
          <div className="module-info">
            <div className="module-icon green">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 4H6l6 8-6 8h12" /></svg>
            </div>
            <div className="module-text">
              <span className="module-name">ALGEBRA</span>
              <span className="module-sub">800 POINTS MAX</span>
            </div>
            <span className="module-score">{algebraScore || '—'}</span>
          </div>
          <div className="module-progress"><div className="module-progress-bar green-bar" style={{ width: `${Math.min(100, ((algebraScore || 0) / 800) * 100)}%` }} /></div>
        </div>
        <div className="module-card">
          <div className="module-info">
            <div className="module-icon peach">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l9 18H3z" /></svg>
            </div>
            <div className="module-text">
              <span className="module-name">GEOMETRY</span>
              <span className="module-sub">800 POINTS MAX</span>
            </div>
            <span className="module-score">{geometryScore || '—'}</span>
          </div>
          <div className="module-progress"><div className="module-progress-bar peach-bar" style={{ width: `${Math.min(100, ((geometryScore || 0) / 800) * 100)}%` }} /></div>
        </div>
      </div>

      <div className="settings-card">
        <h3 className="details-title">PERSONAL DETAILS</h3>
        <div className="details-grid">
          <div className="detail-item">
            <div className="detail-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg></div>
            <div className="detail-content"><span className="detail-label">FULL NAME</span><span className="detail-value">{profile.name}</span></div>
          </div>
          <div className="detail-item">
            <div className="detail-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg></div>
            <div className="detail-content"><span className="detail-label">EMAIL ADDRESS</span><span className="detail-value">{profile.email}</span></div>
          </div>
          <div className="detail-item">
            <div className="detail-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg></div>
            <div className="detail-content"><span className="detail-label">MEMBER SINCE</span><span className="detail-value">{memberSince || '—'}</span></div>
          </div>
          <div className="detail-item">
            <div className="detail-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg></div>
            <div className="detail-content"><span className="detail-label">LANGUAGE</span><span className="detail-value">{profile.lang}</span></div>
          </div>
        </div>
      </div>

      {editOpen && createPortal(
        <div className="edit-modal-overlay" onClick={() => setEditOpen(false)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()}>
            <button className="edit-modal-close" onClick={() => setEditOpen(false)}>&times;</button>
            <h3 className="edit-modal-title">EDIT PROFILE</h3>

            <div className="settings-field" style={{ alignItems: 'center', gap: '1rem' }}>
              <div className="profile-avatar" style={edit.avatar_url ? { width: 80, height: 80, borderRadius: '50%', backgroundImage: `url(${edit.avatar_url})`, backgroundSize: 'cover', backgroundPosition: 'center', flexShrink: 0 } : { width: 80, height: 80, borderRadius: '50%', background: '#eee', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700, color: '#888' }}>
                {!edit.avatar_url && edit.name?.charAt(0)}
              </div>
              <div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
                <button className="btn-settings" type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? 'UPLOADING...' : 'CHANGE PHOTO'}
                </button>
              </div>
            </div>

            <div className="settings-field">
              <label className="settings-label">FULL NAME</label>
              <input className="settings-input" type="text" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} />
            </div>
            <div className="settings-field">
              <label className="settings-label">LANGUAGE</label>
              <select className="settings-input" value={edit.lang} onChange={e => setEdit({ ...edit, lang: e.target.value })}>
                <option value="EN">EN</option>
                <option value="UZ">UZ</option>
                <option value="RU">RU</option>
              </select>
            </div>
            <button className="btn-settings" style={{ marginTop: '1rem', width: '100%' }} onClick={saveEdit}>SAVE CHANGES</button>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
