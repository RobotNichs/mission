import type { Ref } from 'react'
import OrbVisual from './OrbVisual'
import UiIcon from './UiIcon'
import { getOrbSize } from '../services/orbSize'
import type { OrbDefinition } from '../types/gamification'
export type MobileArea = 'home' | 'plan' | 'projects' | 'library' | 'progress'
export const mobileAreaLabels: Record<MobileArea, string> = { home: 'Home', plan: 'Plan', projects: 'Projekte', library: 'Bibliothek', progress: 'Fortschritt' }
export default function MobileNavigation({ area, onArea, onFocus, orb, level, disabled, orbRef, focusRef, hasMission }: {
  area: MobileArea; onArea: (area: MobileArea) => void; onFocus: () => void
  orb: OrbDefinition; level: number; disabled: boolean; orbRef: Ref<HTMLDivElement>; focusRef: Ref<HTMLButtonElement>; hasMission: boolean
}) {
  function tab(value: MobileArea, icon: 'home' | 'plan' | 'projects' | 'collection' | 'progress') {
    return <button type="button" disabled={disabled} aria-current={area === value ? 'page' : undefined}
      onClick={() => onArea(value)}><UiIcon name={icon} /><span>{mobileAreaLabels[value]}</span></button>
  }
  return <nav className="mobile-navigation" aria-label="Mobile Hauptnavigation">
    {tab('home', 'home')}{tab('plan', 'plan')}{tab('projects', 'projects')}
    <button ref={focusRef} type="button" className="mobile-orb-action" disabled={disabled} onClick={onFocus}
      aria-label={hasMission ? 'Fokusmodus öffnen' : 'Mission erstellen'}>
      <div ref={orbRef} className="mobile-navigation-orb" style={{ width: `${Math.max(44, Math.min(64, getOrbSize(level) * .52))}px` }}>
        <OrbVisual orb={orb} label={orb.name} />
      </div><span>Fokus</span>
    </button>
    {tab('library', 'collection')}{tab('progress', 'progress')}
  </nav>
}
