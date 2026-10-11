const MODEL = 'openai/gpt-4o-mini'
const MAX_PROMPT_LENGTH = 24000

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Faqat POST so\'rovi qo\'llab-quvvatlanadi.' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
  const providerKey = process.env.OPENROUTER_API_KEY
  const accessToken = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]

  if (!supabaseUrl || !supabaseKey) {
    return response.status(503).json({ error: 'Kirish xizmati hozircha mavjud emas.' })
  }
  if (!accessToken) {
    return response.status(401).json({ error: 'AI yordamidan foydalanish uchun hisobingizga kiring.' })
  }

  try {
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    })
    if (!authResponse.ok) {
      return response.status(401).json({ error: 'Sessiya muddati tugagan. Qayta kiring.' })
    }

    if (!providerKey) {
      return response.status(503).json({ error: 'AI xizmati hali sozlanmagan. Keyinroq urinib ko\'ring.' })
    }

    const { systemPrompt, prompt, maxTokens = 1000 } = request.body || {}
    if (typeof systemPrompt !== 'string' || typeof prompt !== 'string' || !prompt.trim()) {
      return response.status(400).json({ error: 'AI so\'rovi to\'liq emas.' })
    }
    if (systemPrompt.length > 4000 || prompt.length > MAX_PROMPT_LENGTH) {
      return response.status(413).json({ error: 'AI so\'rovi ruxsat etilgan hajmdan katta.' })
    }

    const providerResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${providerKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://satap.vercel.app',
        'X-Title': 'SATAP Academy',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        max_tokens: Math.max(1, Math.min(Number(maxTokens) || 1000, 2000)),
      }),
      signal: AbortSignal.timeout(45000),
    })
    if (!providerResponse.ok) {
      console.error('AI provider request failed:', providerResponse.status)
      return response.status(502).json({ error: 'AI xizmati vaqtincha javob bermayapti.' })
    }

    const result = await providerResponse.json()
    const content = result.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content) {
      return response.status(502).json({ error: 'AI xizmati bo\'sh javob qaytardi.' })
    }
    return response.status(200).json({ content })
  } catch (error) {
    console.error('AI function request failed:', error?.name || 'Error')
    return response.status(502).json({ error: 'AI xizmati bilan aloqa uzildi. Keyinroq urinib ko\'ring.' })
  }
}
