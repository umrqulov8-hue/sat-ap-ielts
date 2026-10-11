import { requestAI } from './aiClient'

const systemPrompt = 'You are a helpful math tutor. Reply in Uzbek with English math terms. Use LaTeX for math. Be concise.'

export async function explainQuestion(question, userAnswer = null, onUpdate = null) {
  const options = (question.options || []).map((option, index) => `${String.fromCharCode(65 + index)}) ${option}`).join('\n')
  const correct = question.options?.[question.correct_index] ?? '(topilmadi)'
  const userPart = userAnswer !== null && userAnswer !== undefined
    ? `Foydalanuvchi javobi: ${String.fromCharCode(65 + userAnswer)} (${question.options?.[userAnswer] || ''})`
    : 'Foydalanuvchi hali javob bermagan.'
  const prompt = `Siz matematika o'qituvchisiz. Quyidagi savolga qisqa va aniq tushuntirish bering (max 200 so'z).

Savol: ${question.question_text || '(matn yo\'q)'}
Variantlar:
${options || '(variantlar yo\'q)'}
To'g'ri javob: ${String.fromCharCode(65 + (question.correct_index ?? 0))} (${correct})
${userPart}

Quyidagilarni bering:
1) Yechim bosqichlari
2) Nega to'g'ri javob to'g'ri
3) Asosiy formula yoki tushuncha

Matematik formulalar uchun LaTeX ishlating: $x^2$ inline, $$x^2$$ display. O'zbek tilida yozing (ingliz matematik atamalari bilan).`

  const explanation = await requestAI(systemPrompt, prompt, 800)
  onUpdate?.(explanation)
  return explanation
}
