import { useState } from 'react'
import {
  cosmeticShopItems,
  DEFAULT_BACKGROUND_ID,
  DEFAULT_CORE_EFFECT_ID,
  type CosmeticPurchaseResult,
} from '../services/gamification'
import type { GamificationState } from '../types/gamification'

type CoinShopProps = {
  state: GamificationState
  onPurchase: (itemId: string) => CosmeticPurchaseResult['status']
  onEquip: (itemId: string) => void
}

export default function CoinShop({ state, onPurchase, onEquip }: CoinShopProps) {
  const [pendingItemId, setPendingItemId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const pendingItem = cosmeticShopItems.find((item) => item.id === pendingItemId) ?? null

  function confirmPurchase() {
    if (!pendingItem) return
    const status = onPurchase(pendingItem.id)
    if (status === 'purchased') {
      setNotice(`${pendingItem.name} freigeschaltet. Du kannst es jetzt ausrüsten.`)
    } else if (status === 'already-owned') {
      setNotice('Dieser Gegenstand gehört dir bereits; es wurden keine Coins abgezogen.')
    } else if (status === 'insufficient-funds') {
      setNotice('Dafür hast du noch nicht genug Coins. Dein Kontostand bleibt unverändert.')
    }
    setPendingItemId(null)
  }

  return (
    <section className="coin-shop panel" aria-labelledby="coin-shop-title">
      <div className="shop-heading">
        <div>
          <p className="section-kicker">NUR KOSMETISCH</p>
          <h2 id="coin-shop-title">Coin-Shop</h2>
          <p className="shop-description">Keine Vorteile im Lernplan – nur dein eigener Look.</p>
        </div>
        <div className="shop-balance"><span aria-hidden="true">◉</span><strong>{state.coins}</strong><small>Coins</small></div>
      </div>

      <div className="shop-defaults" aria-label="Standarddesigns">
        <span>Standard:</span>
        <button type="button" aria-pressed={state.selectedBackgroundId === DEFAULT_BACKGROUND_ID} onClick={() => onEquip(DEFAULT_BACKGROUND_ID)}>Dunkelblau</button>
        <button type="button" aria-pressed={state.selectedCoreEffectId === DEFAULT_CORE_EFFECT_ID} onClick={() => onEquip(DEFAULT_CORE_EFFECT_ID)}>Core: Soft</button>
      </div>

      <div className="shop-items">
        {cosmeticShopItems.map((item) => {
          const isOwned = state.ownedCosmeticIds.includes(item.id)
          const isEquipped = item.kind === 'background'
            ? state.selectedBackgroundId === item.id
            : state.selectedCoreEffectId === item.id
          return (
            <article className={`shop-item ${isOwned ? 'is-owned' : ''}`} key={item.id}>
              <span className={`shop-swatch ${item.kind} ${item.id}`} aria-hidden="true" />
              <div className="shop-item-copy">
                <strong>{item.name}</strong>
                <span>{item.description}</span>
                <small>{item.kind === 'background' ? 'Hintergrund' : 'Core-Effekt'}</small>
              </div>
              {isOwned ? (
                <button className="shop-action secondary" type="button" disabled={isEquipped} onClick={() => onEquip(item.id)}>
                  {isEquipped ? 'Aktiv' : 'Anwenden'}
                </button>
              ) : (
                <button
                  className="shop-action"
                  type="button"
                  aria-label={`Kaufen ${item.name} für ${item.cost} Coins`}
                  disabled={state.coins < item.cost}
                  onClick={() => setPendingItemId(item.id)}
                >
                  <span>Kaufen</span><small>◉ {item.cost}</small>
                </button>
              )}
            </article>
          )
        })}
      </div>

      <p className="shop-notice" aria-live="polite">{notice ?? 'Käufe kosten nur erspielte Coins und werden lokal gespeichert.'}</p>

      {pendingItem && (
        <div className="shop-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPendingItemId(null) }}>
          <section className="shop-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="shop-confirm-title" aria-describedby="shop-confirm-description">
            <p className="section-kicker">KAUF BESTÄTIGEN</p>
            <h3 id="shop-confirm-title">{pendingItem.name}</h3>
            <p id="shop-confirm-description">Möchtest du <strong>{pendingItem.cost} Coins</strong> für diese kosmetische Änderung ausgeben? Der Kauf bringt keine Lernvorteile und kann nicht rückgängig gemacht werden.</p>
            <div className="shop-confirm-actions">
              <button className="secondary" type="button" onClick={() => setPendingItemId(null)}>Abbrechen</button>
              <button className="shop-action" type="button" onClick={confirmPurchase}>Für {pendingItem.cost} Coins kaufen</button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
