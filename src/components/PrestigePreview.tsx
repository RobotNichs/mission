import { useState } from 'react'
import { prestigeMilestones } from '../services/prestige'

// Imported only through the development-only GamificationDebug module.
export default function PrestigePreview() {
  const [rank, setRank] = useState(0)
  return <section className="prestige-preview" aria-label="Visuelle Prestige-Vorschau">
    <label className="field-label">Prestige-Vorschau<select value={rank} onChange={event => {
      const value = Number(event.target.value)
      if (Number.isInteger(value) && value >= 0 && value <= 5) setRank(value)
    }}><option value={0}>Prestige 0</option>{prestigeMilestones.map(stage => <option key={stage.id} value={stage.rank}>Prestige {stage.label}</option>)}</select></label>
    <p>Nur visuell. Keine Fokuszeit, Coins oder echten Freischaltungen.</p>
    <strong>Vorschau: Prestige {prestigeMilestones[rank - 1]?.label ?? '0'}</strong>
    <ol className="prestige-stages">{prestigeMilestones.map(stage => <li key={stage.id}>
      <span>Prestige {stage.label}</span><span>{rank >= stage.rank ? 'Erreicht (Vorschau)' : 'Gesperrt (Vorschau)'}</span>
    </li>)}</ol>
    <button className="focus-leave" type="button" onClick={() => setRank(0)}>Prestige-Vorschau zurücksetzen</button>
  </section>
}
