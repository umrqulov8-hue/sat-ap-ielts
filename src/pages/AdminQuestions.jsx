import { useState, useEffect, useRef } from 'react'
import { useLayout } from '../components/DashLayout'
import { useUser } from '../context/UserContext'
import { supabase } from '../lib/supabaseClient'
import { useToast } from '../components/Toast'

export default function AdminQuestions() {
  const { setPageTitle, setPageSub, setPageClass } = useLayout()
  const [subjects, setSubjects] = useState([])
  const [modules, setModules] = useState([])
  const [topics, setTopics] = useState([])
  const [questions, setQuestions] = useState([])
  const [selSubject, setSelSubject] = useState('')
  const [selModule, setSelModule] = useState('')
  const [selTopic, setSelTopic] = useState('')
  const [tab, setTab] = useState('questions')
  const [qtab, setQtab] = useState('topic')
  const fileRef = useRef(null)
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState(null)

  const [topicTitle, setTopicTitle] = useState('')
  const [topicDesc, setTopicDesc] = useState('')
  const [editingTopic, setEditingTopic] = useState(null)

  const [qText, setQText] = useState('')
  const [noText, setNoText] = useState(false)
  const [qType, setQType] = useState('mc')
  const [opts, setOpts] = useState(['', '', '', ''])
  const [correct, setCorrect] = useState(0)
  const [correctAnswer, setCorrectAnswer] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [textDragOver, setTextDragOver] = useState(false)
  const [explanation, setExplanation] = useState('')
  const [uploading, setUploading] = useState(false)
  const [editingQ, setEditingQ] = useState(null)
  const toast = useToast()
  const { isAdmin, isOwner, userRole, refreshUser, profile: userProfile } = useUser()
  const [msg, setMsg] = useState('')

  const [modTitle, setModTitle] = useState('')
  const [modDesc, setModDesc] = useState('')
  const [modLessons, setModLessons] = useState(0)
  const [modDuration, setModDuration] = useState('')
  const [editingMod, setEditingMod] = useState(null)

  const [notifTitle, setNotifTitle] = useState('')
  const [notifBody, setNotifBody] = useState('')
  const [sending, setSending] = useState(false)

  const sendNotification = async () => {
    if (!notifTitle.trim() || !notifBody.trim()) { toast.error('Fill title and body'); return }
    setSending(true)
    const { data: profiles } = await supabase.from('profiles').select('id')
    if (!profiles?.length) { toast.error('No users found'); setSending(false); return }
    const notifs = profiles.map(p => ({ user_id: p.id, title: notifTitle.trim(), body: notifBody.trim() }))
    const { error } = await supabase.from('notifications').insert(notifs)
    if (error) { toast.error('Error: ' + error.message); setSending(false); return }
    toast.success('Sent to ' + notifs.length + ' users')
    setNotifTitle(''); setNotifBody('')
    setSending(false)
  }

  useEffect(() => {
    setPageTitle('ADMIN')
    setPageSub('Manage Questions')
    setPageClass('')
  }, [])

  useEffect(() => {
    if (tab !== 'users') return
    ;(async () => {
      const { data: profiles } = await supabase.rpc('get_all_profiles')
      if (!profiles) return
      const { data: allTests } = await supabase.rpc('get_all_practice_tests')
      const userMap = {}
      for (const t of allTests || []) {
        if (!userMap[t.user_id]) userMap[t.user_id] = { tests: 0, score: 0, total: 0 }
        userMap[t.user_id].tests++
        userMap[t.user_id].score += t.score
        userMap[t.user_id].total += t.total
      }
      setUsers(profiles.map(p => ({
        ...p,
        ...(userMap[p.id] || { tests: 0, score: 0, total: 0 })
      })))
    })()
  }, [tab])

  useEffect(() => {
    if (tab !== 'stats') return
    ;(async () => {
      const [testsRes, profilesRes] = await Promise.all([
        supabase.rpc('get_all_practice_tests'),
        supabase.rpc('get_all_profiles'),
      ])
      const allTests = testsRes.data
      const allProfiles = profilesRes.data
      if (!allTests) return
      const totalTests = allTests.length
      const totalScore = allTests.reduce((a, t) => a + t.score, 0)
      const totalTotal = allTests.reduce((a, t) => a + t.total, 0)
      const subjectCounts = {}
      for (const t of allTests) {
        const key = t.subject || 'General'
        if (!subjectCounts[key]) subjectCounts[key] = { count: 0, score: 0, total: 0 }
        subjectCounts[key].count++
        subjectCounts[key].score += t.score
        subjectCounts[key].total += t.total
      }
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayTests = allTests.filter(t => new Date(t.taken_at) >= today).length
      setStats({ totalTests, totalScore, totalToday: todayTests, subjectCounts, totalUsers: allProfiles?.length || 0 })
    })()
  }, [tab])

  useEffect(() => {
    supabase.from('subjects').select('*').order('order_index').then(({ data }) => {
      if (data?.length) { setSubjects(data); setSelSubject(data[0].id) }
    })
  }, [])

  useEffect(() => {
    if (!selSubject) return
    supabase.from('modules').select('*').eq('subject_id', selSubject).order('order_index').then(({ data }) => {
      setModules(data || [])
      setSelModule('')
      setTopics([])
      setSelTopic('')
      setQuestions([])
    })
  }, [selSubject])

  useEffect(() => {
    if (!selModule) return
    supabase.from('topics').select('*').eq('module_id', selModule).order('order_index').then(({ data }) => {
      setTopics(data || [])
      setSelTopic('')
      setQuestions([])
    })
  }, [selModule])

  useEffect(() => {
    if (!selTopic) return
    supabase.from('questions').select('*').eq('topic_id', selTopic).order('order_index').then(({ data }) => {
      setQuestions(data || [])
    })
  }, [selTopic])

  const resetQForm = () => {
    setQText(''); setNoText(false); setQType('mc'); setOpts(['', '', '', ''])
    setCorrect(0); setCorrectAnswer(''); setImageFile(null); setImagePreview('')
    setExplanation(''); setEditingQ(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleAddModule = async () => {
    if (!modTitle.trim()) { setMsg('Enter module title'); return }
    if (!selSubject) { setMsg('Select a subject first'); return }
    if (editingMod) {
      const { error } = await supabase.from('modules').update({ title: modTitle.trim(), description: modDesc.trim(), lesson_count: modLessons, duration: modDuration }).eq('id', editingMod)
      if (error) { setMsg('Error: ' + error.message); return }
      setEditingMod(null)
    } else {
      const { error } = await supabase.from('modules').insert({ subject_id: selSubject, title: modTitle.trim(), description: modDesc.trim(), lesson_count: modLessons, duration: modDuration, order_index: modules.length })
      if (error) { setMsg('Error: ' + error.message); return }
    }
    setModTitle(''); setModDesc(''); setModLessons(0); setModDuration('')
    const { data, error } = await supabase.from('modules').select('*').eq('subject_id', selSubject).order('order_index')
    if (data) setModules(data)
    setMsg(editingMod ? 'Module updated!' : 'Module added!')
  }

  const editModule = (m) => {
    setEditingMod(m.id); setModTitle(m.title); setModDesc(m.description || ''); setModLessons(m.lesson_count || 0); setModDuration(m.duration || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const deleteModule = async (id) => {
    if (!window.confirm('Delete this module and all its topics/questions?')) return
    const { error: tErr } = await supabase.from('topics').delete().eq('module_id', id)
    if (tErr) { setMsg('Error deleting topics: ' + tErr.message); return }
    const { error: mErr } = await supabase.from('modules').delete().eq('id', id)
    if (mErr) { setMsg('Error deleting module: ' + mErr.message); return }
    const { data } = await supabase.from('modules').select('*').eq('subject_id', selSubject).order('order_index')
    if (data) setModules(data)
    if (selModule === id) { setSelModule(''); setTopics([]); setSelTopic('') }
    setMsg('Module deleted')
  }

  const handleAddTopic = async () => {
    if (!topicTitle.trim()) { setMsg('Enter topic title'); return }
    if (!selModule) { setMsg('Select a module first'); return }
    if (editingTopic) {
      const { error } = await supabase.from('topics').update({ title: topicTitle.trim(), description: topicDesc.trim() }).eq('id', editingTopic)
      if (error) { setMsg('Error: ' + error.message); return }
      setEditingTopic(null)
    } else {
      const { error } = await supabase.from('topics').insert({ module_id: selModule, title: topicTitle.trim(), description: topicDesc.trim(), order_index: topics.length })
      if (error) { setMsg('Error: ' + error.message); return }
    }
    setTopicTitle(''); setTopicDesc('')
    const { data, error } = await supabase.from('topics').select('*').eq('module_id', selModule).order('order_index')
    if (error) { setMsg('Error loading topics: ' + error.message); return }
    if (data) setTopics(data)
    setMsg(editingTopic ? 'Topic updated!' : 'Topic added!')
  }

  const editTopic = (t) => {
    setEditingTopic(t.id); setTopicTitle(t.title); setTopicDesc(t.description || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const deleteTopic = async (id) => {
    if (!window.confirm('Delete this topic and all its questions?')) return
    const { error: qErr } = await supabase.from('questions').delete().eq('topic_id', id)
    if (qErr) { setMsg('Error deleting questions: ' + qErr.message); return }
    const { error: tErr } = await supabase.from('topics').delete().eq('id', id)
    if (tErr) { setMsg('Error deleting topic: ' + tErr.message); return }
    const { data } = await supabase.from('topics').select('*').eq('module_id', selModule).order('order_index')
    if (data) setTopics(data)
    if (selTopic === id) { setSelTopic(''); setQuestions([]) }
    setMsg('Topic deleted')
  }

  const handleImageSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleDropImg = async (e) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file || !file.type.startsWith('image/')) { setMsg('Drop an image file'); return }
    setImageFile(file); setImagePreview(URL.createObjectURL(file))
  }

  const handleDropToText = async (e) => {
    e.preventDefault(); setTextDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file || !file.type.startsWith('image/')) return
    setMsg('Uploading image...')
    const url = await uploadImgFile(file)
    if (url) { setQText(prev => prev + '\n<img src="' + url + '" alt="" />\n'); setMsg('Image inserted') }
  }

  const uploadImgFile = async (file) => {
    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user?.id
    if (!uid) { setMsg('Not authenticated'); return '' }
    const ext = file.name.split('.').pop()
    const path = uid + '/question-images/' + Date.now() + '.' + ext
    const { error: upErr } = await supabase.storage.from('avav2').upload(path, file, { upsert: true })
    if (upErr) { setMsg('Upload error: ' + upErr.message); return '' }
    const { data: { publicUrl } } = supabase.storage.from('avav2').getPublicUrl(path)
    return publicUrl
  }

  const handleSaveQuestion = async () => {
    if (qType === 'mc') {
      if ((!qText.trim() && !noText) || opts.some(o => !o.trim())) { setMsg('Fill question text and all options'); return }
    } else {
      if ((!qText.trim() && !noText) || !correctAnswer.trim()) { setMsg('Fill question text and correct answer'); return }
    }
    setUploading(true)
    let imageUrl = editingQ?.image_url || ''
    if (imageFile) {
      const { data: { session } } = await supabase.auth.getSession()
      const uid = session?.user?.id
      const ext = imageFile.name.split('.').pop()
      const path = uid + '/question-images/' + Date.now() + '.' + ext
      const { error: upErr } = await supabase.storage.from('avav2').upload(path, imageFile, { upsert: true })
      if (upErr) { setMsg('Upload error: ' + upErr.message); setUploading(false); return }
      const { data: { publicUrl } } = supabase.storage.from('avav2').getPublicUrl(path)
      imageUrl = publicUrl
    }
    const payload = {
      question_text: qText.trim(), options: qType === 'mc' ? opts : [],
      correct_index: qType === 'mc' ? correct : -1, image_url: imageUrl,
      explanation: qType === 'written' ? correctAnswer.trim() : explanation.trim(),
      order_index: editingQ ? editingQ.order_index : questions.length,
    }
    const { error } = editingQ
      ? await supabase.from('questions').update(payload).eq('id', editingQ.id)
      : await supabase.from('questions').insert({ topic_id: selTopic, ...payload })
    setUploading(false)
    if (error) { setMsg('Error: ' + error.message); toast.error('Error saving question') } else {
      setMsg(editingQ ? 'Question updated!' : 'Question saved!')
      toast.success(editingQ ? 'Question updated!' : 'Question saved!')
      resetQForm()
      const { data } = await supabase.from('questions').select('*').eq('topic_id', selTopic).order('order_index')
      if (data) setQuestions(data)
    }
  }

  const editQuestion = (q) => {
    setEditingQ(q)
    setQText(q.question_text)
    setQType(q.correct_index === -1 ? 'written' : 'mc')
    setOpts(Array.isArray(q.options) ? [...q.options] : ['', '', '', ''])
    setCorrect(q.correct_index >= 0 ? q.correct_index : 0)
    setCorrectAnswer(q.correct_index === -1 ? q.explanation || '' : '')
    setExplanation(q.correct_index >= 0 ? q.explanation || '' : '')
    setImagePreview(q.image_url || '')
    setImageFile(null)
    setNoText(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDeleteQuestion = async (id) => {
    if (!window.confirm('Delete this question?')) return
    const { error } = await supabase.from('questions').delete().eq('id', id)
    if (error) {
      toast.error('Error deleting question')
    } else {
      toast.success('Question deleted!')
    }
    setQuestions(questions.filter(q => q.id !== id))
  }

  const updateOpt = (i, v) => {
    const next = [...opts]; next[i] = v; setOpts(next)
  }

  const pct = (s, t) => t > 0 ? Math.round(s / t * 100) + '%' : '-'

  return (
    <>
      {!isAdmin && !isOwner ? (
        <div className="admin-no-access">
          <p>You do not have admin access.</p>
        </div>
      ) : (<>
      {msg && <div className="admin-msg" style={{ marginBottom: '1rem', padding: '0.5rem 1rem', background: '#000', color: '#fff', fontSize: '0.7rem', fontWeight: 700 }}>{msg}</div>}

      <div className="admin-tabs">
        <button className={'admin-tab' + (tab === 'questions' ? ' active' : '')} onClick={() => setTab('questions')}>QUESTIONS</button>
        <button className={'admin-tab' + (tab === 'users' ? ' active' : '')} onClick={() => setTab('users')}>USERS</button>
        <button className={'admin-tab' + (tab === 'stats' ? ' active' : '')} onClick={() => setTab('stats')}>STATS</button>
        <button className={'admin-tab' + (tab === 'notify' ? ' active' : '')} onClick={() => setTab('notify')}>NOTIFY</button>
      </div>

      {tab === 'users' && (
        <div className="admin-users">
          <div className="admin-users-header">
            <span className="admin-usr-h">Name</span>
            <span className="admin-usr-h">Tests</span>
            <span className="admin-usr-h">Correct</span>
            <span className="admin-usr-h">Avg</span>
            <span className="admin-usr-h">Role</span>
          </div>
          {users.map(u => (
            <div key={u.id} className="admin-users-row">
              <span className="admin-usr-c">{u.display_name || '—'}</span>
              <span className="admin-usr-c">{u.tests}</span>
              <span className="admin-usr-c">{u.score}/{u.total}</span>
              <span className="admin-usr-c">{pct(u.score, u.total)}</span>
              <span className="admin-usr-c">
                {isOwner ? (
                  <select
                    className="admin-role-select"
                    value={u.role || 'user'}
                    onChange={async (e) => {
                      const { data } = await supabase.rpc('set_user_role', { target_user_id: u.id, new_role: e.target.value })
                      if (data) {
                        setUsers(prev => prev.map(p => p.id === u.id ? { ...p, role: e.target.value } : p))
                        if (u.id === userProfile?.id) refreshUser()
                        toast.success('Role updated')
                      } else {
                        toast.error('Only owner can change roles')
                      }
                    }}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    <option value="owner">Owner</option>
                  </select>
                ) : (
                  <span className={'admin-role-badge ' + (u.role || 'user')}>{(u.role || 'user').toUpperCase()}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === 'stats' && stats && (
        <div className="admin-stats">
          <div className="admin-stats-grid">
            <div className="admin-stat-card"><span className="admin-stat-val">{stats.totalTests}</span><span className="admin-stat-lbl">Total Tests</span></div>
            <div className="admin-stat-card"><span className="admin-stat-val">{pct(stats.totalScore, stats.totalTotal)}</span><span className="admin-stat-lbl">Avg Score</span></div>
            <div className="admin-stat-card"><span className="admin-stat-val">{stats.totalUsers}</span><span className="admin-stat-lbl">Users</span></div>
            <div className="admin-stat-card"><span className="admin-stat-val">{stats.todayTests}</span><span className="admin-stat-lbl">Today</span></div>
          </div>
          <div className="admin-stats-section">
            <span className="admin-stats-section-title">By Subject</span>
            {Object.entries(stats.subjectCounts).map(([subj, s]) => (
              <div key={subj} className="admin-stats-row">
                <span className="admin-stats-name">{subj}</span>
                <span className="admin-stats-ct">{s.count} tests</span>
                <span className="admin-stats-sc">{pct(s.score, s.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'notify' && (
        <div className="admin-notify">
          <div className="admin-layer">
            <label className="admin-label">SEND NOTIFICATION TO ALL USERS</label>
            <input className="admin-input" placeholder="Title" value={notifTitle} onChange={e => setNotifTitle(e.target.value)} />
            <textarea className="admin-textarea" rows={3} placeholder="Message body" value={notifBody} onChange={e => setNotifBody(e.target.value)} style={{ marginTop: '0.5rem' }} />
            <button className="btn btn-primary" style={{ marginTop: '0.5rem' }} onClick={sendNotification} disabled={sending}>
              {sending ? 'SENDING...' : 'SEND TO ALL USERS'}
            </button>
          </div>
        </div>
      )}

      {tab === 'questions' && (
      <>
          <div className="admin-tabs">
            <button className={'admin-tab' + (qtab === 'modules' ? ' active' : '')} onClick={() => setQtab('modules')}>MODULES</button>
            <button className={'admin-tab' + (qtab === 'topic' ? ' active' : '')} onClick={() => setQtab('topic')}>TOPICS</button>
            <button className={'admin-tab' + (qtab === 'question' ? ' active' : '')} onClick={() => setQtab('question')}>QUESTIONS</button>
          </div>

          <div className="admin-layers">
            <div className="admin-layer">
              <label className="admin-label">SUBJECT</label>
              <select className="admin-select" value={selSubject} onChange={e => setSelSubject(e.target.value)}>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>
            <div className="admin-layer">
              <label className="admin-label">MODULE</label>
              {modules.length === 0 ? (
                <div className="admin-empty">No modules for this subject</div>
              ) : (
                <select className="admin-select" value={selModule} onChange={e => setSelModule(e.target.value)}>
                  <option value="">— Select Module —</option>
                  {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
              )}
            </div>
          </div>

          {qtab === 'modules' && (
            <div className="admin-module-section">
              <div className="admin-layer">
                <label className="admin-label">{editingMod ? 'EDIT MODULE' : 'NEW MODULE'}</label>
                <input className="admin-input" value={modTitle} onChange={e => setModTitle(e.target.value)} placeholder="Module title" />
                <input className="admin-input" value={modDesc} onChange={e => setModDesc(e.target.value)} placeholder="Description (optional)" style={{ marginTop: '0.5rem' }} />
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <input className="admin-input" type="number" min="0" value={modLessons} onChange={e => setModLessons(Number(e.target.value))} placeholder="Lesson count" style={{ width: '40%' }} />
                  <input className="admin-input" value={modDuration} onChange={e => setModDuration(e.target.value)} placeholder="Duration (e.g. 2 weeks)" style={{ width: '60%' }} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button className="btn-solid-black" onClick={handleAddModule}>{editingMod ? 'UPDATE MODULE' : 'ADD MODULE'}</button>
                  {editingMod && <button className="btn-solid-black" style={{ background: 'transparent', color: '#000' }} onClick={() => { setEditingMod(null); setModTitle(''); setModDesc(''); setModLessons(0); setModDuration('') }}>CANCEL</button>}
                </div>
              </div>

              <div className="admin-layer" style={{ marginTop: '1rem' }}>
                <label className="admin-label">EXISTING MODULES</label>
                {modules.length === 0 ? (
                  <div className="admin-empty">No modules yet.</div>
                ) : (
                  modules.map(m => (
                    <div key={m.id} className="admin-topic-item">
                      <div style={{ flex: 1 }}>
                        <span className="admin-topic-title">{m.title}</span>
                        <span className="admin-topic-count">{m.duration} &middot; {m.lesson_count} lessons</span>
                      </div>
                      <button className="admin-q-del" onClick={() => editModule(m)} style={{ marginRight: '0.5rem' }}>EDIT</button>
                      <button className="admin-q-del" onClick={() => deleteModule(m.id)}>DEL</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {qtab === 'topic' && (
            <div className="admin-topic-section">
              <div className="admin-layer">
                <label className="admin-label">{editingTopic ? 'EDIT TOPIC' : 'NEW TOPIC'}</label>
                <input className="admin-input" value={topicTitle} onChange={e => setTopicTitle(e.target.value)} placeholder="Topic title" />
                <input className="admin-input" value={topicDesc} onChange={e => setTopicDesc(e.target.value)} placeholder="Description (optional)" style={{ marginTop: '0.5rem' }} />
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button className="btn-solid-black" onClick={handleAddTopic}>{editingTopic ? 'UPDATE TOPIC' : 'ADD TOPIC'}</button>
                  {editingTopic && <button className="btn-solid-black" style={{ background: 'transparent', color: '#000' }} onClick={() => { setEditingTopic(null); setTopicTitle(''); setTopicDesc('') }}>CANCEL</button>}
                </div>
              </div>

              {topics.length > 0 && (
                <div className="admin-layer">
                  <label className="admin-label">EXISTING TOPICS</label>
                  {topics.map(t => (
                    <div key={t.id} className="admin-topic-item">
                      <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => { setSelTopic(t.id); setQtab('question') }}>
                        <span className="admin-topic-title">{t.title}</span>
                        <span className="admin-topic-count">{t.description}</span>
                      </div>
                      <button className="admin-q-del" onClick={() => editTopic(t)} style={{ marginRight: '0.5rem' }}>EDIT</button>
                      <button className="admin-q-del" onClick={() => deleteTopic(t.id)}>DEL</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {qtab === 'question' && (
            <div className="admin-q-section">
              <div className="admin-layer">
                <label className="admin-label">SELECT TOPIC</label>
                {topics.length === 0 ? (
                  <div className="admin-empty">No topics yet.</div>
                ) : (
                  <select className="admin-select" value={selTopic} onChange={e => { setSelTopic(e.target.value); resetQForm() }}>
                    <option value="">— Select Topic —</option>
                    {topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                )}
              </div>

              {selTopic && (
                <>
                  <div className="admin-layer">
                    <label className="admin-label">IMAGE (optional)</label>
                    <div className={'admin-dropzone' + (dragOver ? ' drag-over' : '')}
                      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                      onDragLeave={() => setDragOver(false)} onDrop={handleDropImg}>
                      {imagePreview ? <img src={imagePreview} alt="" className="admin-preview" /> :
                        <div className="admin-dropzone-text">Drop image here or click to browse</div>}
                      <input type="file" accept="image/*" onChange={handleImageSelect} className="admin-file-input" ref={fileRef} />
                    </div>
                    {editingQ?.image_url && !imageFile && <p style={{ fontSize: '0.65rem', color: '#888', marginTop: '0.3rem' }}>Current image: {editingQ.image_url}</p>}
                  </div>

                  <div className="admin-layer">
                    <label className="admin-label">QUESTION TEXT</label>
                    <div className={'admin-textarea-wrap' + (textDragOver ? ' drag-over' : '')}
                      onDragOver={e => { e.preventDefault(); setTextDragOver(true) }}
                      onDragLeave={() => setTextDragOver(false)} onDrop={handleDropToText}>
                      <textarea className="admin-textarea admin-textarea-q" rows={8} value={qText} onChange={e => setQText(e.target.value)}
                        placeholder={noText ? 'Optional — question is in the image' : 'Enter question...'} disabled={noText} />
                    </div>
                    <div className="admin-no-text-row">
                      <button className={'admin-no-text-btn' + (noText ? ' active' : '')} onClick={() => setNoText(!noText)}>
                        {noText ? 'QUESTION TEXT DISABLED' : 'QUESTION IN IMAGE (no text)'}
                      </button>
                    </div>
                  </div>

                  <div className="admin-layer">
                    <label className="admin-label">QUESTION TYPE</label>
                    <div className="admin-type-row">
                      <button className={'admin-type-btn' + (qType === 'mc' ? ' active' : '')} onClick={() => setQType('mc')}>MULTIPLE CHOICE</button>
                      <button className={'admin-type-btn' + (qType === 'written' ? ' active' : '')} onClick={() => setQType('written')}>WRITTEN ANSWER</button>
                    </div>
                  </div>

                  {qType === 'mc' ? (
                    <div className="admin-layer">
                      <label className="admin-label">OPTIONS</label>
                      {opts.map((o, i) => (
                        <div key={i} className="admin-opt-row">
                          <span className="admin-opt-letter">{String.fromCharCode(65 + i)}</span>
                          <input className="admin-input" value={o} onChange={e => updateOpt(i, e.target.value)} placeholder={'Option ' + String.fromCharCode(65 + i)} />
                          <input type="radio" name="correct" checked={correct === i} onChange={() => setCorrect(i)} className="admin-radio" />
                        </div>
                      ))}
                      <span className="admin-radio-label">(radio = correct answer)</span>
                    </div>
                  ) : (
                    <div className="admin-layer">
                      <label className="admin-label">CORRECT ANSWER</label>
                      <textarea className="admin-textarea" rows={2} value={correctAnswer} onChange={e => setCorrectAnswer(e.target.value)} placeholder="Enter the correct answer..." />
                    </div>
                  )}

                  <div className="admin-layer">
                    <label className="admin-label">EXPLANATION (optional)</label>
                    <textarea className="admin-textarea" rows={2} value={explanation} onChange={e => setExplanation(e.target.value)} placeholder="Explain why the answer is correct..." />
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-solid-black" onClick={handleSaveQuestion} disabled={uploading}>
                      {uploading ? 'SAVING...' : (editingQ ? 'UPDATE QUESTION' : 'SAVE QUESTION')}
                    </button>
                    {editingQ && <button className="btn-solid-black" style={{ background: 'transparent', color: '#000' }} onClick={resetQForm}>CANCEL</button>}
                  </div>

                  {questions.length > 0 && (
                    <div className="admin-layer" style={{ marginTop: '2rem' }}>
                      <label className="admin-label">QUESTIONS ({questions.length})</label>
                      {questions.map((q, i) => (
                        <div key={q.id} className="admin-q-item">
                          <div className="admin-q-item-top">
                            <span className="admin-q-num">Q{i + 1}.</span>
                            <span className={'admin-q-type' + (q.correct_index === -1 ? ' written' : '')}>{q.correct_index === -1 ? 'WRITTEN' : 'MC'}</span>
                            <span className="admin-q-text">{q.question_text}</span>
                            <button className="admin-q-del" onClick={() => editQuestion(q)} style={{ marginRight: '0.3rem' }}>EDIT</button>
                            <button className="admin-q-del" onClick={() => handleDeleteQuestion(q.id)}>DEL</button>
                          </div>
                          {q.image_url && <img src={q.image_url} alt="" className="admin-q-thumb" />}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
      </>)}
    </>
  )
}
