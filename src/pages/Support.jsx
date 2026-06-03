import { useState, useEffect } from 'react'
import { useLayout } from '../components/DashLayout'
import { supabase } from '../lib/supabaseClient'
import { useToast } from '../components/Toast'

const FAQ_DATA = [
  { q: 'How do I start a practice test?', a: 'Navigate to Practice Tests in the sidebar and select any available test to begin. You can choose from full-length SAT tests, AP subject tests, or individual module practices.' },
  { q: 'How is my SAT score calculated?', a: 'Your SAT score is calculated based on the number of correct answers in the Math section (200-800) and the Reading & Writing section (200-800). These two section scores are added together for your total score (400-1600).' },
  { q: 'Can I retake a practice test?', a: 'Yes, all practice tests can be retaken as many times as you want. Your highest score is automatically saved to your profile, and you can track your progress over time.' },
  { q: 'How do I upgrade to PRO?', a: 'Go to your Profile page from the sidebar and click "Upgrade to PRO". You will get access to unlimited practice tests, detailed analytics, personalized study plans, and priority support.' },
  { q: 'What subjects are available?', a: 'We currently offer SAT Math, SAT Reading & Writing, AP Biology, and AP Calculus. Each subject includes multiple modules, practice tests, and progress tracking.' },
  { q: 'How long does a full SAT test take?', a: 'A full digital SAT practice test takes approximately 2 hours and 14 minutes. The Math section is 70 minutes and the Reading & Writing section is 64 minutes.' },
  { q: 'Can I pause a test and resume later?', a: 'Yes, your progress is automatically saved. You can exit a test at any time and continue from where you left off by selecting the same test from Practice Tests.' },
  { q: 'How do I track my progress?', a: 'Your Dashboard shows your current scores, recent activity, and upcoming modules. The Profile page provides detailed analytics including skill breakdowns and score trends.' },
]

export default function Support() {
  const { setPageTitle, setPageSub, setPageClass } = useLayout()
  useEffect(() => { setPageTitle('SUPPORT'); setPageSub("We're here to help you succeed"); setPageClass('') }, [])
  const [openIndex, setOpenIndex] = useState(null)
  const [search, setSearch] = useState('')
  const [contact, setContact] = useState({ name: '', email: '', subject: '', message: '' })
  const toast = useToast()
  const [msg, setMsg] = useState('')

  const toggleFAQ = (i) => {
    setOpenIndex(openIndex === i ? null : i)
  }

  const submitContact = async () => {
    if (!contact.name || !contact.email || !contact.message) {
      setMsg('Please fill in all required fields.')
      toast.error('Please fill in all required fields.')
      setTimeout(() => setMsg(''), 3000)
      return
    }
    const body = `Name: ${contact.name}\nEmail: ${contact.email}\nSubject: ${contact.subject || 'N/A'}\n\nMessage:\n${contact.message}`
    window.location.href = `mailto:umrqulov8@gmail.com?subject=${encodeURIComponent(contact.subject || 'Support Request')}&body=${encodeURIComponent(body)}`
    setMsg('Redirecting to your email client...')
    setContact({ name: '', email: '', subject: '', message: '' })
    setTimeout(() => setMsg(''), 4000)
  }

  const filteredFAQ = FAQ_DATA.filter(item =>
    !search || item.q.toLowerCase().includes(search.toLowerCase()) || item.a.toLowerCase().includes(search.toLowerCase())
  )

  return (
      <><div className="support-hero settings-card">
        <div className="support-hero-inner">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input className="support-search" type="text" placeholder="SEARCH HELP TOPICS..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {msg && <div className="settings-toast" style={{ marginBottom: '1rem' }}>{msg}</div>}

      <div className="support-layout">
        <div className="support-faq">
          <h3 className="section-title" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>FREQUENTLY ASKED QUESTIONS</h3>
          <div className="faq-list settings-card" style={{ padding: 0 }}>
            {filteredFAQ.length === 0 ? (
              <div className="faq-empty">No results found for &quot;{search}&quot;</div>
            ) : filteredFAQ.map((item) => {
              const realIndex = FAQ_DATA.indexOf(item)
              return (
                <div key={realIndex} className={`faq-item${openIndex === realIndex ? ' open' : ''}`} onClick={() => toggleFAQ(realIndex)}>
                  <div className="faq-q-row">
                    <span className="faq-q">{item.q}</span>
                    <svg className="faq-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                  </div>
                  <div className={`faq-a-wrap${openIndex === realIndex ? ' open' : ''}`}>
                    <span className="faq-a">{item.a}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="support-side">
          <div className="settings-card support-side-card">
            <div className="support-side-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            </div>
            <span className="support-side-title">LIVE CHAT</span>
            <span className="support-side-desc">Chat with our team in real time</span>
            <button className="btn-support-side">START CHAT</button>
          </div>
          <div className="settings-card support-side-card">
            <div className="support-side-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
            </div>
            <span className="support-side-title">GUIDES</span>
            <span className="support-side-desc">Step-by-step tutorials & resources</span>
            <button className="btn-support-side">VIEW GUIDES</button>
          </div>
          <a href="mailto:umrqulov8@gmail.com" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="settings-card support-side-card">
              <div className="support-side-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
              </div>
              <span className="support-side-title">CONTACT US</span>
              <span className="support-side-desc">umrqulov8@gmail.com</span>
              <button className="btn-support-side">SEND EMAIL</button>
            </div>
          </a>
        </div>
      </div>

      <h2 className="section-title" style={{ marginTop: '2.5rem' }}>SEND US A MESSAGE</h2>

      <div className="settings-card support-contact">
        <div className="contact-form-grid">
          <div className="settings-field">
            <label className="settings-label">YOUR NAME</label>
            <input className="settings-input" type="text" placeholder="Enter your name" value={contact.name} onChange={e => setContact({ ...contact, name: e.target.value })} />
          </div>
          <div className="settings-field">
            <label className="settings-label">YOUR EMAIL</label>
            <input className="settings-input" type="email" placeholder="Enter your email" value={contact.email} onChange={e => setContact({ ...contact, email: e.target.value })} />
          </div>
        </div>
        <div className="settings-field" style={{ marginTop: '1rem' }}>
          <label className="settings-label">SUBJECT</label>
          <input className="settings-input" type="text" placeholder="What is this about?" value={contact.subject} onChange={e => setContact({ ...contact, subject: e.target.value })} />
        </div>
        <div className="settings-field" style={{ marginTop: '1rem' }}>
          <label className="settings-label">MESSAGE</label>
          <textarea className="settings-input support-textarea" rows={4} placeholder="Describe your issue or question in detail..." value={contact.message} onChange={e => setContact({ ...contact, message: e.target.value })} />
        </div>
        <button className="btn-settings" style={{ marginTop: '1.25rem' }} onClick={submitContact}>SUBMIT TICKET</button>
      </div>
    </>
  )
}
