import type { OrbDefinition } from '../types/gamification'

type MissionReward = {
  xpAdded: number
  coinsAdded: number
  orb: OrbDefinition
  orbWasAlreadyOwned: boolean
}

type MissionRewardDialogProps = {
  reward: MissionReward
  onClose: () => void
}

const rarityLabels = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
} as const

export type { MissionReward }

export default function MissionRewardDialog({ reward, onClose }: MissionRewardDialogProps) {
  return (
    <div
      className="reward-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="reward-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reward-modal-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose()
        }}
      >
        <button className="reward-modal-close" type="button" aria-label="Belohnung schließen" onClick={onClose} autoFocus>×</button>
        <p className="section-kicker">MISSION ABGESCHLOSSEN</p>
        <h2 id="reward-modal-title">Starker Abschluss.</h2>
        <p className="reward-modal-copy">Dein Einsatz hat sich gelohnt. Diese Belohnung gehört dir:</p>

        <div className="reward-totals">
          <div><strong>+{reward.xpAdded}</strong><span>XP</span></div>
          <div><strong>+{reward.coinsAdded}</strong><span>Coins</span></div>
        </div>

        <div className={`reward-orb-card ${reward.orbWasAlreadyOwned ? 'is-duplicate' : 'is-new'}`}>
          <span className={`orb-visual orb-${reward.orb.rarity}`} aria-hidden="true"><span /></span>
          <div className="reward-orb-copy">
            <span className="reward-orb-status">{reward.orbWasAlreadyOwned ? 'Bereits vorhanden' : 'Neu freigeschaltet'}</span>
            <strong>{reward.orb.name}</strong>
            <span>{rarityLabels[reward.orb.rarity]} · {reward.orb.description}</span>
          </div>
        </div>

        {reward.orbWasAlreadyOwned && <p className="duplicate-note">Du erhältst keine zusätzlichen XP oder Coins durch doppelte Orbs.</p>}
        <button className="reward-modal-action" type="button" onClick={onClose}>Weiterlernen</button>
      </section>
    </div>
  )
}
