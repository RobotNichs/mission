import OrbVisual from './OrbVisual'
import { defaultOrb, rarityLabels } from '../services/orbCatalog'
import type { GamificationState } from '../types/gamification'
import {
  getCoreSize,
  getLevel,
  getLevelStartMinutes,
  orbCollection,
} from '../services/gamification'

type GamificationPanelProps = {
  state: GamificationState
  rewardNotice: string | null
  onEquipOrb: (orbId: string | null) => void
}

export default function GamificationPanel({ state, rewardNotice, onEquipOrb }: GamificationPanelProps) {
  const focusMinutes = state.totalFocusMilliseconds / 60_000
  const level = getLevel(focusMinutes)
  const withinLevel = focusMinutes - getLevelStartMinutes(level)
  const required = getLevelStartMinutes(level + 1) - getLevelStartMinutes(level)
  const progress = (withinLevel / required) * 100
  const equippedOrb = orbCollection.find((orb) => orb.id === state.equippedOrbId) ?? defaultOrb
  const ownedOrbIds = new Set(state.ownedOrbIds)

  return (
    <section className="gamification-panel" aria-label="Dein Mission-Fortschritt">
      <div className="core-column">
        <div className={`mission-core core-orb-${state.equippedOrbId ? equippedOrb.rarity : 'default'} core-effect-${state.selectedCoreEffectId}`}
          style={{ width: getCoreSize(level), height: getCoreSize(level) }} role="img" aria-label={`Mission Core, Level ${level}`}>
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

      <div className="collection-column">
        <div className="collection-title-row">
          <div>
            <p className="section-kicker">KLEINE FUNDSTÜCKE</p>
            <h2>Deine Orb-Sammlung <span>{state.ownedOrbIds.length}/{orbCollection.length}</span></h2>
          </div>
        </div>
        <ul className="orb-collection" aria-label="Alle Orbs" tabIndex={0}>
          <li><button className={`orb-card is-owned ${state.equippedOrbId === null ? 'is-equipped' : ''}`} type="button" aria-label="Ausrüsten: Standard-Orb" aria-pressed={state.equippedOrbId === null} onClick={() => onEquipOrb(null)}><OrbVisual /><span className="orb-name">Standard-Orb</span><span className="orb-rarity">Immer verfügbar</span></button></li>
          {orbCollection.map((orb) => {
            const isOwned = ownedOrbIds.has(orb.id)
            const isEquipped = state.equippedOrbId === orb.id
            return (
              <li key={orb.id}>
                <button
                  className={`orb-card ${isOwned ? 'is-owned' : 'is-locked'} ${isEquipped ? 'is-equipped' : ''}`}
                  type="button"
                  aria-label={`${isOwned ? 'Ausrüsten' : 'Gesperrt'}: ${orb.name}`}
                  aria-pressed={isEquipped}
                  disabled={!isOwned}
                  onClick={() => onEquipOrb(orb.id)}
                >
                  <OrbVisual orb={orb} />
                  <span className="orb-name">{orb.name}</span>
                  <span className={`orb-rarity rarity-${orb.rarity}`}>{isEquipped ? 'Ausgerüstet' : isOwned ? rarityLabels[orb.rarity] : 'Gesperrt'}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="drop-rates">
          Neue Orbs findest du ausschließlich in gekauften Kisten. Der Standard-Orb ist immer verfügbar.
        </p>
      </div>
    </section>
  )
}
