import { getEquippedOrb } from '../services/prestigeOrbs'
import { getOrbSize } from '../services/orbSize'
import type { Ref } from 'react'
import OrbVisual from './OrbVisual'
import UiIcon from './UiIcon'
import { getPrestige } from '../services/prestige'
import { formatFocusTime } from '../services/formatFocusTime'
import type { GamificationState } from '../types/gamification'
import {
  getLevel,
  getLevelStartMinutes,
} from '../services/gamification'

type GamificationPanelProps = {
  state: GamificationState
  rewardNotice: string | null
  coreRef?: Ref<HTMLDivElement>
  sectionRef?: Ref<HTMLElement>
  displayLevel?: number
  hidden?: boolean
}

export default function GamificationPanel({ state, rewardNotice, coreRef, sectionRef, displayLevel, hidden }: GamificationPanelProps) {
  const focusMinutes = state.totalFocusMilliseconds / 60_000
  const level = getLevel(focusMinutes)
  const effectiveDisplayLevel = import.meta.env.DEV ? displayLevel ?? level : level
  const withinLevel = focusMinutes - getLevelStartMinutes(level)
  const required = getLevelStartMinutes(level + 1) - getLevelStartMinutes(level)
  const progress = (withinLevel / required) * 100
  const equippedOrb = getEquippedOrb(state)

  return (
    <section hidden={hidden} ref={sectionRef} className="gamification-panel mission-core-panel" aria-label="Dein Mission-Fortschritt">
      <header className="mission-core-heading"><p className="section-kicker">DEIN LANGFRISTIGER FORTSCHRITT</p><h2>Mission Core</h2></header>
      <div className="core-column">
        <div ref={coreRef} className={`mission-core core-orb-${state.equippedOrbId ? equippedOrb.rarity : 'default'} core-effect-${state.selectedCoreEffectId}`}
          style={{ width: `min(${getOrbSize(effectiveDisplayLevel) * 1.8}px, 220px, 100%)`, aspectRatio: '1' }} role="img" aria-label={`Mission Core, Level ${effectiveDisplayLevel}`}>
          <OrbVisual orb={equippedOrb} className="core-orb-art" />
        </div>
        <span className="core-caption">{equippedOrb.name}</span>
      </div>

      <div className="level-column">
        <div className="level-title-row">
          <div>
            <p className="section-kicker">DEIN FORTSCHRITT</p>
            <h2>Level {effectiveDisplayLevel}</h2>
            {import.meta.env.DEV && effectiveDisplayLevel !== level && <small>Visuelle Vorschau · Echter Level {level}</small>}
          </div>
        </div>
        <dl className="core-stats">
          <div className="core-focus-stat"><dt>Gesamtfokuszeit</dt><dd>{formatFocusTime(state.totalFocusMilliseconds)}</dd></div>
          <div><dt>Coins</dt><dd className="coin-count" aria-label={`${state.coins} Coins`}><UiIcon name="coin" /><strong>{state.coins}</strong></dd></div>
          <div><dt>Prestige</dt><dd>Prestige {getPrestige(state.totalFocusMilliseconds).label}</dd></div>
        </dl>
        <div className="focus-copy">
          <span>Noch {Math.ceil(required - withinLevel)} Fokusminuten bis Level {level + 1}</span>
        </div>
        <div className="focus-track" role="progressbar" aria-label="Fortschritt zum nächsten Level" aria-valuenow={Math.floor(withinLevel)} aria-valuemin={0} aria-valuemax={required}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <p className="reward-notice" aria-live="polite">{rewardNotice ?? '1 Coin pro voller Fokusminute – auch über mehrere Sitzungen.'}</p>
      </div>

    </section>
  )
}
