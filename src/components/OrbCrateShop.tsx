import { useEffect, useRef, useState, type Ref } from 'react'
import { ORB_CRATE_COST, type CratePurchaseResult } from '../services/gamification'
import { rarityLabels } from '../services/orbCatalog'
import type { GamificationState } from '../types/gamification'
import OrbVisual from './OrbVisual'
import UiIcon from './UiIcon'

type Props = { state: GamificationState; enabled: boolean; onPurchase: (purchaseId: string) => CratePurchaseResult; onOpenCollection: () => void; sectionRef?: Ref<HTMLElement> }

export default function OrbCrateShop({ state, enabled, onPurchase, onOpenCollection, sectionRef }: Props) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [result, setResult] = useState<CratePurchaseResult | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  const consumed = useRef<string | null>(null)
  const dialog = useRef<HTMLElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)
  const modalOpen = pendingId !== null || result !== null

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!media) return
    const update = () => setReducedMotion(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!result || revealed) return
    if (reducedMotion) { setRevealed(true); return }
    const timeout = window.setTimeout(() => setRevealed(true), 900)
    return () => window.clearTimeout(timeout)
  }, [result, revealed, reducedMotion])

  useEffect(() => {
    if (modalOpen) dialog.current?.querySelector<HTMLButtonElement>('button')?.focus()
    else if (wasOpen.current) trigger.current?.focus()
    wasOpen.current = modalOpen
  }, [modalOpen, pendingId, revealed])

  function close() { setPendingId(null); setResult(null) }
  function confirm() {
    if (!enabled || !pendingId || consumed.current === pendingId) return
    consumed.current = pendingId
    const purchase = onPurchase(pendingId)
    setPendingId(null)
    if (purchase.status === 'purchased') {
      setRevealed(reducedMotion)
      setResult(purchase)
    } else setNotice(purchase.status === 'insufficient-funds'
      ? 'Du brauchst 30 Coins. Dein Kontostand bleibt unverändert.'
      : 'Der Kauf konnte nicht ausgeführt werden. Es wurde keine weitere Kiste gekauft.')
  }

  return (
    <section ref={sectionRef} className="coin-shop panel crate-shop" aria-labelledby="crate-shop-title">
      <div className="shop-heading">
        <div><p className="section-kicker">DEIN NÄCHSTER FUND</p><h2 id="crate-shop-title">Orb-Kiste</h2>
          <p className="shop-description">Ein zufälliger Orb. Dein eigener Look. Nur mit Fokus-Coins.</p></div>
        <div className="crate-heading-actions">
        <button className="focus-leave" type="button" disabled={modalOpen} onClick={onOpenCollection}><UiIcon name="collection" />Sammlung</button>
        <button ref={trigger} className="shop-action crate-buy" type="button" disabled={!enabled || state.coins < ORB_CRATE_COST || modalOpen}
          aria-label={`Kiste kaufen · ${ORB_CRATE_COST} Coins`}
          onClick={() => { consumed.current = null; setPendingId(crypto.randomUUID()) }}>Kiste kaufen · <UiIcon name="coin" />{ORB_CRATE_COST}</button>
        </div>
      </div>
      <p className="crate-chances">Gewöhnlich 60 % · Selten 25 % · Episch 12 % · Legendär 3 %</p>
      <p className="shop-notice" aria-live="polite">{notice ?? 'Jede Kiste enthält genau einen Orb. Duplikate geben keine Coins. Keine Echtgeldkäufe.'}</p>
      {modalOpen && <div className="shop-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}>
        <section ref={dialog} className="shop-confirm-modal crate-dialog" role={pendingId ? 'alertdialog' : 'dialog'} aria-modal="true"
          aria-labelledby="crate-dialog-title" aria-describedby="crate-dialog-description"
          onKeyDown={(event) => {
            if (event.key === 'Escape') { event.preventDefault(); close() }
            if (event.key === 'Tab') {
              const buttons = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
              const first = buttons[0], last = buttons[buttons.length - 1]
              if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
              else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
            }
          }}>
          {pendingId ? <>
            <p className="section-kicker">KAUF BESTÄTIGEN</p><h3 id="crate-dialog-title">Orb-Kiste kaufen?</h3>
            <p id="crate-dialog-description">Du gibst 30 Coins für genau einen zufälligen Orb aus. Bereits gesammelte Orbs können erneut erscheinen; dafür gibt es keine Erstattung.</p>
            <div className="shop-confirm-actions"><button className="secondary" type="button" onClick={close}>Abbrechen</button>
              <button className="shop-action" type="button" disabled={!enabled} onClick={confirm}>Für 30 Coins kaufen und öffnen</button></div>
          </> : result?.orb && <>
            <p className="section-kicker">DEIN FUND</p><h3 id="crate-dialog-title">{revealed ? result.orb.name : 'Deine Kiste öffnet sich …'}</h3>
            {revealed ? <div className="crate-result" aria-live="polite">
              <OrbVisual orb={result.orb} label={result.orb.name} />
              <strong>{result.duplicate ? 'Bereits in deiner Sammlung' : 'Neu freigeschaltet'}</strong>
              <span>{rarityLabels[result.orb.rarity]}</span>
            </div> : <div className="crate-opening" aria-hidden="true"><span>✦</span></div>}
            <p id="crate-dialog-description">{revealed ? result.orb.description : 'Dein Orb wurde bereits sicher in der Sammlung gespeichert.'}</p>
            <div className="shop-confirm-actions">{!revealed && <button className="secondary" type="button" onClick={() => setRevealed(true)}>Animation überspringen</button>}
              <button className="shop-action" type="button" onClick={close}>Schließen</button></div>
          </>}
        </section>
      </div>}
    </section>
  )
}
