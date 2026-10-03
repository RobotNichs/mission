import { getOrbSize } from '../services/orbSize'
import OrbVisual from './OrbVisual'
import { defaultOrb } from '../services/orbCatalog'
import type { GamificationState } from '../types/gamification'
import {
  getLevel,
  getLevelStartMinutes,
  orbCollection,
} from '../services/gamification'

type GamificationPanelProps = {
  state: GamificationState
  rewardNotice: string | null
}

export default function GamificationPanel({ state, rewardNotice }: GamificationPanelProps) {
  const focusMinutes = state.totalFocusMilliseconds / 60_000
  const level = getLevel(focusMinutes)
  const withinLevel = focusMinutes - getLevelStartMinutes(level)
  const required = getLevelStartMinutes(level + 1) - getLevelStartMinutes(level)
  const progress = (withinLevel / required) * 100
  const equippedOrb = orbCollection.find((orb) => orb.id === state.equippedOrbId) ?? defaultOrb

  return (
    <section className="gamification-panel" aria-label="Dein Mission-Fortschritt">
      <div className="core-column">
        <div className={`mission-core core-orb-${state.equippedOrbId ? equippedOrb.rarity : 'default'} core-effect-${state.selectedCoreEffectId}`}
          style={{ width: `min(${getOrbSize(level)}px, 100%)`, aspectRatio: '1' }} role="img" aria-label={`Mission Core, Level ${level}`}>
          <OrbVisual orb={equippedOrb} className="core-orb-art" />
          <span className="core-center">{level.toString().padStart(2, '0')}</span>
        </div>
        <span className="core-caption">MISSION CORE</span>
      </div>

      <div className="level-column">
        <div className="level-title-row">
          <div>
            <p className="section-kicker">DEIN FORTSCHRITT</p>
            <h2>Level {level}</h2>
          </div>
          <div className="coin-count" aria-label={`${state.coins} Coins`}>
            <span className="coin-icon" aria-hidden="true">◉</span>
            <strong>{state.coins}</strong>
            <span>Coins</span>
          </div>
        </div>
        <div className="focus-copy">
          <span>{Math.floor(focusMinutes)} Fokusminuten gesamt</span>
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
