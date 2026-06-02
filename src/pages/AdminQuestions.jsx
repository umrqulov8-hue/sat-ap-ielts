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
  const [layoutSplit, setLayoutSplit] = useState(localStorage.getItem('testLayout') === 'split')
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
  const [savingMod, setSavingMod] = useState(false)
  const [savingTopic, setSavingTopic] = useState(false)

  const [notifTitle, setNotifTitle] = useState('')
  const [notifBody, setNotifBody] = useState('')
  const [sending, setSending] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState('all')

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
      const allTests = testsRes.data || []
      const allProfiles = profilesRes.data || []
      const totalTests = allTests.length
      const totalScore = allTests.reduce((a, t) => a + (t.score || 0), 0)
      const totalTotal = allTests.reduce((a, t) => a + (t.total || 0), 0)
      const subjectCounts = {}
      for (const t of allTests) {
        const key = t.subject || 'General'
        if (!subjectCounts[key]) subjectCounts[key] = { count: 0, score: 0, total: 0, today: 0 }
        subjectCounts[key].count++
        subjectCounts[key].score += t.score || 0
        subjectCounts[key].total += t.total || 0
      }
      const now = new Date()
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
      const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 6)
      const todayTests = []
      const weekBuckets = {}
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart); d.setDate(d.getDate() + i)
        weekBuckets[d.toISOString().slice(0, 10)] = { count: 0, score: 0, total: 0 }
      }
      const userStats = {}
      for (const t of allTests) {
        const taken = new Date(t.taken_at)
        if (taken >= todayStart) {
          todayTests.push(t)
          const subj = t.subject || 'General'
          if (subjectCounts[subj]) subjectCounts[subj].today++
        }
        const dayKey = taken.toISOString().slice(0, 10)
        if (weekBuckets[dayKey]) {
          weekBuckets[dayKey].count++
          weekBuckets[dayKey].score += t.score || 0
          weekBuckets[dayKey].total += t.total || 0
        }
        if (!userStats[t.user_id]) userStats[t.user_id] = { tests: 0, score: 0, total: 0 }
        userStats[t.user_id].tests++
        userStats[t.user_id].score += t.score || 0
        userStats[t.user_id].total += t.total || 0
      }
      const topUsers = Object.entries(userStats)
        .map(([uid, s]) => ({ ...s, id: uid, avg: s.total > 0 ? s.score / s.total : 0, name: allProfiles.find(p => p.id === uid)?.display_name || '—' }))
        .sort((a, b) => b.tests - a.tests)
        .slice(0, 5)
      const allProfilesById = Object.fromEntries(allProfiles.map(p => [p.id, p]))
      const recent = [...allTests].sort((a, b) => new Date(b.taken_at) - new Date(a.taken_at)).slice(0, 6)
      setStats({
        totalTests, totalScore, totalTotal,
        totalToday: todayTests.length,
        subjectCounts, totalUsers: allProfiles.length,
        weekBuckets, topUsers, recent, allProfilesById,
      })
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
    setSavingMod(true)
    if (editingMod) {
      const { error } = await supabase.from('modules').update({ title: modTitle.trim(), description: modDesc.trim(), lesson_count: modLessons, duration: modDuration }).eq('id', editingMod)
      if (error) { setMsg('Error: ' + error.message); setSavingMod(false); return }
      setEditingMod(null)
    } else {
      const { error } = await supabase.from('modules').insert({ subject_id: selSubject, title: modTitle.trim(), description: modDesc.trim(), lesson_count: modLessons, duration: modDuration, order_index: modules.length })
      if (error) { setMsg('Error: ' + error.message); setSavingMod(false); return }
    }
    setModTitle(''); setModDesc(''); setModLessons(0); setModDuration('')
    const { data, error } = await supabase.from('modules').select('*').eq('subject_id', selSubject).order('order_index')
    if (data) setModules(data)
    toast.success(editingMod ? 'Module updated!' : 'Module added!')
    setMsg(editingMod ? 'Module updated!' : 'Module added!')
    setSavingMod(false)
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
    setSavingTopic(true)
    if (editingTopic) {
      const { error } = await supabase.from('topics').update({ title: topicTitle.trim(), description: topicDesc.trim() }).eq('id', editingTopic)
      if (error) { setMsg('Error: ' + error.message); setSavingTopic(false); return }
      setEditingTopic(null)
    } else {
      const { error } = await supabase.from('topics').insert({ module_id: selModule, title: topicTitle.trim(), description: topicDesc.trim(), order_index: topics.length })
      if (error) { setMsg('Error: ' + error.message); setSavingTopic(false); return }
    }
    setTopicTitle(''); setTopicDesc('')
    const { data, error } = await supabase.from('topics').select('*').eq('module_id', selModule).order('order_index')
    if (error) { setMsg('Error loading topics: ' + error.message); setSavingTopic(false); return }
    if (data) setTopics(data)
    toast.success(editingTopic ? 'Topic updated!' : 'Topic added!')
    setMsg(editingTopic ? 'Topic updated!' : 'Topic added!')
    setSavingTopic(false)
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
      {msg && <div className="admin-msg-toast"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>{msg}<button className="admin-msg-close" onClick={() => setMsg('')}>×</button></div>}

      <div className="admin-tabs">
        <button className={'admin-tab' + (tab === 'questions' ? ' active' : '')} onClick={() => setTab('questions')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          QUESTIONS
          {questions.length > 0 && <span className="admin-tab-badge">{questions.length}</span>}
        </button>
        <button className={'admin-tab' + (tab === 'users' ? ' active' : '')} onClick={() => setTab('users')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          USERS
          {users.length > 0 && <span className="admin-tab-badge">{users.length}</span>}
        </button>
        <button className={'admin-tab' + (tab === 'stats' ? ' active' : '')} onClick={() => setTab('stats')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          STATS
        </button>
        <button className={'admin-tab' + (tab === 'notify' ? ' active' : '')} onClick={() => setTab('notify')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>
          NOTIFY
        </button>
      </div>

      {tab === 'users' && (
        <div className="admin-users-wrap">
          <div className="admin-users-toolbar">
            <div className="admin-search-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="admin-search-input" placeholder="Search by name or email..." value={userSearch} onChange={e => setUserSearch(e.target.value)} />
              {userSearch && <button className="admin-search-clear" onClick={() => setUserSearch('')}>×</button>}
            </div>
            <div className="admin-role-filters">
              {['all', 'owner', 'admin', 'user'].map(r => (
                <button
                  key={r}
                  className={'admin-role-filter' + (userRoleFilter === r ? ' active' : '')}
                  onClick={() => setUserRoleFilter(r)}
                >
                  {r.toUpperCase()}
                  <span className="admin-role-filter-count">
                    {r === 'all' ? users.length : users.filter(u => (u.role || 'user') === r).length}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="admin-users">
            <div className="admin-users-header">
              <span className="admin-usr-h">User</span>
              <span className="admin-usr-h">Tests</span>
              <span className="admin-usr-h">Correct</span>
              <span className="admin-usr-h">Avg</span>
              <span className="admin-usr-h">Role</span>
            </div>
            {(() => {
              const filtered = users.filter(u => {
                if (userRoleFilter !== 'all' && (u.role || 'user') !== userRoleFilter) return false
                if (userSearch.trim()) {
                  const q = userSearch.toLowerCase()
                  return (u.display_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q)
                }
                return true
              })
              if (filtered.length === 0) {
                return <div className="admin-empty">No users match.</div>
              }
              return filtered.map(u => {
                const displayName = u.display_name || (u.email ? u.email.split('@')[0] : '—')
                const initial = (displayName || '?').charAt(0).toUpperCase()
                const avatarColors = ['admin-stat-lavender', 'admin-stat-peach', 'admin-stat-green', 'admin-stat-yellow', 'admin-stat-pink']
                const avatarColor = avatarColors[displayName.charCodeAt(0) % avatarColors.length]
                return (
                  <div key={u.id} className="admin-users-row">
                    <span className="admin-usr-c admin-usr-user">
                      <span className={'admin-usr-avatar ' + avatarColor}>{initial}</span>
                      <span className="admin-usr-info">
                        <span className="admin-usr-name">{displayName}</span>
                        {u.email && <span className="admin-usr-email">{u.email}</span>}
                      </span>
                    </span>
                    <span className="admin-usr-c admin-usr-num">{u.tests}</span>
                    <span className="admin-usr-c admin-usr-num">{u.score}/{u.total}</span>
                    <span className="admin-usr-c">
                      <span className={'admin-usr-pct ' + (u.total > 0 && u.score / u.total >= 0.7 ? 'high' : u.total > 0 && u.score / u.total >= 0.4 ? 'mid' : 'low')}>{pct(u.score, u.total)}</span>
                    </span>
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
                )
              })
            })()}
          </div>
        </div>
      )}

      {tab === 'stats' && stats && (
        <div className="admin-stats">
          <div className="admin-stat-grid">
            <div className="admin-stat-card admin-stat-lavender">
              <div className="admin-stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              </div>
              <div className="admin-stat-val">{stats.totalTests}</div>
              <div className="admin-stat-lbl">Total Tests</div>
            </div>
            <div className="admin-stat-card admin-stat-peach">
              <div className="admin-stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              </div>
              <div className="admin-stat-val">{pct(stats.totalScore, stats.totalTotal)}</div>
              <div className="admin-stat-lbl">Average Score</div>
            </div>
            <div className="admin-stat-card admin-stat-green">
              <div className="admin-stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div className="admin-stat-val">{stats.totalUsers}</div>
              <div className="admin-stat-lbl">Total Users</div>
            </div>
            <div className="admin-stat-card admin-stat-yellow">
              <div className="admin-stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <div className="admin-stat-val">{stats.totalToday}</div>
              <div className="admin-stat-lbl">Today's Tests</div>
            </div>
          </div>

          <div className="admin-stats-row-grid">
            <div className="admin-stat-block">
              <div className="admin-stat-block-title">
                <span>Last 7 Days</span>
                <span className="admin-stat-block-hint">{stats.weekBuckets ? Object.values(stats.weekBuckets).reduce((a, b) => a + b.count, 0) : 0} tests</span>
              </div>
              <div className="admin-week-chart">
                {Object.entries(stats.weekBuckets || {}).map(([day, d]) => {
                  const maxCount = Math.max(1, ...Object.values(stats.weekBuckets).map(b => b.count))
                  const h = (d.count / maxCount) * 100
                  const dt = new Date(day)
                  return (
                    <div key={day} className="admin-week-col">
                      <div className="admin-week-val">{d.count || ''}</div>
                      <div className="admin-week-bar-wrap">
                        <div className="admin-week-bar" style={{ height: Math.max(h, d.count > 0 ? 8 : 2) + '%' }}></div>
                      </div>
                      <div className="admin-week-day">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dt.getDay()]}</div>
                      <div className="admin-week-date">{dt.getDate()}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="admin-stat-block">
              <div className="admin-stat-block-title">
                <span>By Subject</span>
              </div>
              <div className="admin-subj-list">
                {Object.entries(stats.subjectCounts).sort((a, b) => b[1].count - a[1].count).map(([subj, s], i) => {
                  const colors = ['admin-stat-lavender', 'admin-stat-peach', 'admin-stat-green', 'admin-stat-yellow', 'admin-stat-pink']
                  const colorClass = colors[i % colors.length]
                  return (
                    <div key={subj} className="admin-subj-item">
                      <div className="admin-subj-head">
                        <span className={'admin-subj-dot ' + colorClass}></span>
                        <span className="admin-subj-name">{subj}</span>
                        <span className="admin-subj-pct">{pct(s.score, s.total)}</span>
                      </div>
                      <div className="admin-subj-bar-bg">
                        <div className={'admin-subj-bar-fill ' + colorClass} style={{ width: (s.total > 0 ? (s.score / s.total * 100) : 0) + '%' }}></div>
                      </div>
                      <div className="admin-subj-meta">
                        <span>{s.count} tests</span>
                        {s.today > 0 && <span className="admin-subj-today">+{s.today} today</span>}
                      </div>
                    </div>
                  )
                })}
                {Object.keys(stats.subjectCounts).length === 0 && (
                  <div className="admin-empty">No tests taken yet</div>
                )}
              </div>
            </div>
          </div>

          <div className="admin-stats-row-grid">
            <div className="admin-stat-block">
              <div className="admin-stat-block-title">
                <span>Top Users</span>
                <span className="admin-stat-block-hint">by tests taken</span>
              </div>
              <div className="admin-top-users">
                {stats.topUsers.length === 0 ? (
                  <div className="admin-empty">No data yet</div>
                ) : stats.topUsers.map((u, i) => (
                  <div key={u.id} className="admin-top-user">
                    <span className="admin-top-rank">#{i + 1}</span>
                    <div className="admin-top-avatar">{(u.name || '?').charAt(0).toUpperCase()}</div>
                    <div className="admin-top-info">
                      <div className="admin-top-name">{u.name}</div>
                      <div className="admin-top-tests">{u.tests} tests &middot; {pct(u.score, u.total)} avg</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-stat-block">
              <div className="admin-stat-block-title">
                <span>Recent Tests</span>
              </div>
              <div className="admin-recent">
                {stats.recent.length === 0 ? (
                  <div className="admin-empty">No tests yet</div>
                ) : stats.recent.map((t, i) => {
                  const u = stats.topUsers ? allProfilesById?.[t.user_id] : null
                  return (
                    <div key={i} className="admin-recent-item">
                      <div className={'admin-recent-pct ' + (t.score / t.total >= 0.7 ? 'high' : t.score / t.total >= 0.4 ? 'mid' : 'low')}>
                        {t.total > 0 ? Math.round(t.score / t.total * 100) : 0}%
                      </div>
                      <div className="admin-recent-info">
                        <div className="admin-recent-subj">{t.subject || 'General'}</div>
                        <div className="admin-recent-meta">{t.score}/{t.total} &middot; {new Date(t.taken_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
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
            <button className={'admin-tab' + (qtab === 'modules' ? ' active' : '')} onClick={() => setQtab('modules')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              MODULES
              {modules.length > 0 && <span className="admin-tab-badge">{modules.length}</span>}
            </button>
            <button className={'admin-tab' + (qtab === 'topic' ? ' active' : '')} onClick={() => setQtab('topic')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              TOPICS
              {topics.length > 0 && <span className="admin-tab-badge">{topics.length}</span>}
            </button>
            <button className={'admin-tab' + (qtab === 'question' ? ' active' : '')} onClick={() => setQtab('question')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              QUESTIONS
              {questions.length > 0 && <span className="admin-tab-badge">{questions.length}</span>}
            </button>
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
                  <input className="admin-input" type="number" min="0" value={modLessons} onChange={e => setModLessons(Number(e.target.value))} placeholder="Lessons" style={{ width: '40%' }} />
                  <input className="admin-input" value={modDuration} onChange={e => setModDuration(e.target.value)} placeholder="Duration (e.g. 2 weeks)" style={{ width: '60%' }} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button className="btn-solid-black" onClick={handleAddModule} disabled={savingMod}>
                    {savingMod ? 'SAVING...' : (editingMod ? 'UPDATE MODULE' : 'ADD MODULE')}
                  </button>
                  {editingMod && <button className="btn-solid-black" style={{ background: 'transparent', color: '#000' }} onClick={() => { setEditingMod(null); setModTitle(''); setModDesc(''); setModLessons(0); setModDuration('') }}>CANCEL</button>}
                </div>
              </div>

              <div className="admin-layer" style={{ marginTop: '1rem' }}>
                <label className="admin-label">EXISTING MODULES ({modules.length})</label>
                {modules.length === 0 ? (
                  <div className="admin-empty">No modules yet.</div>
                ) : (
                  <div className="admin-card-list">
                    {modules.map((m, idx) => {
                      const colors = ['admin-stat-lavender', 'admin-stat-peach', 'admin-stat-green', 'admin-stat-yellow', 'admin-stat-pink']
                      const colorClass = colors[idx % colors.length]
                      return (
                        <div key={m.id} className={'admin-card-item ' + colorClass}>
                          <div className="admin-card-num">#{idx + 1}</div>
                          <div className="admin-card-body">
                            <div className="admin-card-title">{m.title}</div>
                            <div className="admin-card-desc">{m.description || 'No description'}</div>
                            <div className="admin-card-meta">
                              {m.duration && <span className="admin-card-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> {m.duration}</span>}
                              {m.lesson_count > 0 && <span className="admin-card-tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> {m.lesson_count} lessons</span>}
                            </div>
                          </div>
                          <div className="admin-card-actions">
                            <button className="admin-icon-btn" onClick={() => editModule(m)} title="Edit">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                            </button>
                            <button className="admin-icon-btn admin-icon-btn-danger" onClick={() => deleteModule(m.id)} title="Delete">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
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
                  <button className="btn-solid-black" onClick={handleAddTopic} disabled={savingTopic}>
                    {savingTopic ? 'SAVING...' : (editingTopic ? 'UPDATE TOPIC' : 'ADD TOPIC')}
                  </button>
                  {editingTopic && <button className="btn-solid-black" style={{ background: 'transparent', color: '#000' }} onClick={() => { setEditingTopic(null); setTopicTitle(''); setTopicDesc('') }}>CANCEL</button>}
                </div>
              </div>

              {topics.length > 0 && (
                <div className="admin-layer">
                  <label className="admin-label">EXISTING TOPICS ({topics.length})</label>
                  <div className="admin-card-list">
                    {topics.map((t, idx) => {
                      const colors = ['admin-stat-lavender', 'admin-stat-peach', 'admin-stat-green', 'admin-stat-yellow', 'admin-stat-pink']
                      const colorClass = colors[idx % colors.length]
                      return (
                        <div key={t.id} className={'admin-card-item ' + colorClass} onClick={() => { setSelTopic(t.id); setQtab('question') }} style={{ cursor: 'pointer' }}>
                          <div className="admin-card-num">#{idx + 1}</div>
                          <div className="admin-card-body">
                            <div className="admin-card-title">{t.title}</div>
                            <div className="admin-card-desc">{t.description || 'Click to manage questions →'}</div>
                          </div>
                          <div className="admin-card-actions" onClick={e => e.stopPropagation()}>
                            <button className="admin-icon-btn" onClick={() => editTopic(t)} title="Edit">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                            </button>
                            <button className="admin-icon-btn admin-icon-btn-danger" onClick={() => deleteTopic(t.id)} title="Delete">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
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
                      <label className="admin-toggle-label">
                        <span className="admin-toggle-text">Question in image (no text)</span>
                        <span className={'admin-toggle' + (noText ? ' on' : '')} onClick={() => setNoText(!noText)}>
                          <span className="admin-toggle-knob" />
                        </span>
                        <span className="admin-toggle-state">{noText ? 'YES' : 'NO'}</span>
                      </label>
                    </div>
                    <div className="admin-no-text-row" style={{ marginTop: '0.3rem' }}>
                      <label className="admin-toggle-label">
                        <span className="admin-toggle-text">Split layout (two columns)</span>
                        <span className={'admin-toggle' + (layoutSplit ? ' on' : '')} onClick={() => {
                          const next = !layoutSplit
                          setLayoutSplit(next)
                          localStorage.setItem('testLayout', next ? 'split' : 'centered')
                        }}>
                          <span className="admin-toggle-knob" />
                        </span>
                        <span className="admin-toggle-state">{layoutSplit ? 'YES' : 'NO'}</span>
                      </label>
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
