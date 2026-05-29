import { useEffect, useState, useCallback } from 'react'
import { useLayout } from '../components/DashLayout'
import { supabase } from '../lib/supabaseClient'
import { registerServiceWorker, subscribeToPush, unsubscribeFromPush } from '../lib/pushNotifications'
import { useToast } from '../components/Toast'

export default function Settings() {
  const { setPageTitle, setPageSub, setPageClass } = useLayout()

  const [account, setAccount] = useState({ name: 'STUDENT', email: '', lang: 'EN' })
  const [notifs, setNotifs] = useState({ email_notifications: true, push_notifications: true, digest: false, reminders: true })
  const [pwd, setPwd] = useState({ current: '', newPwd: '', confirm: '' })
  const [twoFA, setTwoFA] = useState({ enabled: false, method: 'AUTH', requireLogin: false })
  const [msg, setMsg] = useState('')
  const toast = useToast()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setPageTitle('SETTINGS')
    setPageSub('Manage your account preferences')
    setPageClass('')
    loadSettings().finally(() => setLoading(false))
  }, [])

  const loadSettings = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return

    if (user.email) setAccount(a => ({ ...a, email: user.email }))

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    if (prof) setAccount(a => ({ ...a, name: prof.display_name || 'STUDENT', lang: prof.lang || 'EN' }))

    const { data: settings } = await supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle()
    if (settings) setNotifs({
      email_notifications: settings.email_notifications ?? true,
      push_notifications: settings.push_notifications ?? true,
      digest: settings.weekly_digest ?? false,
      reminders: settings.reminder_time ? true : false,
    })
  }

  const showMsg = (text) => { setMsg(text); setTimeout(() => setMsg(''), 2500) }

  const togglePush = useCallback(async (enabled) => {
    setNotifs(prev => ({ ...prev, push_notifications: enabled }))
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return

    if (enabled) {
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission()
      }
      const reg = await registerServiceWorker()
      if (reg) await subscribeToPush(reg)
      showMsg('Push notifications enabled!')
    } else {
      await unsubscribeFromPush()
      showMsg('Push notifications disabled')
    }

    await supabase.from('user_settings').update({
      push_notifications: enabled,
    }).eq('user_id', user.id)
  }, [])

  const saveAccount = async () => {
    showMsg('Account info saved!')
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    await supabase.from('profiles').update({ display_name: account.name }).eq('id', user.id)
  }

  const saveNotifs = async () => {
    showMsg('Notification preferences saved!')
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    const { error } = await supabase.from('user_settings').update({
      email_notifications: notifs.email_notifications,
      push_notifications: notifs.push_notifications,
      reminder_time: notifs.reminders ? '10:00' : null,
    }).eq('user_id', user.id)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Notification preferences saved!')
    }
  }

  const savePwd = async () => {
    if (!pwd.newPwd) { showMsg('Enter a new password'); return }
    if (pwd.newPwd.length < 6) { showMsg('Password must be at least 6 characters'); return }
    if (pwd.newPwd !== pwd.confirm) { showMsg('Passwords do not match'); return }
    const { error } = await supabase.auth.updateUser({ password: pwd.newPwd })
    if (error) { showMsg(error.message); return }
    setPwd({ current: '', newPwd: '', confirm: '' })
    showMsg('Password updated!')
  }

  const toggle2FA = () => {
    setTwoFA({ ...twoFA, enabled: !twoFA.enabled })
    showMsg(twoFA.enabled ? '2FA disabled' : '2FA enabled! (Requires Supabase MFA setup)')
  }

  return (
    <>{loading ? (
      <div className="module-row shadow-wrap"><div className="shadow-box" />
        <div className="module-inner">
          <div className="module-left"><div><div className="module-name">Loading...</div><div className="module-desc">Fetching your settings</div></div></div>
        </div>
      </div>
    ) : (
    <><h2 className="section-title">PROFILE SETTINGS.</h2>
    {msg && <div className="settings-toast">{msg}</div>}

    <div className="settings-grid">
      <div className="shadow-wrap">
        <div className="shadow-box" />
        <div className="settings-card">
          <div className="settings-card-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            <span>ACCOUNT INFO</span>
          </div>
          <div className="settings-fields">
            <div className="settings-field">
              <label className="settings-label">FULL NAME</label>
              <input className="settings-input" type="text" value={account.name} onChange={e => setAccount({ ...account, name: e.target.value })} />
            </div>
            <div className="settings-field">
              <label className="settings-label">EMAIL ADDRESS</label>
              <input className="settings-input" type="email" value={account.email} disabled />
            </div>
            <div className="settings-field">
              <label className="settings-label">LANGUAGE</label>
              <select className="settings-input" value={account.lang} onChange={e => setAccount({ ...account, lang: e.target.value })}>
                <option value="EN">EN</option>
                <option value="UZ">UZ</option>
                <option value="RU">RU</option>
              </select>
            </div>
          </div>
          <button className="btn-settings" onClick={saveAccount}>SAVE CHANGES</button>
        </div>
      </div>

      <div className="shadow-wrap">
        <div className="shadow-box" />
        <div className="settings-card">
          <div className="settings-card-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
            <span>NOTIFICATIONS</span>
          </div>
          <div className="settings-toggles">
            <div className="settings-toggle-row">
              <span className="settings-toggle-label">EMAIL NOTIFICATIONS</span>
              <label className="toggle-switch">
                <input type="checkbox" checked={notifs.email_notifications} onChange={e => setNotifs({ ...notifs, email_notifications: e.target.checked })} />
                <span className="toggle-slider" />
              </label>
            </div>
            <div className="settings-toggle-row">
              <span className="settings-toggle-label">PUSH NOTIFICATIONS</span>
              <label className="toggle-switch">
                <input type="checkbox" checked={notifs.push_notifications} onChange={e => togglePush(e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </div>
            <div className="settings-toggle-row">
              <span className="settings-toggle-label">WEEKLY DIGEST</span>
              <label className="toggle-switch">
                <input type="checkbox" checked={notifs.digest} onChange={e => setNotifs({ ...notifs, digest: e.target.checked })} />
                <span className="toggle-slider" />
              </label>
            </div>
            <div className="settings-toggle-row">
              <span className="settings-toggle-label">TEST REMINDERS</span>
              <label className="toggle-switch">
                <input type="checkbox" checked={notifs.reminders} onChange={e => setNotifs({ ...notifs, reminders: e.target.checked })} />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>
          <button className="btn-settings" onClick={saveNotifs}>SAVE PREFERENCES</button>
        </div>
      </div>
    </div>

    <h2 className="section-title" style={{ marginTop: '2rem' }}>SECURITY.</h2>

    <div className="settings-grid">
      <div className="shadow-wrap">
        <div className="shadow-box" />
        <div className="settings-card">
          <div className="settings-card-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            <span>CHANGE PASSWORD</span>
          </div>
          <div className="settings-fields">
            <div className="settings-field">
              <label className="settings-label">CURRENT PASSWORD</label>
              <input className="settings-input" type="password" value={pwd.current} onChange={e => setPwd({ ...pwd, current: e.target.value })} placeholder="********" />
            </div>
            <div className="settings-field">
              <label className="settings-label">NEW PASSWORD</label>
              <input className="settings-input" type="password" value={pwd.newPwd} onChange={e => setPwd({ ...pwd, newPwd: e.target.value })} placeholder="Enter new password" />
            </div>
            <div className="settings-field">
              <label className="settings-label">CONFIRM NEW PASSWORD</label>
              <input className="settings-input" type="password" value={pwd.confirm} onChange={e => setPwd({ ...pwd, confirm: e.target.value })} placeholder="Confirm new password" />
            </div>
          </div>
          <button className="btn-settings" onClick={savePwd}>UPDATE PASSWORD</button>
        </div>
      </div>

      <div className="shadow-wrap">
        <div className="shadow-box" />
        <div className="settings-card">
          <div className="settings-card-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            <span>TWO-FACTOR AUTH</span>
          </div>
          <div className="settings-fields">
            <div className="settings-2fa-status">
              <div className={`2fa-indicator${twoFA.enabled ? ' enabled' : ''}`}>
                <div className={`2fa-dot${twoFA.enabled ? ' active' : ''}`} />
                <span>{twoFA.enabled ? 'ENABLED' : 'NOT ENABLED'}</span>
              </div>
              <p className="settings-2fa-desc">Add an extra layer of security to your account by requiring a verification code in addition to your password.</p>
            </div>
            <div className="settings-field">
              <label className="settings-label">VERIFICATION METHOD</label>
              <select className="settings-input" value={twoFA.method} onChange={e => setTwoFA({ ...twoFA, method: e.target.value })}>
                <option value="AUTH">AUTHENTICATOR APP</option>
                <option value="SMS">SMS CODE</option>
                <option value="EMAIL">EMAIL CODE</option>
              </select>
            </div>
            <div className="settings-toggle-row">
              <span className="settings-toggle-label">REQUIRE ON EVERY LOGIN</span>
              <label className="toggle-switch">
                <input type="checkbox" checked={twoFA.requireLogin} onChange={e => setTwoFA({ ...twoFA, requireLogin: e.target.checked })} />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>
          <button className="btn-settings" onClick={toggle2FA}>{twoFA.enabled ? 'DISABLE 2FA' : 'ENABLE 2FA'}</button>
        </div>
      </div>
    </div>
  </>)}
  </>
  )
}
