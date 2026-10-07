import { useEffect, useRef, useState } from 'react'
import { hasPwaUpdate } from '../services/pwa'
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
export function usePwaStatus() {
  const [offline, setOffline] = useState(() => !navigator.onLine)
  const [update, setUpdate] = useState(hasPwaUpdate)
  const [installable, setInstallable] = useState(false)
  const [installing, setInstalling] = useState(false)
  const prompt = useRef<InstallPrompt | null>(null)
  useEffect(() => {
    const connectivity = () => setOffline(!navigator.onLine)
    const available = () => setUpdate(hasPwaUpdate())
    const beforeInstall = (event: Event) => {
      if (window.matchMedia?.('(display-mode: standalone)').matches) return
      const candidate = event as Partial<InstallPrompt>
      if (typeof candidate.prompt !== 'function' || !candidate.userChoice) return
      event.preventDefault(); prompt.current = event as InstallPrompt; setInstallable(true)
    }
    const installed = () => { prompt.current = null; setInstallable(false) }
    connectivity(); available()
    window.addEventListener('online', connectivity); window.addEventListener('offline', connectivity)
    window.addEventListener('mission:pwa-update', available)
    window.addEventListener('beforeinstallprompt', beforeInstall); window.addEventListener('appinstalled', installed)
    return () => {
      window.removeEventListener('online', connectivity); window.removeEventListener('offline', connectivity)
      window.removeEventListener('mission:pwa-update', available)
      window.removeEventListener('beforeinstallprompt', beforeInstall); window.removeEventListener('appinstalled', installed)
    }
  }, [])
  async function install() {
    const event = prompt.current
    if (!event || installing) return
    prompt.current = null; setInstallable(false); setInstalling(true)
    try { await event.prompt(); await event.userChoice } catch { /* Native dialog unsupported/cancelled: continue normally. */ }
    finally { setInstalling(false) }
  }
  return { offline, update, installable, installing, install }
}
export default function PwaStatus({ status }: { status: ReturnType<typeof usePwaStatus> }) {
  if (!status.offline && !status.update && !status.installable) return null
  return <div className="pwa-status">
    {status.offline && <span role="status">Offline · lokale Funktionen verfügbar</span>}
    {status.update && <span role="status" title="Schließe alle Mission-Fenster. Die neue Version wird beim nächsten Start verwendet.">Neue Version verfügbar · beim nächsten Start</span>}
    {status.installable && <button type="button" className="focus-leave" disabled={status.installing} onClick={() => void status.install()}>App installieren</button>}
  </div>
}
