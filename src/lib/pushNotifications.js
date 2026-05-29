import { supabase } from './supabaseClient'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  try {
    const existing = await navigator.serviceWorker.getRegistration('/')
    if (existing) return existing
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch (e) {
    console.warn('SW registration failed:', e)
    return null
  }
}

export async function subscribeToPush(registration) {
  if (!registration) return null
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null
  try {
    let subscription = await registration.pushManager.getSubscription()
    if (subscription) return subscription
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
    await supabase.from('push_subscriptions').upsert({
      user_id: session.user.id,
      subscription: JSON.stringify(subscription),
    }, { onConflict: 'user_id' })
    return subscription
  } catch (e) {
    console.warn('Push subscribe failed:', e)
    return null
  }
}

export async function unsubscribeFromPush() {
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      await subscription.unsubscribe()
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        await supabase.from('push_subscriptions').delete().eq('user_id', session.user.id)
      }
    }
  } catch (e) {
    console.warn('Unsubscribe failed:', e)
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}
