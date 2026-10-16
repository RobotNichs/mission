import { useState } from 'react'
import MissionCompanion, { type CompanionState } from './MissionCompanion'
import './CompanionPreview.css'
import { companionSkins, type CompanionSkinId } from './companionSkins'

export default function CompanionPreview() {
  const [success, setSuccess] = useState(false)
  const [levelUp, setLevelUp] = useState(false)
  const [error, setError] = useState(false)
  const [smallState, setSmallState] = useState<CompanionState>('idle')
  const states: CompanionState[] = ['idle', 'focus', 'pause', 'error', 'offline', 'success', 'levelUp']
  const [reducedMotion, setReducedMotion] = useState(false)
  const [skinState, setSkinState] = useState<CompanionState>('idle')
  return <main className="companion-preview" data-reduced-motion={reducedMotion}>
    <header><p className="section-kicker">LOKALE DESIGN-PREVIEW</p><h1>Mission Companion Base</h1>
      <p>Isolierte Darstellung ohne Mission, Vergütung oder gespeicherte Änderungen.</p><a href="/">Zur App</a>
      <label className="companion-preview-motion"><input type="checkbox" checked={reducedMotion} onChange={event => setReducedMotion(event.target.checked)} />Reduzierte Bewegung simulieren</label>
      <p>Die Systempräferenz für reduzierte Bewegung gilt unabhängig vom Schalter.</p></header>
    <section className="companion-skin-comparison" aria-labelledby="skin-comparison-title">
      <h2 id="skin-comparison-title">Starter-Skins</h2>
      <label className="companion-preview-small-state">Zustand für alle Starter-Skins<select value={skinState} onChange={event => {
        const state = states.find(value => value === event.target.value)
        if (state) setSkinState(state)
      }}>{states.map(state => <option key={state} value={state}>{state}</option>)}</select></label>
      <div className="companion-skin-grid">{(Object.keys(companionSkins) as CompanionSkinId[]).map(skin => <figure key={skin}>
        <h3>{companionSkins[skin].name}</h3>
        <MissionCompanion skin={skin} state={skinState} size={120} label={`${companionSkins[skin].name}, 120 px`} />
        <MissionCompanion skin={skin} state={skinState} size={60} label={`${companionSkins[skin].name}, 60 px`} />
        <figcaption>{skin === 'luna' ? 'Classic Mission' : skin === 'milo' ? 'Warm Cream' : 'Galaxy'} · 120 / 60 px</figcaption>
      </figure>)}</div>
    </section>
    <div className="companion-preview-grid">
      <figure><MissionCompanion label="Companion: aufmerksam" /><MissionCompanion size={60} label="Companion: aufmerksam, 60 px" /><figcaption>Idle · 120 / 60 px</figcaption></figure>
      <figure><MissionCompanion state="focus" label="Companion: konzentriert" /><MissionCompanion size={60} state="focus" label="Companion: konzentriert, 60 px" /><figcaption>Focus · 120 / 60 px</figcaption></figure>
      <figure><MissionCompanion state="pause" label="Companion: entspannt pausiert" /><MissionCompanion size={60} state="pause" label="Companion: entspannt pausiert, 60 px" /><figcaption>Pause · 120 / 60 px</figcaption></figure>
      <figure><MissionCompanion state="error" animated={error} label="Companion: fragend" /><MissionCompanion size={60} state="error" animated={error} label="Companion: fragend, 60 px" /><figcaption>Error · 120 / 60 px</figcaption>
        <button type="button" onClick={() => setError(value => !value)}>{error ? 'Error zurücksetzen' : 'Error auslösen'}</button></figure>
      <figure><MissionCompanion state="offline" label="Companion: offline" /><MissionCompanion size={60} state="offline" label="Companion: offline, 60 px" /><figcaption>Offline · 120 / 60 px</figcaption></figure>
      <figure><MissionCompanion state="success" animated={success} label="Companion: Erfolg" /><MissionCompanion size={60} state="success" animated={success} label="Companion: Erfolg, 60 px" /><figcaption>Success · 120 / 60 px</figcaption>
        <button type="button" onClick={() => setSuccess(value => !value)}>{success ? 'Erfolg zurücksetzen' : 'Erfolg auslösen'}</button></figure>
      <figure><MissionCompanion state="levelUp" animated={levelUp} label="Companion: Level-Up" /><MissionCompanion size={60} state="levelUp" animated={levelUp} label="Companion: Level-Up, 60 px" /><figcaption>Level-Up · 120 / 60 px</figcaption>
        <button type="button" onClick={() => setLevelUp(value => !value)}>{levelUp ? 'Level-Up zurücksetzen' : 'Level-Up auslösen'}</button></figure>
      <figure><MissionCompanion size={60} state={smallState} label="Companion: kleine Darstellung" /><figcaption>Small · 60 px</figcaption>
        <label className="companion-preview-small-state">Kleine Vorschau: Zustand<select value={smallState} onChange={event => {
          const state = states.find(value => value === event.target.value)
          if (state) setSmallState(state)
        }}>{states.map(state => <option key={state} value={state}>{state}</option>)}</select></label></figure>
      <figure><MissionCompanion silhouette animated={false} label="Companion: Katzen-Silhouette" /><figcaption>Silhouette · ohne Glow</figcaption></figure>
      <figure><MissionCompanion size={200} animated={false} label="Companion: große Darstellung" /><figcaption>Large · 200 px · statisch</figcaption></figure>
    </div>
  </main>
}
