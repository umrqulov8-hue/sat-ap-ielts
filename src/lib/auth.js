import { getSession, setSession, onAuthStateChange } from './session'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

function anonHeaders() {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  }
}

function authHeaders(accessToken) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

async function handleAuthResponse(res) {
  const data = await res.json()
  if (!res.ok) {
    const msg =
      data.msg || data.error_description || data.error || data.message || 'Authentication error'
    return { data: null, error: { message: msg } }
  }
  if (data.access_token) {
    const session = {
      access_token: data.access_token,
      token_type: data.token_type || 'bearer',
      expires_in: data.expires_in,
      expires_at: data.expires_at,
      refresh_token: data.refresh_token,
      user: data.user,
    }
    setSession(session)
  }
  return { data, error: null }
}

export async function signUp({ email, password, options }) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: anonHeaders(),
    body: JSON.stringify({ email, password, data: options?.data }),
  })
  return handleAuthResponse(res)
}

export async function signInWithPassword({ email, password }) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: anonHeaders(),
    body: JSON.stringify({ email, password }),
  })
  return handleAuthResponse(res)
}

export async function signOut() {
  const { data: { session } } = await getSession()
  if (session?.access_token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: authHeaders(session.access_token),
    })
  }
  setSession(null)
  return { error: null }
}

export async function updateUser(attributes) {
  const { data: { session } } = await getSession()
  if (!session?.access_token) return { data: null, error: { message: 'No session' } }
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: authHeaders(session.access_token),
    body: JSON.stringify(attributes),
  })
  const data = await res.json()
  if (!res.ok) {
    return { data: null, error: { message: data.msg || data.error_description || 'Update failed' } }
  }
  if (data) {
    const newSession = { ...session, user: { ...session.user, ...data } }
    setSession(newSession)
  }
  return { data, error: null }
}

export async function resetPasswordForEmail(email, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
    method: 'POST',
    headers: anonHeaders(),
    body: JSON.stringify({ email, redirect_to: options.redirectTo }),
  })
  if (!res.ok) {
    const data = await res.json()
    return { data: null, error: { message: data.msg || data.error_description || 'Reset failed' } }
  }
  return { data: {}, error: null }
}

export { getSession, onAuthStateChange }
