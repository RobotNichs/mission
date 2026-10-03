// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { equipOrb, GAMIFICATION_STORAGE_KEY, loadGamificationState, purchaseOrbCrate, rollOrb } from './gamification'
import { defaultOrb, orbCollection } from './orbCatalog'
import { initialGamificationState } from '../types/gamification'

beforeEach(() => localStorage.clear())

describe('Orb-Katalog und Zufallsauswahl', () => {
  it('enthält 40 eindeutige, visuell unterschiedliche Orbs und einen separaten Standard', () => {
    expect(orbCollection).toHaveLength(40)
    expect(new Set(orbCollection.map((orb) => orb.id)).size).toBe(40)
    expect(new Set(orbCollection.map((orb) => JSON.stringify(orb.visual))).size).toBe(40)
    expect(['common', 'rare', 'epic', 'legendary'].map((rarity) => orbCollection.filter((orb) => orb.rarity === rarity).length)).toEqual([20, 10, 7, 3])
    expect(orbCollection.map((orb) => orb.id)).toEqual(expect.arrayContaining(['orb-common', 'orb-rare', 'orb-epic', 'orb-legendary']))
    expect(orbCollection.some((orb) => orb.id === defaultOrb.id)).toBe(false)
    for (const orb of orbCollection) {
      expect(orb.name.length).toBeGreaterThan(0)
      expect(orb.visual.colors).toHaveLength(3)
      expect(orb.visual.animated).toBe(orb.rarity === 'legendary')
    }
  })

  it.each([[0, 'common'], [.599999, 'common'], [.6, 'rare'], [.849999, 'rare'], [.85, 'epic'], [.969999, 'epic'], [.97, 'legendary'], [.999999, 'legendary']])('wählt bei %f die Seltenheit %s', (roll, rarity) => {
    expect(rollOrb(Number(roll), .5).rarity).toBe(rarity)
  })

  it('macht jeden Orb innerhalb seiner Seltenheit erreichbar', () => {
    for (const [rarity, roll] of [['common', 0], ['rare', .6], ['epic', .85], ['legendary', .97]] as const) {
      const pool = orbCollection.filter((orb) => orb.rarity === rarity)
      expect(pool.map((_, index) => rollOrb(roll, (index + .5) / pool.length).id)).toEqual(pool.map((orb) => orb.id))
      expect(rollOrb(roll, 0)).toEqual(pool[0])
      expect(rollOrb(roll, .999999)).toEqual(pool.at(-1))
    }
    expect(rollOrb(NaN, Infinity)).toEqual(orbCollection[0])
  })
})

describe('Kistenkauf und kompatible Speicherung', () => {
  it.each([29, 30, 60])('kauft mit %i Coins ausschließlich bei ausreichendem Guthaben', (coins) => {
    const state = { ...initialGamificationState, coins }
    const result = purchaseOrbCrate(state, 'purchase-a', 0, 0)
    expect(result.status).toBe(coins < 30 ? 'insufficient-funds' : 'purchased')
    expect(result.state.coins).toBe(coins < 30 ? coins : coins - 30)
    expect(result.state.ownedOrbIds).toHaveLength(coins < 30 ? 0 : 1)
    if (coins === 60) expect(purchaseOrbCrate(result.state, 'purchase-b', .6, 0).state.coins).toBe(0)
  })

  it('verhindert erneuten Abzug derselben Kauf-ID, auch nach Reload', () => {
    const first = purchaseOrbCrate({ ...initialGamificationState, coins: 60 }, 'a', 0, 0)
    localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify(first.state))
    const loaded = loadGamificationState()
    const repeated = purchaseOrbCrate(loaded, 'a', .97, 0)
    expect(repeated.status).toBe('already-processed')
    expect(repeated.state).toEqual(first.state)
    expect(loadGamificationState()).toEqual(loaded)
  })

  it('behandelt Duplikate ohne zusätzliche Coins oder doppelte Sammlungseinträge', () => {
    const state = { ...initialGamificationState, coins: 30, ownedOrbIds: ['orb-common', 'orb-rare'] }
    const result = purchaseOrbCrate(state, 'a', 0, 0)
    expect(result.duplicate).toBe(true)
    expect(result.state.coins).toBe(0)
    expect(result.state.ownedOrbIds).toEqual(state.ownedOrbIds)
  })

  it('lädt alte Daten ohne Kaufhistorie und erhält alle historischen Besitztümer', () => {
    const old = { xp: 123, coins: 60, ownedOrbIds: ['orb-common', 'orb-rare', 'orb-epic', 'orb-legendary'], equippedOrbId: 'orb-epic', ownedCosmeticIds: ['core-effect-prism'], selectedCoreEffectId: 'core-effect-prism' }
    localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify(old))
    const migrated = loadGamificationState()
    expect(migrated).toMatchObject({ legacyXp: 123, coins: 60, ownedOrbIds: old.ownedOrbIds, equippedOrbId: 'orb-epic', ownedCosmeticIds: old.ownedCosmeticIds, completedCratePurchaseIds: [] })
    const standard = equipOrb(migrated, null)
    localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify(standard))
    expect(loadGamificationState().equippedOrbId).toBeNull()
    expect(loadGamificationState().coins).toBe(60)
    expect(loadGamificationState().ownedOrbIds).toEqual(old.ownedOrbIds)
  })

  it('weist ungültige Käufe und Zufallswerte ohne Änderungen zurück', () => {
    const state = { ...initialGamificationState, coins: 60 }
    for (const [id, roll, item] of [['', 0, 0], ['a', NaN, 0], ['a', 1, 0], ['a', 0, -1]] as const) {
      expect(purchaseOrbCrate(state, id, roll, item).state).toBe(state)
    }
  })
})
