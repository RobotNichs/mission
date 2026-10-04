import { formatPrestigeTime, getPrestige } from '../services/prestige'
import { prestigeOrbs } from '../services/prestigeOrbs'
import OrbVisual from './OrbVisual'

export default function PrestigePanel({ focusMilliseconds }: { focusMilliseconds: number }) {
  const prestige = getPrestige(focusMilliseconds)
  return <details className="prestige-panel">
    <summary>Prestige {prestige.label} <span>Langfristiger Fortschritt</span></summary>
    <p>Gesamte anrechenbare Fokuszeit: <strong>{formatPrestigeTime(prestige.totalMilliseconds)}</strong></p>
    {prestige.next ? <>
      <p>Nächster Meilenstein: Prestige {prestige.next.label} bei {prestige.next.hours.toLocaleString('de-DE')} Stunden gesamt.</p>
      <p>Noch {formatPrestigeTime(prestige.remainingMilliseconds, true)} Fokuszeit.</p>
    </> : <p>Maximaler Prestige-Rang V erreicht.</p>}
    <div className="focus-track" role="progressbar" aria-label="Prestige-Fortschritt" aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={prestige.progress} aria-valuetext={prestige.next ? `Fortschritt zu Prestige ${prestige.next.label}` : 'Maximaler Prestige-Rang V'}>
      <span style={{ width: `${prestige.progress}%` }} />
    </div>
    <ol className="prestige-stages prestige-orb-path">{prestigeOrbs.map(({ stage, orb }) => <li key={stage.id} className={prestige.rank >= stage.rank ? 'is-reached' : 'is-locked'}>
      <OrbVisual orb={orb} /><strong>Prestige {stage.label}</strong><span>{orb.name}</span><span>{stage.hours.toLocaleString('de-DE')} h gesamt</span>
      <span>{prestige.rank >= stage.rank ? 'Freigeschaltet' : 'Gesperrt'}</span>
    </li>)}</ol>
    <p className="prestige-note">Prestige-Orbs sind kostenlos in deiner Sammlung auswählbar. Level, Coins und bisherige Orbs bleiben erhalten.</p>
  </details>
}
