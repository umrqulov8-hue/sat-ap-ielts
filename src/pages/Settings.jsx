import { useEffect, useState, useCallback } from 'react'
import { useLayout } from '../components/DashLayout'
import { supabase } from '../lib/supabaseClient'
import { useToast } from '../components/Toast'
import { useUser } from '../context/UserContext'
import { useTranslation } from 'react-i18next'

export default function Settings() {
  const { setPageTitle, setPageSub, setPageClass } = useLayout()
  const { refreshUser } = useUser()
  const { t } = useTranslation()

  const [account, setAccount] = useState({ name: 'STUDENT', email: '', lang: 'EN' })
  const [notifs, setNotifs] = useState({ digest: false, reminders: true })
  const [pwd, setPwd] = useState({ current: '', newPwd: '', confirm: '' })
  const [msg, setMsg] = useState('')
  const toast = useToast()
  const [loading, setLoading] = useState(true)

  const loadSettings = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return

    if (user.email) setAccount(a => ({ ...a, email: user.email }))

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    if (prof) setAccount(a => ({ ...a, name: prof.display_name || 'STUDENT', lang: prof.lang || 'EN' }))

    const { data: settings } = await supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle()
    if (settings) setNotifs({
      digest: settings.weekly_digest ?? false,
      reminders: settings.reminder_time ? true : false,
    })
  }, [])

  useEffect(() => {
    setPageTitle(t('settings_title'))
    setPageSub(t('fetching_settings'))
    setPageClass('')
    loadSettings().finally(() => setLoading(false))
  }, [setPageTitle, setPageSub, setPageClass, loadSettings, t])

  const showMsg = (text) => { setMsg(text); setTimeout(() => setMsg(''), 2500) }



  const saveAccount = async (e) => {
    if (e) e.preventDefault()
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    const { error } = await supabase.from('profiles').update({ display_name: account.name, lang: account.lang }).eq('id', user.id)
    if (error) {
      toast.error(error.message)
      return
    }
    showMsg('Account info saved!')
    refreshUser()
  }

  const saveNotifs = async (e) => {
    if (e) e.preventDefault()
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    const { error } = await supabase.from('user_settings').upsert({
      user_id: user.id,
      weekly_digest: notifs.digest,
      reminder_time: notifs.reminders ? '10:00' : null,
    }, { onConflict: 'user_id' })
    if (error) {
      toast.error(error.message)
    } else {
      showMsg('Notification preferences saved!')
    }
  }

  const savePwd = async (e) => {
    if (e) e.preventDefault()
    if (!pwd.newPwd) { toast.error('Enter a new password'); return }
    if (pwd.newPwd.length < 6) { toast.error('Password must be at least 6 characters'); return }
    if (pwd.newPwd !== pwd.confirm) { toast.error('Passwords do not match'); return }
    const { error } = await supabase.auth.updateUser({ password: pwd.newPwd })
    if (error) { toast.error(error.message); return }
    setPwd({ current: '', newPwd: '', confirm: '' })
    showMsg('Password updated!')
  }

  return (
    <>{loading ? (
      <div className="module-row">
        <div className="module-inner">
          <div className="module-left"><div className="module-info"><div className="module-name">{t('loading')}</div><div className="module-desc">{t('fetching_settings')}</div></div></div>
        </div>
      </div>
    ) : (
    <><h2 className="section-title">{t('settings_title')}</h2>
    {msg && <div className="settings-toast">{msg}</div>}

    <div className="settings-grid">
      <form className="settings-card" onSubmit={saveAccount}>
        <div className="settings-card-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          <span>{t('account_info')}</span>
        </div>
        <div className="settings-fields">
          <div className="settings-field">
            <label className="settings-label">{t('full_name')}</label>
            <input className="settings-input" type="text" value={account.name} onChange={e => setAccount({ ...account, name: e.target.value })} />
          </div>
          <div className="settings-field">
            <label className="settings-label">{t('email_address')}</label>
            <input className="settings-input" type="email" value={account.email} disabled />
          </div>
          <div className="settings-field">
            <label className="settings-label">{t('language')}</label>
            <select className="settings-input" value={account.lang} onChange={e => setAccount({ ...account, lang: e.target.value })}>
              <option value="EN">EN</option>
              <option value="UZ">UZ</option>
              <option value="RU">RU</option>
            </select>
          </div>
        </div>
        <button type="submit" className="btn-settings">{t('save_changes')}</button>
      </form>

      <form className="settings-card" onSubmit={saveNotifs}>
        <div className="settings-card-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
          <span>{t('notifications')}</span>
        </div>
        <div className="settings-toggles">

          <div className="settings-toggle-row">
            <span className="settings-toggle-label">{t('weekly_digest')}</span>
            <label className="toggle-switch">
              <input type="checkbox" checked={notifs.digest} onChange={e => setNotifs({ ...notifs, digest: e.target.checked })} />
              <span className="toggle-slider" />
            </label>
          </div>
          <div className="settings-toggle-row">
            <span className="settings-toggle-label">{t('test_reminders')}</span>
            <label className="toggle-switch">
              <input type="checkbox" checked={notifs.reminders} onChange={e => setNotifs({ ...notifs, reminders: e.target.checked })} />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>
        <button type="submit" className="btn-settings">{t('save_prefs')}</button>
      </form>
    </div>

    <h2 className="section-title" style={{ marginTop: '2rem' }}>{t('security')}</h2>

    <div className="settings-grid">
      <form className="settings-card" onSubmit={savePwd}>
        <div className="settings-card-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          <span>{t('change_password')}</span>
        </div>
        <div className="settings-fields">
          <div className="settings-field">
            <label className="settings-label">{t('current_pwd')}</label>
            <input className="settings-input" type="password" value={pwd.current} onChange={e => setPwd({ ...pwd, current: e.target.value })} placeholder="********" />
          </div>
          <div className="settings-field">
            <label className="settings-label">{t('new_pwd')}</label>
            <input className="settings-input" type="password" value={pwd.newPwd} onChange={e => setPwd({ ...pwd, newPwd: e.target.value })} placeholder="*********" />
          </div>
          <div className="settings-field">
            <label className="settings-label">{t('confirm_pwd')}</label>
            <input className="settings-input" type="password" value={pwd.confirm} onChange={e => setPwd({ ...pwd, confirm: e.target.value })} placeholder="*********" />
          </div>
        </div>
        <button type="submit" className="btn-settings">{t('update_pwd')}</button>
      </form>
    </div>
  </>)}
  </>
  )
}
