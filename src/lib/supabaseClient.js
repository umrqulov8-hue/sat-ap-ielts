import { getSession, onAuthStateChange, getFreshAccessToken, refreshAccessToken } from './session'
import { signUp, signInWithPassword, signOut, updateUser, resetPasswordForEmail } from './auth'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

/**
 * Minimal PostgREST / Storage client.
 *
 * Contract (matches supabase-js where it matters):
 *  - Every call resolves to { data, error } and never throws.
 *  - An HTTP failure is ALWAYS surfaced as `error` (nothing is swallowed).
 *  - insert/upsert return an array of rows, or a single object after .single().
 *  - update/delete ask PostgREST for the affected rows. When RLS (or a wrong
 *    filter) makes the write touch 0 rows we return an error with code
 *    NO_ROWS_AFFECTED instead of pretending it worked. That silent "success"
 *    was why the admin panel reported saved/deleted rows that never changed.
 */

async function baseHeaders(forceRefresh = false) {
  const token = forceRefresh ? await refreshAccessToken() : await getFreshAccessToken()
  return {
    hasToken: Boolean(token),
    headers: {
      apikey: SUPABASE_ANON_KEY,
      // Signed-out visitors use the publishable key; RLS decides what they can read.
      Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  }
}

async function readError(res) {
  const body = await res.json().catch(() => null)
  const message = body?.message || body?.error_description || body?.error || res.statusText || `HTTP ${res.status}`
  return { ...(body && typeof body === 'object' ? body : {}), message, status: res.status }
}

// fetch wrapper: fresh token, one transparent retry after a 401 (expired JWT), network errors -> error object.
async function send(url, init = {}) {
  try {
    let base = await baseHeaders()
    let res = await fetch(url, { ...init, headers: { ...base.headers, ...(init.headers || {}) } })
    if (res.status === 401 && base.hasToken) {
      base = await baseHeaders(true)
      res = await fetch(url, { ...init, headers: { ...base.headers, ...(init.headers || {}) } })
    }
    return { res }
  } catch (e) {
    return { networkError: { message: e?.message ? `Network error: ${e.message}` : 'Network error', status: 0 } }
  }
}

function buildUrl(table, filters) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`)
  const sp = url.searchParams
  sp.set('select', filters.select || '*')
  const simple = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is']
  for (const op of simple) {
    if (filters[op]) Object.entries(filters[op]).forEach(([k, v]) => sp.append(k, `${op}.${v}`))
  }
  if (filters.in) Object.entries(filters.in).forEach(([k, v]) => sp.append(k, `in.(${Array.isArray(v) ? v.join(',') : v})`))
  if (filters.not) {
    Object.entries(filters.not).forEach(([k, v]) => {
      const op = Object.keys(v)[0]
      sp.append(k, `not.${op}.${v[op]}`)
    })
  }
  if (filters.or) filters.or.forEach(expr => sp.append('or', `(${expr})`))
  if (filters.orders?.length) sp.set('order', filters.orders.join(','))
  if (filters.limit !== undefined) sp.set('limit', filters.limit)
  if (filters.offset !== undefined) sp.set('offset', filters.offset)
  return url
}

const OBJECT = 'application/vnd.pgrst.object+json'

function queryBuilder(table) {
  const filters = {}
  let countOpts = null
  let selectStr = '*'
  let selectCalled = false
  let method = 'GET'
  let bodyData = null
  let allowEmpty = false

  async function exec() {
    const wantsObject = Boolean(filters.single)
    const withSelect = { ...filters, select: selectStr }

    let url
    let init
    switch (method) {
      case 'UPSERT': {
        const u = new URL(`${SUPABASE_URL}/rest/v1/${table}`)
        if (filters.upsertOpts?.onConflict) u.searchParams.set('on_conflict', String(filters.upsertOpts.onConflict).replace(/\s+/g, ''))
        if (selectCalled) u.searchParams.set('select', selectStr)
        const prefer = ['return=representation', filters.upsertOpts?.ignoreDuplicates ? 'resolution=ignore-duplicates' : 'resolution=merge-duplicates']
        url = u.toString()
        init = {
          method: 'POST',
          headers: { Prefer: prefer.join(','), ...(wantsObject ? { Accept: OBJECT } : {}) },
          body: JSON.stringify(Array.isArray(bodyData) ? bodyData : [bodyData]),
        }
        break
      }
      case 'INSERT': {
        const u = new URL(`${SUPABASE_URL}/rest/v1/${table}`)
        if (selectCalled) u.searchParams.set('select', selectStr)
        url = u.toString()
        init = {
          method: 'POST',
          headers: { Prefer: 'return=representation', ...(wantsObject ? { Accept: OBJECT } : {}) },
          body: JSON.stringify(Array.isArray(bodyData) ? bodyData : [bodyData]),
        }
        break
      }
      case 'PATCH':
      case 'DELETE': {
        url = buildUrl(table, withSelect).toString()
        init = {
          method,
          headers: { Prefer: 'return=representation', ...(wantsObject ? { Accept: OBJECT } : {}) },
          ...(method === 'PATCH' ? { body: JSON.stringify(bodyData) } : {}),
        }
        break
      }
      default: {
        url = buildUrl(table, withSelect).toString()
        if (countOpts?.head) {
          init = { method: 'HEAD', headers: { Prefer: 'count=exact' } }
        } else {
          init = {
            method: 'GET',
            headers: {
              ...(wantsObject ? { Accept: OBJECT } : {}),
              ...(countOpts ? { Prefer: 'count=exact' } : {}),
            },
          }
        }
      }
    }

    const { res, networkError } = await send(url, init)
    if (networkError) return { data: null, error: networkError, count: null }

    if (!res.ok) {
      const err = await readError(res)
      // maybeSingle(): zero rows is not an error.
      if (filters.single === 'maybe' && (err.code === 'PGRST116' || res.status === 406)) {
        return { data: null, error: null, count: null }
      }
      if (res.status === 403 || err.code === '42501') {
        err.message = `Permission denied: ${err.message}`
      }
      return { data: null, error: err, count: null }
    }

    const range = res.headers.get('content-range')
    const count = range && range.includes('/') && range.split('/')[1] !== '*' ? parseInt(range.split('/')[1], 10) : null

    if (init.method === 'HEAD') return { data: null, error: null, count: count ?? 0 }
    if (res.status === 204) return { data: null, error: null, count }

    const body = await res.json().catch(() => null)

    if ((method === 'PATCH' || method === 'DELETE') && !allowEmpty && Array.isArray(body) && body.length === 0) {
      return {
        data: null,
        count: 0,
        error: {
          code: 'NO_ROWS_AFFECTED',
          status: res.status,
          message: `${method === 'DELETE' ? 'Delete' : 'Update'} on "${table}" changed 0 rows. The row does not exist or your account is not allowed to change it (admin/owner role required).`,
        },
      }
    }
    return { data: body, error: null, count }
  }

  const q = {
    select(cols, opts) {
      selectStr = cols || '*'
      selectCalled = true
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
    or(expr) { (filters.or ||= []).push(expr); return q },
    match(obj) { Object.entries(obj || {}).forEach(([k, v]) => { (filters.eq ||= {})[k] = v }); return q },
    order(col, opts) {
      const dir = opts?.ascending === false ? 'desc' : 'asc'
      const nulls = opts?.nullsFirst === true ? '.nullsfirst' : opts?.nullsFirst === false ? '.nullslast' : ''
      ;(filters.orders ||= []).push(`${col}.${dir}${nulls}`)
      return q
    },
    range(from, to) { filters.offset = from; filters.limit = to - from + 1; return q },
    limit(n) { filters.limit = n; return q },
    offset(n) { filters.offset = n; return q },
    single() { filters.single = 'single'; return q },
    maybeSingle() { filters.single = 'maybe'; return q },
    filter(col, op, val) {
      const allowed = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is']
      if (!allowed.includes(op)) throw new Error(`filter(): unsupported operator "${op}"`)
      ;(filters[op] ||= {})[col] = val
      return q
    },
    // Opt out of the "0 rows affected = error" guard for deliberate best-effort writes.
    allowEmpty() { allowEmpty = true; return q },
    upsert(data, opts) { method = 'UPSERT'; bodyData = data; filters.upsertOpts = opts || {}; return q },
    insert(data) { method = 'INSERT'; bodyData = data; return q },
    update(data) { method = 'PATCH'; bodyData = data; return q },
    delete() { method = 'DELETE'; return q },
    then(onFulfilled, onRejected) { return exec().then(onFulfilled, onRejected) },
    catch(onRejected) { return exec().catch(onRejected) },
    finally(fn) { return exec().finally(fn) },
  }
  return q
}

async function storageResult(res, networkError) {
  if (networkError) return { data: null, error: networkError }
  if (!res.ok) return { data: null, error: await readError(res) }
  return { data: await res.json().catch(() => ({})), error: null }
}

const encodePath = path => String(path).split('/').map(encodeURIComponent).join('/')

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
    let failCount = 0
    const poll = async () => {
      if (!this._subscribed) return
      try {
        const token = await getFreshAccessToken()
        if (!token) return
        const uid = this.name.replace('notif-', '')
        const url = new URL(`${SUPABASE_URL}/rest/v1/notifications`)
        url.searchParams.set('select', '*')
        url.searchParams.set('user_id', `eq.${uid}`)
        url.searchParams.set('order', 'created_at.desc')
        url.searchParams.set('limit', '1')
        const res = await fetch(url.toString(), { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } })
        if (res.ok) {
          failCount = 0
          const data = await res.json()
          if (data.length > 0 && data[0].id !== this._lastId) {
            this._lastId = data[0].id
            if (this._pgCallback) this._pgCallback(data[0])
          }
        } else {
          failCount++
          if (failCount >= 2) return
        }
      } catch { failCount++; if (failCount >= 3) return }
      if (this._subscribed) this._pollTimer = setTimeout(poll, 10000)
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
    const { res, networkError } = await send(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      body: JSON.stringify(params || {}),
    })
    return storageResult(res, networkError)
  },
  storage: {
    from(bucket) {
      return {
        // supabase-js compatible: upload(path, file, { upsert, contentType, cacheControl })
        async upload(path, file, opts = {}) {
          const contentType = opts.contentType || file?.type || 'application/octet-stream'
          const { res, networkError } = await send(`${SUPABASE_URL}/storage/v1/object/${bucket}/${encodePath(path)}`, {
            method: 'POST',
            headers: {
              'Content-Type': contentType,
              'Cache-Control': `max-age=${opts.cacheControl || 3600}`,
              // Correct way to overwrite: POST + x-upsert (PUT only updates an existing object).
              ...(opts.upsert ? { 'x-upsert': 'true' } : {}),
            },
            body: file,
          })
          const result = await storageResult(res, networkError)
          if (result.error) return result
          return { data: { path, ...(result.data || {}) }, error: null }
        },
        getPublicUrl(path) {
          return { data: { publicUrl: `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodePath(path)}` } }
        },
        async list(prefix = '', opts = {}) {
          const { res, networkError } = await send(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
            method: 'POST',
            body: JSON.stringify({ prefix, limit: opts.limit || 100, offset: opts.offset || 0 }),
          })
          return storageResult(res, networkError)
        },
        // Resolves with the objects that were really removed. Without a DELETE policy
        // storage answers 200 + [] — report that instead of pretending it worked.
        async remove(paths) {
          const list = Array.isArray(paths) ? paths : [paths]
          const { res, networkError } = await send(`${SUPABASE_URL}/storage/v1/object/${bucket}`, {
            method: 'DELETE',
            body: JSON.stringify({ prefixes: list }),
          })
          const result = await storageResult(res, networkError)
          if (result.error) return result
          if (list.length > 0 && Array.isArray(result.data) && result.data.length === 0) {
            return { data: [], error: { code: 'NO_OBJECTS_REMOVED', message: 'Storage removed 0 files (missing delete permission or file not found).' } }
          }
          return result
        },
      }
    },
  },
}
