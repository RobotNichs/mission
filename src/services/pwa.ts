let updateAvailable = false
export const hasPwaUpdate = () => updateAvailable
export async function initializePwa(production: boolean): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  try {
    if (!production) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      for (const registration of registrations) {
        const workers = [registration.active, registration.waiting, registration.installing]
        if (workers.some(worker => worker && new URL(worker.scriptURL).origin === location.origin
          && new URL(worker.scriptURL).pathname === '/sw.js')) await registration.unregister()
      }
      if ('caches' in window) for (const name of await caches.keys()) {
        if (name.startsWith('mission-app-shell-')) await caches.delete(name)
      }
      return
    }
    if (!window.isSecureContext) return
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
    function reportUpdate() {
      if (!registration.waiting) return
      updateAvailable = true
      window.dispatchEvent(new Event('mission:pwa-update'))
    }
    reportUpdate()
    registration.addEventListener('updatefound', () => {
      registration.installing?.addEventListener('statechange', reportUpdate)
    })
  } catch { /* Installation/cache restrictions must never stop the local app. */ }
}
