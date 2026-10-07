/* Source template: the production build injects its static allowlist and content digest. */
const CACHE_NAME = '__MISSION_CACHE_NAME__'
const PRECACHE = /*__MISSION_PRECACHE__*/ []
const STATIC_PATHS = new Set(PRECACHE)
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME)
      await cache.addAll(PRECACHE.map(url => new Request(url, { credentials: 'omit', cache: 'reload' })))
    } catch (error) { await caches.delete(CACHE_NAME); throw error }
  })())
})
// No skipWaiting or clients.claim: updates cannot replace a worker during a session.
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter(name => name.startsWith('mission-app-shell-') && name !== CACHE_NAME).map(name => caches.delete(name)))
  })())
})
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url)
  // All API requests, authenticated requests and unknown paths remain network-only.
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('authorization')
    || url.pathname.startsWith('/api/')) return
  if (request.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/index.html')) {
    event.respondWith((async () => {
      try { const response = await fetch(request); if (response.ok) return response } catch { /* Offline: use only the static shell. */ }
      const cache = await caches.open(CACHE_NAME)
      return await cache.match('/index.html') ?? Response.error()
    })())
  } else if (!url.search && STATIC_PATHS.has(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME)
      return await cache.match(url.pathname) ?? fetch(request)
    })())
  }
})
