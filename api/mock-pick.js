/* Admin-only: asks an LLM to choose the best questions for one mock-test module.
   Keys never reach the browser. Groq is used when VITE_GROQ_API_KEY is set (server env), OpenRouter otherwise. */
const MODULE_GOAL = {
  m1: 'Module 1 of an adaptive SAT Math test: a balanced, representative mix (about 25% easy, 50% medium, 25% hard).',
  m2_hard: 'the HARDER Module 2: mostly hard questions that separate students scoring above 650, a few medium ones.',
  m2_easy: 'the EASIER Module 2: mostly easy, confidence-building questions for students scoring below 550, a few medium ones.',
}

function parsePicked(text, max) {
  const m = String(text || '').match(/\{[\s\S]*\}/)
  if (!m) return []
  let obj
  try { obj = JSON.parse(m[0]) } catch { return [] }
  const list = Array.isArray(obj.picked) ? obj.picked : []
  const seen = new Set()
  const out = []
  for (const v of list) {
    const n = Number(v)
    if (Number.isInteger(n) && n >= 0 && n < max && !seen.has(n)) { seen.add(n); out.push(n) }
  }
  return out
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'POST only.' })
  }
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
  const groqKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY
  const orKey = process.env.OPENROUTER_API_KEY
  const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!supabaseUrl || !supabaseKey) return response.status(503).json({ error: 'Auth is not configured.' })
  if (!token) return response.status(401).json({ error: 'Sign in first.' })
  if (!groqKey && !orKey) return response.status(503).json({ error: 'No AI key is configured on the server.' })

  try {
    const who = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) })
    if (!who.ok) return response.status(401).json({ error: 'Session expired.' })
    const user = await who.json()
    const prof = await fetch(`${supabaseUrl}/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(user.id)}`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) })
    const rows = prof.ok ? await prof.json() : []
    if (!rows[0] || !['admin', 'owner'].includes(rows[0].role)) return response.status(403).json({ error: 'Admins only.' })

    const { module: mod, need, candidates } = request.body || {}
    if (!MODULE_GOAL[mod] || !Array.isArray(candidates) || !Number.isInteger(need) || need < 1 || need > 200) {
      return response.status(400).json({ error: 'Bad request.' })
    }
    const list = candidates.slice(0, 260).map((c, i) => `${i} | ${['', 'easy', 'medium', 'hard'][c.d] || 'medium'} | ${String(c.dom || '').slice(0, 24)} | ${c.t === 'MC' ? 'MC' : 'grid-in'} | ${String(c.s || '').replace(/\s+/g, ' ').slice(0, 220)}`).join('\n')
    const system = 'You are an expert SAT Math test designer. Reply with JSON only, no prose.'
    const prompt = `Choose exactly ${need} questions for ${MODULE_GOAL[mod]}\n\nRules:\n- Prefer clear, well-posed, self-contained questions; skip any that look broken, ambiguous, cut off, or that depend on a missing figure.\n- Cover Algebra, Advanced Math, Problem-Solving & Data and Geometry & Trig about evenly.\n- Do not pick near-duplicates.\n- Keep the difficulty mix right for the module (the labels are a guide; correct them if a label looks clearly wrong).\n\nCandidates (index | label | domain | type | text):\n${list}\n\nAnswer as {"picked":[indices]} with exactly ${need} distinct indices.`

    const useGroq = !!groqKey
    const res = await fetch(useGroq ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${useGroq ? groqKey : orKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: useGroq ? 'llama-3.3-70b-versatile' : 'openai/gpt-4o-mini', messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], temperature: 0.2, max_tokens: 1200 }),
      signal: AbortSignal.timeout(45000),
    })
    if (!res.ok) {
      console.error('mock-pick provider failed:', res.status)
      return response.status(502).json({ error: 'The AI service did not answer.' })
    }
    const data = await res.json()
    const picked = parsePicked(data.choices?.[0]?.message?.content, list.split('\n').length)
    if (!picked.length) return response.status(502).json({ error: 'The AI answer could not be read.' })
    return response.status(200).json({ picked, provider: useGroq ? 'groq' : 'openrouter' })
  } catch (error) {
    console.error('mock-pick failed:', error?.name || 'Error')
    return response.status(502).json({ error: 'Could not reach the AI service.' })
  }
}
