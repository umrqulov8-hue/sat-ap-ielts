/**
 * Study Reminder Push Notification Server
 * 
 * Run this script every 15-30 minutes via cron (cron-job.org, Railway, Render, etc.)
 * 
 * Usage:
 *   node server/send-reminders.js
 * 
 * Environment variables needed (in .env or system):
 *   VITE_SUPABASE_URL=
 *   SUPABASE_SERVICE_KEY=   (from Supabase Dashboard → Project Settings → API → service_role key)
 *   VAPID_PUBLIC_KEY=
 *   VAPID_PRIVATE_KEY=
 *   VAPID_SUBJECT=mailto:your@email.com
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import webpush from 'web-push'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env
const envPath = join(__dirname, '..', '.env')
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@satapacademy.com'

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('Missing VAPID keys — generate with: node -e "const w=require(\'web-push\');const k=w.generateVAPIDKeys();console.log(JSON.stringify(k))"')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']

async function sendReminders() {
  const now = new Date()
  const today = now.getDay()
  const currentTotalMin = now.getHours() * 60 + now.getMinutes()

  console.log(`[${now.toISOString()}] Checking tasks for ${DAYS[today]}...`)

  // Get all non-done tasks for today
  const { data: tasks, error } = await supabase
    .from('study_plans')
    .select('*')
    .eq('day_of_week', today)
    .eq('done', false)
    .not('time_slot', 'is', null)

  if (error) { console.error('Query error:', error); return }
  if (!tasks?.length) { console.log('No tasks for today'); return }

  // Group tasks by user
  const userTasks = {}
  for (const task of tasks) {
    if (!userTasks[task.user_id]) userTasks[task.user_id] = []
    userTasks[task.user_id].push(task)
  }

  const userIds = Object.keys(userTasks)
  console.log(`Found tasks for ${userIds.length} users`)

  // Get push subscriptions for these users
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', userIds)

  if (!subscriptions?.length) { console.log('No push subscriptions found'); return }

  const subMap = {}
  for (const sub of subscriptions) {
    subMap[sub.user_id] = sub.subscription
  }

  let sentCount = 0

  for (const userId of userIds) {
    const userSub = subMap[userId]
    if (!userSub) continue

    const parsedSub = typeof userSub === 'string' ? JSON.parse(userSub) : userSub
    const userTasksList = userTasks[userId]

    for (const task of userTasksList) {
      if (!task.time_slot) continue

      const [h, m] = task.time_slot.split(':').map(Number)
      const taskTotalMin = h * 60 + m
      const diffMin = taskTotalMin - currentTotalMin

      if (diffMin > 0 && diffMin <= 120) {
        const payload = JSON.stringify({
          title: 'Study Reminder',
          body: `${task.activity} starts in ~${diffMin} min (${task.duration})`,
          data: { url: '/study-plan' },
          actions: [{ action: 'open', title: 'View Study Plan' }],
        })

        try {
          await webpush.sendNotification(parsedSub, payload)
          console.log(`Sent reminder to ${userId}: ${task.activity} in ${diffMin} min`)
          sentCount++
        } catch (e) {
          if (e.statusCode === 410) {
            console.log(`Subscription expired for ${userId}, removing...`)
            await supabase.from('push_subscriptions').delete().eq('user_id', userId)
          } else {
            console.error(`Push failed for ${userId}:`, e.message)
          }
        }
        break
      }
    }
  }

  console.log(`Sent ${sentCount} reminders`)
}

sendReminders().catch(console.error)
