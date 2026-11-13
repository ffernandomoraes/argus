// Service worker do app do celular: só as notificações. O conteúdo chega cifrado pelo Argus de casa
// (RFC 8291) e o navegador decifra antes de entregar aqui. Nada fica guardado em cache: a página
// sempre vem da ponte, na versão publicada.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }
  const title = typeof data.title === 'string' ? data.title : 'Argus'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === 'string' ? data.body : '',
      tag: typeof data.tag === 'string' ? data.tag : undefined,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: typeof data.url === 'string' && data.url.startsWith('#') ? data.url : '#/' }
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL('/' + (event.notification.data?.url ?? '#/'), self.location.origin).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue
        await client.focus()
        client.postMessage({ type: 'open', url: event.notification.data?.url ?? '#/' })
        return
      }
      await self.clients.openWindow(target)
    })()
  )
})
