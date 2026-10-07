import type { Ref } from 'react'
import UiIcon from './UiIcon'
import { mobileAreaLabels, type MobileArea } from './MobileNavigation'

export default function DesktopNavigation({ area, onArea, onInfo, onTour, helpRef, disabled, running }: {
  area: MobileArea; onArea: (area: MobileArea) => void; onInfo: () => void; onTour: () => void
  helpRef: Ref<HTMLButtonElement>; disabled: boolean; running: boolean
}) {
  return <aside className="desktop-sidebar">
    <span className="sidebar-brand">mission<span>.</span></span>
    <nav aria-label="Desktop Hauptnavigation">
      {(['home', 'plan', 'projects', 'library', 'progress'] as const).map(value =>
        <button type="button" key={value} disabled={disabled} aria-current={area === value ? 'page' : undefined} onClick={() => onArea(value)}>
          <UiIcon name={value === 'library' ? 'collection' : value === 'projects' ? 'projects' : value} /><span>{mobileAreaLabels[value]}</span>
        </button>)}
    </nav>
    <div className="sidebar-help">
      <button type="button" aria-label="Info, Datenschutz und Daten" onClick={onInfo}><UiIcon name="help" />Info & Daten</button>
      <a href="https://github.com/RobotNichs/mission/issues/new" target="_blank" rel="noopener noreferrer"><UiIcon name="feedback" />Feedback</a>
      <button ref={helpRef} type="button" aria-label="Mission-Tour starten" disabled={running || disabled} onClick={onTour}><UiIcon name="help" />Hilfe / Tutorial</button>
    </div>
  </aside>
}
