import { getSession, onAuthStateChange, getAccessToken } from './session'
import { signUp, signInWithPassword, signOut, updateUser, resetPasswordForEmail } from './auth'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

function authHeaders() {
  const token = getAccessToken()
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }
}

function buildUrl(table, filters) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`)
  const sp = url.searchParams
  if (filters.select) sp.set('select', filters.select)
  else sp.set('select', '*')
  if (filters.eq) Object.entries(filters.eq).forEach(([k, v]) => sp.append(k, `eq.${v}`))
  if (filters.neq) Object.entries(filters.neq).forEach(([k, v]) => sp.append(k, `neq.${v}`))
  if (filters.gt) Object.entries(filters.gt).forEach(([k, v]) => sp.append(k, `gt.${v}`))
  if (filters.gte) Object.entries(filters.gte).forEach(([k, v]) => sp.append(k, `gte.${v}`))
  if (filters.lt) Object.entries(filters.lt).forEach(([k, v]) => sp.append(k, `lt.${v}`))
  if (filters.lte) Object.entries(filters.lte).forEach(([k, v]) => sp.append(k, `lte.${v}`))
  if (filters.like) Object.entries(filters.like).forEach(([k, v]) => sp.append(k, `like.${v}`))
  if (filters.ilike) Object.entries(filters.ilike).forEach(([k, v]) => sp.append(k, `ilike.${v}`))
  if (filters.is) Object.entries(filters.is).forEach(([k, v]) => sp.append(k, `is.${v}`))
  if (filters.in) Object.entries(filters.in).forEach(([k, v]) => sp.append(k, `in.(${Array.isArray(v) ? v.join(',') : v})`))
  if (filters.not) {
    Object.entries(filters.not).forEach(([k, v]) => {
      const op = Object.keys(v)[0]; const val = v[op]
      sp.append(k, `not.${op}.${val}`)
    })
  }
  if (filters.order) {
    const dir = filters.ascending === false ? '.desc' : '.asc'
    sp.append('order', `${filters.order}${dir}`)
  }
  if (filters.limit !== undefined) sp.set('limit', filters.limit)
  if (filters.offset !== undefined) sp.set('offset', filters.offset)
  return url
}

function queryBuilder(table) {
  const filters = {}
  let countOpts = null
  let selectStr = '*'
  let method = 'GET'
  let bodyData = null

  async function exec() {
    const headers = authHeaders()
    switch (method) {
      case 'UPSERT': {
        const onConflict = filters.upsertOpts?.onConflict
        let url = `${SUPABASE_URL}/rest/v1/${table}`
        if (onConflict) url += `?on_conflict=${onConflict}`
        const res = await fetch(url, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation,resolution=merge-duplicates' },
          body: JSON.stringify(Array.isArray(bodyData) ? bodyData : [bodyData]),
        })
        if (!res.ok) return { data: null, error: await res.json().catch(() => ({ message: res.statusText })) }
        return { data: await res.json(), error: null }
      }
      case 'DELETE': {
        const url = buildUrl(table, filters)
        const res = await fetch(url.toString(), { method: 'DELETE', headers })
        if (!res.ok) return { data: null, error: await res.json().catch(() => ({ message: res.statusText })) }
        return { data: await res.json().catch(() => null), error: null }
      }
      case 'INSERT': {
        const url = `${SUPABASE_URL}/rest/v1/${table}`
        const res = await fetch(url, {
          method: 'POST',
          headers: { ...headers, Accept: 'application/vnd.pgrst.object+json' },
          body: JSON.stringify(Array.isArray(bodyData) ? bodyData : [bodyData]),
        })
        if (!res.ok) return { data: null, error: await res.json().catch(() => ({ message: res.statusText })) }
        return { data: await res.json(), error: null }
      }
      case 'PATCH': {
        const url = buildUrl(table, filters)
        const res = await fetch(url.toString(), { method: 'PATCH', headers, body: JSON.stringify(bodyData) })
        if (!res.ok) return { data: null, error: await res.json().catch(() => ({ message: res.statusText })) }
        return { data: await res.json(), error: null }
      }
      default: {
        // GET / SELECT
        if (countOpts?.head) {
          const url = buildUrl(table, { ...filters, select: selectStr })
          const res = await fetch(url.toString(), { method: 'HEAD', headers: { ...headers, Prefer: 'count=exact' } })
          if (!res.ok) return { data: null, error: await res.json().catch(() => ({ message: res.statusText })) }
          const range = res.headers.get('content-range')
          return { data: null, count: range ? parseInt(range.split('/')[1]) : 0, error: null }
        }
        const url = buildUrl(table, { ...filters, select: selectStr })
        const acceptHeader = filters.single
          ? { Accept: 'application/vnd.pgrst.object+json' }
          : {}
        const res = await fetch(url.toString(), { headers: { ...headers, ...acceptHeader } })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: res.statusText }))
          if (err.code === 'PGRST116' && filters.single === 'maybe') {
            return { data: null, error: null }
          }
          return { data: null, error: err }
        }
        if (res.status === 204) return { data: null, error: null }
        const body = await res.json()
        return { data: body, error: null }
      }
    }
  }

  const q = {
    select(cols, opts) {
      selectStr = cols
      if (opts?.count === 'exact') countOpts = opts
      return q
    },
    eq(col, val) { (filters.eq ||= {})[col] = val; return q },
    neq(col, val) { (filters.neq ||= {})[col] = val; return q },
    gt(col, val) { (filters.gt ||= {})[col] = val; return q },
    gte(col, val) { (filters.gte ||= {})[col] = val; return q },
    lt(col, val) { (filters.lt ||= {})[col] = val; return q },
    lte(col, val) { (filters.lte ||= {})[col] = val; return q },
    in(col, vals) { (filters.in ||= {})[col] = vals; return q },
    is(col, val) { (filters.is ||= {})[col] = val; return q },
    not(col, op, val) { (filters.not ||= {})[col] = { [op]: val }; return q },
    like(col, val) { (filters.like ||= {})[col] = val; return q },
    ilike(col, val) { (filters.ilike ||= {})[col] = val; return q },
    order(col, opts) { filters.order = col; if (opts) filters.ascending = opts.ascending !== false; return q },
    limit(n) { filters.limit = n; return q },
    offset(n) { filters.offset = n; return q },
    single() { filters.single = 'single'; return q },
    maybeSingle() { filters.single = 'maybe'; return q },
    textSearch() { return q },
    filter(col, op, val) {
      if (op === 'eq') (filters.eq ||= {})[col] = val
      return q
    },
    upsert(data, opts) { method = 'UPSERT'; bodyData = data; filters.upsertOpts = opts || {}; return q },
    insert(data) { method = 'INSERT'; bodyData = data; return q },
    update(data) { method = 'PATCH'; bodyData = data; return q },
    delete() { method = 'DELETE'; return q },
    async then(resolve, reject) {
      try { resolve(await exec()) } catch (e) { reject(e) }
    },
  }
  return q
}

async function handleStorageResponse(res) {
  if (!res.ok) return { data: null, error: await res.json().catch(() => ({ message: res.statusText })) }
  return { data: await res.json().catch(() => ({})), error: null }
}

class SupabaseRealtimeChannel {
  constructor(name) {
    this.name = name
    this._pgConfig = null
    this._pgCallback = null
    this._subscribed = false
    this._pollTimer = null
    this._lastId = null
  }
  on(event, config, callback) {
    if (event === 'postgres_changes') { this._pgConfig = config; this._pgCallback = callback }
    return this
  }
  subscribe(callback) {
    this._subscribed = true
    if (callback) callback('SUBSCRIBED')
    this._startPolling()
    return this
  }
  unsubscribe() { this._subscribed = false; if (this._pollTimer) clearTimeout(this._pollTimer) }
  _startPolling() {
    if (!this._pgConfig) return
    const poll = async () => {
      if (!this._subscribed) return
      try {
        const uid = this.name.replace('notif-', '')
        const url = new URL(`${SUPABASE_URL}/rest/v1/notifications`)
        url.searchParams.set('select', '*')
        url.searchParams.set('user_id', `eq.${uid}`)
        url.searchParams.set('order', 'created_at.desc')
        url.searchParams.set('limit', '1')
        const res = await fetch(url.toString(), { headers: authHeaders() })
        if (res.ok) {
          const data = await res.json()
          if (data.length > 0 && data[0].id !== this._lastId) {
            this._lastId = data[0].id
            if (this._pgCallback) this._pgCallback(data[0])
          }
        }
      } catch (e) { /* silent */ }
      this._pollTimer = setTimeout(poll, 10000)
    }
    poll()
  }
}

export const supabase = {
  auth: {
    getSession,
    onAuthStateChange,
    signUp,
    signInWithPassword,
    signOut,
    updateUser,
    resetPasswordForEmail,
  },
  from(table) { return queryBuilder(table) },
  channel(name) { return new SupabaseRealtimeChannel(name) },
  removeChannel(sub) { if (sub?.unsubscribe) sub.unsubscribe() },
  async rpc(name, params) {
    const url = `${SUPABASE_URL}/rest/v1/rpc/${name}`
    const res = await fetch(url, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(params || {}),
    })
    return handleStorageResponse(res)
  },
  storage: {
    from(bucket) {
      return {
        async upload(path, file, opts) {
          const token = getAccessToken()
          const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`
          const res = await fetch(url, {
            method: opts?.upsert ? 'PUT' : 'POST',
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
              ...(opts?.headers || {}),
            },
            body: file,
          })
          return handleStorageResponse(res)
        },
        getPublicUrl(path) {
          return { data: { publicUrl: `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}` } }
        },
        async list(prefix) {
          const url = `${SUPABASE_URL}/storage/v1/object/list/${bucket}`
          const res = await fetch(url, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ prefix, limit: 100, offset: 0 }),
          })
          return handleStorageResponse(res)
        },
        async remove(paths) {
          const url = `${SUPABASE_URL}/storage/v1/object/${bucket}`
          const res = await fetch(url, {
            method: 'DELETE',
            headers: authHeaders(),
            body: JSON.stringify({ prefixes: Array.isArray(paths) ? paths : [paths] }),
          })
          return handleStorageResponse(res)
        },
      }
    },
  },
}
