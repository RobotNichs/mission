import { useState } from 'react'
import PrestigePreview from './PrestigePreview'
import type { GamificationState } from '../types/gamification'
import { orbCollection, rarityLabels } from '../services/orbCatalog'
import { applyDebugAction, type DebugAction } from '../services/gamificationDebug'
import { isLocalDevelopment } from '../services/developmentMode'
import { getOrbSize } from '../services/orbSize'
import OrbVisual from './OrbVisual'
import { defaultOrb } from '../services/orbCatalog'

type Props = {
  state: GamificationState
  enabled: boolean
  onChange: (transform: (current: GamificationState) => GamificationState) => boolean
}

export default function GamificationDebug({ state, enabled, onChange }: Props) {
  const [orbId, setOrbId] = useState(orbCollection[0].id)
  const [notice, setNotice] = useState<string | null>(null)
  const [previewLevel, setPreviewLevel] = useState(1)
  if (!isLocalDevelopment(import.meta.env.DEV, window.location.hostname)) return null

  function apply(action: DebugAction) {
    if (!enabled || !isLocalDevelopment(import.meta.env.DEV, window.location.hostname)) return
    const saved = onChange((current) => applyDebugAction(current, action, import.meta.env.DEV, window.location.hostname))
    setNotice(saved ? action.type === 'add-test-coins' ? '300 Test-Coins hinzugefügt.' : 'Test-Orb freigeschaltet.' : 'Testwerte konnten nicht gespeichert werden.')
  }

  return (
    <details className="coin-shop panel gamification-debug">
      <summary>Lokaler Gamification-Testmodus</summary>
      <p className="shop-description">Nur für lokale Entwicklung. Testwerte werden auf diesem Gerät gespeichert; vorhandene Daten bleiben erhalten. Keine Fokuszeit und keine Level durch diese Aktionen.</p>
      <PrestigePreview />
      <section className="debug-level-preview" aria-label="Visuelle Level-Vorschau">
        <label className="field-label" htmlFor="debug-level-preview">Orb-Größe für Vorschau-Level {previewLevel}</label>
        <input id="debug-level-preview" type="range" min={1} max={100} step={1} value={previewLevel}
          onChange={event => {
            const value = Number(event.target.value)
            if (Number.isInteger(value) && value >= 1 && value <= 100) setPreviewLevel(value)
          }} />
        <p>Nur visuell. Dein echtes Spielerlevel und alle Fortschrittsdaten bleiben unverändert.</p>
        <OrbVisual orb={orbCollection.find(orb => orb.id === state.equippedOrbId) ?? defaultOrb}
          className="debug-preview-orb" label={`Orb-Vorschau, Level ${previewLevel}`}
          style={{ width: `${getOrbSize(previewLevel, 'focus')}px`, height: 'auto', aspectRatio: '1' }} />
        <button className="focus-leave" type="button" onClick={() => setPreviewLevel(1)}>Level-Vorschau zurücksetzen</button>
      </section>
      <div className="shop-confirm-actions">
        <button className="shop-action crate-buy" type="button" disabled={!enabled} onClick={() => apply({ type: 'add-test-coins' })}>300 Test-Coins hinzufügen</button>
      </div>
      <label className="field-label" htmlFor="debug-orb">Orb zu Testzwecken freischalten</label>
      <select id="debug-orb" value={orbId} disabled={!enabled} onChange={(event) => setOrbId(event.target.value)}>
        {orbCollection.map((orb) => <option key={orb.id} value={orb.id}>{orb.name} · {rarityLabels[orb.rarity]}</option>)}
      </select>
      <div className="shop-confirm-actions">
        <button className="shop-action crate-buy" type="button" disabled={!enabled || state.ownedOrbIds.includes(orbId)} onClick={() => apply({ type: 'unlock-test-orb', orbId })}>
          {state.ownedOrbIds.includes(orbId) ? 'Bereits freigeschaltet' : 'Test-Orb freischalten'}
        </button>
      </div>
      <p className="shop-notice" aria-live="polite">{notice ?? 'Reguläre Kisten und Fokus-Coins funktionieren unverändert.'}</p>
    </details>
  )
}
