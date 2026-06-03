import { getAccessToken } from './session'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const REST_URL = `${SUPABASE_URL}/rest/v1`
const STORAGE_URL = `${SUPABASE_URL}/storage/v1`

function headers(extra = {}) {
  const token = getAccessToken()
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    ...extra,
  }
}

async function handleResponse(res, opts = {}) {
  if (opts.countOnly) {
    const range = res.headers.get('content-range')
    return { data: range ? parseInt(range.split('/')[1]) : 0, error: null }
  }
  if (opts.method === 'HEAD' || res.status === 204) {
    return { data: null, error: null }
  }
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const body = await res.json()
    if (!res.ok) return { data: null, error: body }
    if (opts.single) return { data: body, error: null }
    return { data: body, error: null }
  }
  if (!res.ok) return { data: null, error: { message: res.statusText } }
  const text = await res.text()
  return { data: text, error: null }
}

function buildUrl(table, filters = {}) {
  const url = new URL(`${REST_URL}/${table}`)
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
      const op = Object.keys(v)[0]
      const val = v[op]
      sp.append(k, `not.${op}.${val}`)
    })
  }
  if (filters.order) {
    const dir = filters.ascending === false ? '.desc' : '.asc'
    sp.append('order', `${filters.order}${dir}`)
  } else if (filters.ascending !== undefined) {
    // pass
  }
  if (filters.limit !== undefined) sp.set('limit', filters.limit)
  if (filters.offset !== undefined) sp.set('offset', filters.offset)
  return url
}

// REST API
export async function select(table, filters = {}) {
  const url = buildUrl(table, filters)
  const acceptHeader = filters.single
    ? { Accept: 'application/vnd.pgrst.object+json' }
    : {}
  const res = await fetch(url.toString(), { headers: headers(acceptHeader) })
  return handleResponse(res, { single: !!filters.single })
}

export async function insert(table, data, opts = {}) {
  const url = `${REST_URL}/${table}`
  const extraH = {}
  if (opts.select) extraH.Prefer = `return=representation,${opts.select}`
  if (opts.select && opts.single) extraH.Accept = 'application/vnd.pgrst.object+json'
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(extraH),
    body: JSON.stringify(Array.isArray(data) ? data : [data]),
  })
  return handleResponse(res, { single: !!opts.single })
}

export async function update(table, data, filters = {}) {
  const url = buildUrl(table, filters)
  const extraH = filters.single ? { Accept: 'application/vnd.pgrst.object+json' } : {}
  const res = await fetch(url.toString(), {
    method: 'PATCH',
    headers: headers(extraH),
    body: JSON.stringify(data),
  })
  return handleResponse(res, { single: !!filters.single })
}

export async function remove(table, filters = {}) {
  const url = buildUrl(table, filters)
  const res = await fetch(url.toString(), {
    method: 'DELETE',
    headers: headers(),
  })
  return handleResponse(res)
}

export async function upsert(table, data, opts = {}) {
  const url = `${REST_URL}/${table}`
  const extraH = { Prefer: 'return=representation' }
  if (opts.onConflict) extraH.Prefer += `,resolution=merge-duplicates`
  if (opts.select) extraH.Prefer += `,${opts.select}`
  if (opts.single) extraH.Accept = 'application/vnd.pgrst.object+json'
  const body = Array.isArray(data) ? data : [data]
  const query = opts.onConflict ? `?on_conflict=${opts.onConflict}` : ''
  const res = await fetch(url + query, {
    method: 'POST',
    headers: headers(extraH),
    body: JSON.stringify(body),
  })
  return handleResponse(res, { single: !!opts.single })
}

export async function count(table, filters = {}) {
  const url = buildUrl(table, filters)
  const res = await fetch(url.toString(), {
    method: 'HEAD',
    headers: headers({ Prefer: 'count=exact' }),
  })
  return handleResponse(res, { countOnly: true })
}

// RPC
export async function rpc(name, params = {}) {
  const url = `${REST_URL}/rpc/${name}`
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(params),
  })
  return handleResponse(res)
}

// Storage
export const storage = {
  async upload(bucket, path, file) {
    const token = getAccessToken()
    const url = `${STORAGE_URL}/object/${bucket}/${path}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
      },
      body: file,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }))
      return { data: null, error: err }
    }
    return { data: { path }, error: null }
  },

  getPublicUrl(bucket, path) {
    return {
      data: { publicUrl: `${STORAGE_URL}/object/public/${bucket}/${path}` },
    }
  },

  async list(bucket, prefix) {
    const url = `${STORAGE_URL}/object/list/${bucket}`
    const res = await fetch(url, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ prefix, limit: 100, offset: 0 }),
    })
    return handleResponse(res)
  },

  async remove(bucket, paths) {
    const url = `${STORAGE_URL}/object/${bucket}`
    const res = await fetch(url, {
      method: 'DELETE',
      headers: headers(),
      body: JSON.stringify({ prefixes: Array.isArray(paths) ? paths : [paths] }),
    })
    return handleResponse(res)
  },
}

// Batch for multi-file reads
export async function batch(queries) {
  // queries: [{ table, filters }, ...]
  return Promise.all(queries.map(q => select(q.table, q.filters)))
}
