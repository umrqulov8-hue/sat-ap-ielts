const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

export async function explainQuestion(question, userAnswer = null) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY
  if (!apiKey) throw new Error('Groq API key topilmadi. .env faylni tekshiring.')

  const opts = (question.options || []).map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('\n')
  const correct = question.options?.[question.correct_index] ?? '(topilmadi)'

  const userPart = userAnswer !== null && userAnswer !== undefined
    ? `Foydalanuvchi javobi: ${String.fromCharCode(65 + userAnswer)} (${question.options?.[userAnswer] || ''})`
    : 'Foydalanuvchi hali javob bermagan.'

  const prompt = `Siz SAT Math o'qituvchisiz. Quyidagi savolga qisqa va aniq tushuntirish bering (max 200 so'z).

Savol: ${question.question_text || '(matn yo\'q)'}
Variantlar:
${opts || '(variantlar yo\'q)'}
To'g'ri javob: ${String.fromCharCode(65 + (question.correct_index ?? 0))} (${correct})
${userPart}

Quyidagilarni bering:
1) Yechim bosqichlari
2) Nega to'g'ri javob to'g'ri
3) Asosiy formula yoki tushuncha

Matematik formulalar uchun LaTeX ishlating: $x^2$ inline, $$x^2$$ display. O'zbek tilida yozing (ingliz matematik atamalari bilan).`

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: 'You are a helpful SAT Math tutor. Reply in Uzbek with English math terms. Use LaTeX for math. Be concise.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 800,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Groq API xatosi: ${response.status} ${errText.slice(0, 200)}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || 'Tushuntirish olinmadi.'
}
