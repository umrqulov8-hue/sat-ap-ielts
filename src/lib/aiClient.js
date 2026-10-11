import { getAccessToken } from './session'

export async function requestAI(systemPrompt, userPrompt, maxTokens = 1000) {
  const accessToken = getAccessToken()
  if (!accessToken) {
    throw new Error('AI yordamidan foydalanish uchun hisobingizga kiring.')
  }

  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ systemPrompt, prompt: userPrompt, maxTokens }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result.error || 'AI xizmati hozir javob bermayapti. Keyinroq urinib ko\'ring.')
  }
  if (typeof result.content !== 'string' || !result.content) {
    throw new Error('AI xizmati bo\'sh javob qaytardi. Keyinroq qayta urinib ko\'ring.')
  }
  return result.content
}
