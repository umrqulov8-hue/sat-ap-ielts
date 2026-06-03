const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const STORAGE_KEY = 'satap_session'

let currentSession = null
let listeners = []
let refreshPromise = null
let refreshTimer = null

function notify(event, session) {
  listeners.forEach(fn => {
    try { fn(event, session) } catch (e) { console.error(e) }
  })
}

function persist(session) {
  if (session?.refresh_token) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } else if (!session) {
    localStorage.removeItem(STORAGE_KEY)
  }
}

async function fetchUser(accessToken) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  })
  if (!res.ok) return null
  return res.json()
}

async function doRefresh(refreshToken) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  if (!res.ok) {
    currentSession = null
    persist(null)
    return null
  }
  const data = await res.json()
  if (!data.user) data.user = await fetchUser(data.access_token)
  currentSession = data
  persist(data)
  scheduleRefresh(data)
  return data
}

function scheduleRefresh(session) {
  if (refreshTimer) clearTimeout(refreshTimer)
  if (!session?.expires_in) return
  const ms = (session.expires_in - 60) * 1000
  refreshTimer = setTimeout(() => {
    if (session.refresh_token) {
      doRefresh(session.refresh_token).then(s => {
        if (s) notify('TOKEN_REFRESHED', s)
      })
    }
  }, Math.max(ms, 10000))
}

function parseHash() {
  const hash = window.location.hash.substring(1)
  if (!hash || !hash.includes('access_token')) return null
  const params = new URLSearchParams(hash)
  const access_token = params.get('access_token')
  const refresh_token = params.get('refresh_token')
  const expires_in = params.get('expires_in')
  const expires_at = params.get('expires_at')
  const token_type = params.get('token_type')
  if (!access_token) return null
  return { access_token, refresh_token, expires_in: expires_in ? parseInt(expires_in) : 3600, expires_at: expires_at ? parseInt(expires_at) : null, token_type }
}

export async function getSession() {
  if (currentSession) return { data: { session: currentSession } }
  if (window.location.hash && window.location.hash.includes('access_token')) {
    const partial = parseHash()
    if (partial) {
      const user = await fetchUser(partial.access_token)
      const session = { ...partial, user }
      currentSession = session
      persist(session)
      scheduleRefresh(session)
      window.history.replaceState(null, '', window.location.pathname)
      return { data: { session } }
    }
  }
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      if (parsed.expires_at && parsed.expires_at * 1000 < Date.now()) {
        if (parsed.refresh_token) {
          if (!refreshPromise) refreshPromise = doRefresh(parsed.refresh_token).finally(() => { refreshPromise = null })
          const result = await refreshPromise
          return { data: { session: result || null } }
        }
        persist(null)
        return { data: { session: null } }
      }
      currentSession = parsed
      scheduleRefresh(parsed)
      return { data: { session: parsed } }
    } catch (e) {
      persist(null)
    }
  }
  return { data: { session: null } }
}

export function getAccessToken() {
  return currentSession?.access_token || null
}

export function setSession(session) {
  currentSession = session
  if (session) {
    persist(session)
    scheduleRefresh(session)
    notify('SIGNED_IN', session)
  } else {
    persist(null)
    if (refreshTimer) clearTimeout(refreshTimer)
    notify('SIGNED_OUT', null)
  }
}

export function clearSession() {
  setSession(null)
}

export function onAuthStateChange(callback) {
  listeners.push(callback)
  if (currentSession) {
    try { callback('INITIAL_SESSION', currentSession) } catch (e) { console.error(e) }
  }
  return {
    data: {
      subscription: {
        unsubscribe: () => {
          listeners = listeners.filter(l => l !== callback)
        },
      },
    },
  }
}

export function getCurrentSession() {
  return currentSession
}
