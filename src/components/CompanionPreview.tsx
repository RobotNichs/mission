import { useState } from 'react'
import MissionCompanion from './MissionCompanion'
import './CompanionPreview.css'

export default function CompanionPreview() {
  const [success, setSuccess] = useState(false)
  return <main className="companion-preview">
    <header><p className="section-kicker">LOKALE DESIGN-PREVIEW</p><h1>Mission Companion Base</h1>
      <p>Isolierte Darstellung ohne Mission, Vergütung oder gespeicherte Änderungen.</p><a href="/">Zur App</a></header>
    <div className="companion-preview-grid">
      <figure><MissionCompanion label="Companion: aufmerksam" /><figcaption>Idle · 120 px</figcaption></figure>
      <figure><MissionCompanion state="focus" label="Companion: konzentriert" /><figcaption>Focus · 120 px</figcaption></figure>
      <figure><MissionCompanion state={success ? 'success' : 'idle'} label="Companion: Erfolg" /><figcaption>Success · 120 px</figcaption>
        <button type="button" onClick={() => setSuccess(value => !value)}>{success ? 'Zurück zu Idle' : 'Erfolg auslösen'}</button></figure>
      <figure><MissionCompanion size={60} label="Companion: kleine Darstellung" /><figcaption>Small · 60 px</figcaption></figure>
      <figure><MissionCompanion silhouette animated={false} label="Companion: Katzen-Silhouette" /><figcaption>Silhouette · ohne Glow</figcaption></figure>
      <figure><MissionCompanion size={200} animated={false} label="Companion: große Darstellung" /><figcaption>Large · 200 px · statisch</figcaption></figure>
    </div>
  </main>
}
