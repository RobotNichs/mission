import type { GamificationState, OrbRarity } from '../types/gamification'
import {
  getCoreSize,
  getLevel,
  getXpToNextLevel,
  getXpWithinLevel,
  orbCollection,
  rarityProbabilities,
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
  const level = getLevel(state.xp)
  const xpWithinLevel = getXpWithinLevel(state.xp)
  const progress = (xpWithinLevel / 100) * 100
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
        <div className="xp-copy">
          <span>{state.xp} XP gesamt</span>
          <span>Noch {getXpToNextLevel(state.xp)} XP bis Level {level + 1}</span>
        </div>
        <div className="xp-track" role="progressbar" aria-label="Fortschritt zum nächsten Level" aria-valuenow={xpWithinLevel} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <p className="reward-notice" aria-live="polite">{rewardNotice ?? 'Jeder erledigte Schritt bringt dich weiter.'}</p>
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
          Missionsfund: Common {rarityProbabilities.common * 100}% · Rare {rarityProbabilities.rare * 100}% · Epic {rarityProbabilities.epic * 100}% · Legendary {rarityProbabilities.legendary * 100}%
        </p>
      </div>
    </section>
  )
}
