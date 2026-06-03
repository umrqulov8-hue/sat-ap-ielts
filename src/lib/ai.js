const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'
const apiKey = import.meta.env.VITE_GROQ_API_KEY

async function callGroq(systemPrompt, userPrompt, maxTokens = 1000) {
  if (!apiKey) throw new Error('Groq API key topilmadi')
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: maxTokens,
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`AI xatosi: ${res.status} ${t.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

export async function forecastScore(userScores, tests, targetScore = 1500) {
  const scoresText = userScores.map(s => `${s.subjects?.title || 'Unknown'}: ${s.score}/${s.max_score || 800}`).join('\n')
  const testsText = tests.slice(0, 10).map(t => `${t.title || t.subject}: ${t.score}/${t.total} (${Math.round(t.score / t.total * 100)}%)`).join('\n')
  const avgScore = tests.length > 0 ? Math.round(tests.reduce((a, t) => a + (t.score / t.total), 0) / tests.length * 100) : 0

  const system = 'You are an SAT score prediction expert. Reply in Uzbek with English terms. Be concise and data-driven.'
  const prompt = `Foydalanuvchi SAT natijalari:

Fan bo'yicha ballar:
${scoresText || 'Ma\'lumot yo\'q'}

Oxirgi testlar (${tests.length} ta):
${testsText || 'Ma\'lumot yo\'q'}

O\'rtacha ball: ${avgScore}%
Maqsad: ${targetScore}

JSON formatda javob bering:
{
  "predicted_math": <son>,
  "predicted_rw": <son>,
  "predicted_total": <son>,
  "confidence": <foiz 0-100>,
  "trend": "up" yoki "down" yoki "stable",
  "advice": "qisqa maslahat (1-2 gap)"
}

Faqat JSON yozing, boshqa hech narsa yo'q.`

  const raw = await callGroq(system, prompt, 300)
  try {
    const json = raw.replace(/```json/g, '').replace(/```/g, '').trim()
    return JSON.parse(json)
  } catch {
    return { predicted_math: 0, predicted_rw: 0, predicted_total: 0, confidence: 0, trend: 'stable', advice: 'Natijani tahlil qilib bo\'lmadi' }
  }
}

export async function analyzeTest(test, questions, userAnswers) {
  const qStats = questions.map((q, i) => {
    const userAns = userAnswers?.[q.id]
    const correct = userAns === q.correct_index
    const topic = q.topic_id || 'unknown'
    return { id: q.id, correct, topic, question: q.question_text?.slice(0, 80) }
  })

  const correctCount = qStats.filter(q => q.correct).length
  const totalCount = qStats.length
  const weakTopics = {}

  qStats.forEach(q => {
    if (!q.correct) {
      weakTopics[q.topic] = (weakTopics[q.topic] || 0) + 1
    }
  })

  const system = 'You are an SAT test analysis expert. Reply in Uzbek with English terms. Be concise.'
  const prompt = `Test tahlili:

Natija: ${correctCount}/${totalCount} (${Math.round(correctCount / totalCount * 100)}%)
Fan: ${test.subject || 'SAT'}
Mavzu: ${test.title || 'Practice Test'}

Xato savollar soni: ${totalCount - correctCount}
Eng zaif mavzular: ${JSON.stringify(weakTopics)}

JSON formatda javob bering:
{
  "score_pct": <foiz>,
  "strengths": ["kuchli tomon 1", "kuchli tomon 2"],
  "weaknesses": ["zaif tomon 1", "zaif tomon 2"],
  "recommendations": ["tavsiya 1", "tavsiya 2", "tavsiya 3"],
  "next_steps": "keyingi qadamlar (1-2 gap)"
}

Faqat JSON yozing.`

  const raw = await callGroq(system, prompt, 500)
  try {
    const json = raw.replace(/```json/g, '').replace(/```/g, '').trim()
    return JSON.parse(json)
  } catch {
    return { score_pct: Math.round(correctCount / totalCount * 100), strengths: [], weaknesses: [], recommendations: [], next_steps: 'Tahlil qilib bo\'lmadi' }
  }
}

export async function generateStudyPlan(userScores, tests, subjects, examDate) {
  const scoresText = userScores.map(s => `${s.subjects?.title || 'Unknown'}: ${s.score}/${s.max_score || 800}`).join('\n')
  const testsText = tests.slice(0, 5).map(t => `${t.title}: ${Math.round(t.score / t.total * 100)}%`).join('\n')
  const daysLeft = examDate ? Math.max(1, Math.ceil((new Date(examDate) - new Date()) / (1000 * 60 * 60 * 24))) : 90

  const system = 'You are an SAT study plan expert. Be concise, practical, and direct. No motivational phrases, no fluff, no advertising. Just assign specific study tasks.'
  const prompt = `Foydalanuvchi uchun haftalik SAT o'quv rejasini tuzing.

Fan bo'yicha ballar:
${scoresText || 'Ma\'lumot yo\'q'}

Oxirgi testlar:
${testsText || 'Ma\'lumot yo\'q'}

Imtihon sanasi: ${examDate || 'Noma\'lum'}
Qolgan kunlar: ${daysLeft}

Har bir kun uchun 2-4 ta aniq vazifa tuzing. Faqat vazifalar, motivatsiya gapirmang.
JSON formatda:
{
  "plan": [
    {
      "day": "MONDAY",
      "tasks": [
        {"subject": "MATH", "activity": "Heart of Algebra — 20 ta masala hal qilish", "duration": "45 min", "priority": 3},
        {"subject": "R&W", "activity": "Reading passage — main idea topish mashqi", "duration": "30 min", "priority": 2}
      ]
    }
  ]
}

Faqat JSON yozing, boshqa hech narsa yo'q.`

  const raw = await callGroq(system, prompt, 1200)
  try {
    const json = raw.replace(/```json/g, '').replace(/```/g, '').trim()
    return JSON.parse(json)
  } catch {
    return { plan: [], focus_areas: [], weekly_goal: 'Reja tuzib bo\'lmadi' }
  }
}

export async function dailyAdvice(userScores, tests, streak, studyPlan) {
  const scoresText = userScores.map(s => `${s.subjects?.title || 'Unknown'}: ${s.score}`).join('\n')
  const recentTests = tests.slice(0, 3).map(t => `${t.title}: ${Math.round(t.score / t.total * 100)}%`).join('\n')
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()

  const system = 'You are a friendly SAT study advisor. Reply in Uzbek with English terms. Be motivating and concise.'
  const prompt = `Bugungi o\'quv maslahati.

Fan ballari: ${scoresText || 'Ma\'lumot yo\'q'}
Oxirgi testlar: ${recentTests || 'Ma\'lumot yo\'q'}
Streak: ${streak} kun
Bugun: ${today}

JSON formatda javob bering:
{
  "greeting": "salomlash (1 gap, motivatsion)",
  "focus": "bugun nima qilish kerak",
  "tasks": ["topshiriq 1", "topshiriq 2", "topshiriq 3"],
  "tip": "foydali maslahat (1 gap)",
  "motivation": "motivatsion gap"
}

Faqat JSON yozing.`

  const raw = await callGroq(system, prompt, 400)
  try {
    const json = raw.replace(/```json/g, '').replace(/```/g, '').trim()
    return JSON.parse(json)
  } catch {
    return { greeting: 'Assalomu alaykum!', focus: 'Bugun mashq qiling', tasks: [], tip: 'Doimiylik muhim', motivation: 'Davom eting!' }
  }
}
