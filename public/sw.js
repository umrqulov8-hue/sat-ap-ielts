self.addEventListener('push', function (event) {
  if (!event.data) return
  try {
    const data = event.data.json()
    self.registration.showNotification(data.title || 'SATAP Academy', {
      body: data.body || '',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      image: data.image || undefined,
      data: data.data || { url: '/' },
      actions: data.actions || [{ action: 'open', title: 'Open App' }],
      vibrate: [200, 100, 200],
      requireInteraction: true,
    })
  } catch (e) {
    console.error('SW push error:', e)
  }
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const url = event.notification.data?.url || '/dashboard'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
