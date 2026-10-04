import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import OrbVisual from './OrbVisual'
import { rarityLabels, orbCollection } from '../services/orbCatalog'
import type { GamificationState } from '../types/gamification'
import { isPrestigeOrbAvailable, prestigeOrbs } from '../services/prestigeOrbs'

type Props = { state: GamificationState; onEquipOrb: (id: string | null) => void; onClose: () => void; enabled: boolean }
export default function OrbCollectionDialog({ state, onEquipOrb, onClose, enabled }: Props) {
  const panel = useRef<HTMLElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  const ownedOrbIds = new Set(state.ownedOrbIds)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const siblings = Array.from(document.body.children).filter(e => !e.contains(panel.current)) as HTMLElement[]
    const old = siblings.map(e => ({ e, inert: e.inert, hidden: e.getAttribute('aria-hidden') }))
    old.forEach(({ e }) => { e.inert = true; e.setAttribute('aria-hidden', 'true') })
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); return }
      if (event.key !== 'Tab') return
      const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
      const first = buttons[0], last = buttons[buttons.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    const focus = (event: FocusEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target)) panel.current?.querySelector<HTMLButtonElement>('button')?.focus()
    }
    document.addEventListener('keydown', keydown)
    document.addEventListener('focusin', focus)
    return () => {
      document.removeEventListener('keydown', keydown); document.removeEventListener('focusin', focus)
      document.body.style.overflow = overflow
      old.forEach(({ e, inert, hidden }) => { e.inert = inert; if (hidden === null) e.removeAttribute('aria-hidden'); else e.setAttribute('aria-hidden', hidden) })
      if (previous?.isConnected) previous.focus()
    }
  }, [])
  return createPortal(<div className="shop-modal-backdrop collection-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <section ref={panel} role="dialog" aria-modal="true" aria-labelledby="collection-dialog-title" className="shop-confirm-modal collection-dialog">
      <header className="collection-dialog-header">
      <h2 id="collection-dialog-title">Deine Orb-Sammlung</h2>
      <button className="focus-leave" type="button" onClick={onClose}>Sammlung schließen</button>
      </header>
      <div className="collection-dialog-scroll">
      <fieldset disabled={!enabled}>
      <div className="collection-column">
        <p className="section-kicker">{state.ownedOrbIds.length}/{orbCollection.length} Orbs gesammelt · Standard-Orb immer verfügbar</p>
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
          Normale Orbs findest du ausschließlich in gekauften Kisten. Der Standard-Orb ist immer verfügbar.
        </p>
        <h3 className="prestige-collection-title">Prestige</h3>
        <ul className="orb-collection" aria-label="Prestige-Orbs" tabIndex={0}>{prestigeOrbs.map(({ orb, stage }) => {
          const available = isPrestigeOrbAvailable(state.totalFocusMilliseconds, orb.id)
          const equipped = state.equippedOrbId === orb.id
          return <li key={orb.id}><button type="button" className={`orb-card ${available ? 'is-owned' : 'is-locked'} ${equipped ? 'is-equipped' : ''}`}
            aria-label={`${available ? 'Ausrüsten' : 'Gesperrt'}: ${orb.name}`} aria-pressed={equipped} disabled={!available}
            onClick={() => onEquipOrb(orb.id)}>
            <OrbVisual orb={orb} /><span className="orb-name">{orb.name}</span>
            <span className="orb-rarity">{equipped ? 'Ausgerüstet' : `Prestige ${stage.label}`}</span>
            <span className="orb-rarity">{available ? 'Freigeschaltet' : `${stage.hours.toLocaleString('de-DE')} h Fokuszeit benötigt`}</span>
          </button></li>
        })}</ul>
      </div>

      </fieldset>
      </div>
    </section>
  </div>, document.body)
}
