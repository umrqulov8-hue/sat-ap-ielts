/* Daily study reminder + Sunday report by email (Brevo). Run by the Vercel cron in vercel.json.
   Only people who switched the email option on in Settings are written to.
   Server env: CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY, BREVO_API_KEY, REMINDER_FROM_EMAIL, VITE_SUPABASE_URL. */
const SITE = 'https://ufq-sat.vercel.app'
const MAX_SENDS = 280 // Brevo's free plan allows 300 a day

// calendar day in Tashkent (UTC+5), as YYYY-MM-DD
const day = d => new Date(d.getTime() + 5 * 3600000).toISOString().slice(0, 10)

function mail(title, body, link, label) {
  return `<div style="font-family:Arial,sans-serif;color:#003049;max-width:480px;margin:auto;padding:24px">
<p style="font-size:28px;font-style:italic;margin:0 0 18px">Ufq.</p>
<h2 style="margin:0 0 10px;font-size:22px">${title}</h2>
<p style="font-size:15px;line-height:1.55">${body}</p>
<p><a href="${SITE}${link}" style="display:inline-block;background:#C1121F;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold">${label}</a></p>
<p style="font-size:12px;color:#7a8a96;margin-top:26px">You get this because email reminders are on. <a href="${SITE}/settings" style="color:#7a8a96">Turn them off in Settings</a>.</p></div>`
}

export default async function handler(request, response) {
  const { CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY: serviceKey, BREVO_API_KEY: brevo, REMINDER_FROM_EMAIL: from } = process.env
  const url = process.env.VITE_SUPABASE_URL
  if (!CRON_SECRET || !serviceKey || !brevo || !from || !url) return response.status(503).json({ error: 'Email reminders are not configured yet.' })
  if (request.headers.authorization !== `Bearer ${CRON_SECRET}`) return response.status(401).json({ error: 'Not allowed.' })

  const db = async path => {
    const r = await fetch(url + path, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, signal: AbortSignal.timeout(15000) })
    if (!r.ok) throw new Error('database ' + r.status)
    return r.json()
  }

  try {
    const people = []
    for (let page = 1; page <= 20; page++) {
      const data = await db(`/auth/v1/admin/users?page=${page}&per_page=200`)
      const users = data.users || []
      people.push(...users.filter(u => u.email && (u.user_metadata?.email_remind === true || u.user_metadata?.email_weekly === true)))
      if (users.length < 200) break
    }
    const now = new Date()
    const today = day(now)
    const sunday = new Date(now.getTime() + 5 * 3600000).getUTCDay() === 0
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString()

    let sent = 0
    let failed = 0
    for (const u of people) {
      if (sent >= MAX_SENDS) break
      const attempts = await db(`/rest/v1/practice_tests?select=score,total,taken_at&user_id=eq.${u.id}&taken_at=gte.${weekAgo}`)
      const outbox = []
      if (u.user_metadata.email_remind === true && !attempts.some(a => day(new Date(a.taken_at)) === today)) {
        outbox.push(['Time to study', mail('Today’s set is waiting.', 'Ten questions take about 15 minutes.', '/practice', 'Start practising')])
      }
      if (sunday && u.user_metadata.email_weekly === true) {
        const total = attempts.reduce((t, a) => t + (a.total || 0), 0)
        const right = attempts.reduce((t, a) => t + (a.score || 0), 0)
        const line = total ? `${attempts.length} saved set(s), ${total} questions, ${Math.round(right / total * 100)}% correct.` : 'No saved practice this week yet.'
        outbox.push(['Your week on Ufq', mail('Your week.', line, '/report', 'Open your report')])
      }
      for (const [subject, htmlContent] of outbox) {
        if (sent >= MAX_SENDS) break
        const r = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'api-key': brevo, 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender: { email: from, name: 'Ufq' }, to: [{ email: u.email }], subject, htmlContent }),
          signal: AbortSignal.timeout(15000),
        })
        if (r.ok) sent++
        else { failed++; console.error('brevo send failed:', r.status) }
      }
    }
    return response.status(200).json({ optedIn: people.length, sent, failed })
  } catch (error) {
    console.error('reminders failed:', error?.message || 'Error')
    return response.status(502).json({ error: 'Reminder run failed.' })
  }
}
