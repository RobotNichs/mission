import type { GamificationState, OrbRarity } from '../types/gamification'
import {
  getCoreSize,
  getLevel,
  getLevelStartMinutes,
  orbCollection,
} from '../services/gamification'

type GamificationPanelProps = {
  state: GamificationState
  rewardNotice: string | null
  onEquipOrb: (orbId: string) => void
}

const rarityLabels: Record<OrbRarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
}

export default function GamificationPanel({ state, rewardNotice, onEquipOrb }: GamificationPanelProps) {
  const focusMinutes = state.totalFocusMilliseconds / 60_000
  const level = getLevel(focusMinutes)
  const withinLevel = focusMinutes - getLevelStartMinutes(level)
  const required = getLevelStartMinutes(level + 1) - getLevelStartMinutes(level)
  const progress = (withinLevel / required) * 100
  const ownedOrbIds = new Set(state.ownedOrbIds)

  return (
    <section className="gamification-panel" aria-label="Dein Mission-Fortschritt">
      <div className="core-column">
        <div
          className={`mission-core ${state.equippedOrbId ? `core-orb-${orbCollection.find((orb) => orb.id === state.equippedOrbId)?.rarity ?? 'common'}` : 'core-orb-default'} core-effect-${state.selectedCoreEffectId}`}
          style={{
            width: getCoreSize(level),
            height: getCoreSize(level),
            filter: `hue-rotate(${(level - 1) * 18}deg) saturate(${1 + Math.min(level - 1, 8) * 0.025})`,
          }}
          role="img"
          aria-label={`Mission Core, Level ${level}`}
        >
          <svg className="core-svg" viewBox="0 0 100 100" aria-hidden="true">
            <circle className="core-orbit" cx="50" cy="50" r="39" />
            <circle className="core-ring" cx="50" cy="50" r="29" />
            <circle className="core-inner" cx="50" cy="50" r="20" />
            <circle className="core-point" cx="76" cy="33" r="3" />
          </svg>
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
        <ul className="orb-collection">
          {orbCollection.map((orb) => {
            const isOwned = ownedOrbIds.has(orb.id)
            const isEquipped = state.equippedOrbId === orb.id
            return (
              <li key={orb.id}>
                <button
                  className={`orb-card ${isOwned ? 'is-owned' : 'is-locked'} ${isEquipped ? 'is-equipped' : ''}`}
                  type="button"
                  aria-label={`${isOwned ? 'Ausrüsten' : 'Gesperrt'}: ${isOwned ? orb.name : rarityLabels[orb.rarity]}`}
                  aria-pressed={isEquipped}
                  disabled={!isOwned}
                  onClick={() => onEquipOrb(orb.id)}
                >
                  <span className={`orb-visual orb-${orb.rarity}`} aria-hidden="true"><span /></span>
                  <span className="orb-name">{isOwned ? orb.name : 'Gesperrt'}</span>
                  <span className={`orb-rarity rarity-${orb.rarity}`}>{isEquipped ? 'Ausgerüstet' : rarityLabels[orb.rarity]}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="drop-rates">
          Deine bisher gesammelten Orbs bleiben erhalten. Missionsabschlüsse vergeben keine neuen Orbs.
        </p>
      </div>
    </section>
  )
}
