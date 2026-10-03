// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  recordMissionCompletion,
  addFocusTime,
  recordStepCompletion,
  cosmeticShopItems,
  DEFAULT_BACKGROUND_ID,
  DEFAULT_CORE_EFFECT_ID,
  equipCosmetic,
  equipOrb,
  GAMIFICATION_STORAGE_KEY,
  getCoreSize,
  getLevel,
  loadGamificationState,
  purchaseCosmetic,
  rarityProbabilities,
  rollOrb,
} from './gamification'
import { initialGamificationState } from '../types/gamification'

beforeEach(() => localStorage.clear())

describe('Fokuszeit, Missionsfortschritt und Sammlung', () => {
  it('merkt erledigte Schritte ohne Währung und ohne doppelte Einträge', () => {
    const first = recordStepCompletion(initialGamificationState, 'mission-a', 'step-a', 'learning:1')
    const repeated = recordStepCompletion(first, 'mission-a', 'step-a', 'learning:1')
    expect(repeated).toEqual(first)
    expect(first.coins).toBe(0)
    expect(first.totalFocusMilliseconds).toBe(0)
  })

  it('erhält stabile Slots bei neu generierten Schritt-IDs ohne Belohnung', () => {
    const first = recordStepCompletion(initialGamificationState, 'a', 'step-1', 'learning:1')
    const next = recordStepCompletion(first, 'a', 'step-2', 'learning:1')
    expect(next.claimedStepRewardKeys.filter((key) => key.includes('slot:'))).toEqual(['a::slot:learning:1'])
    expect(next.coins).toBe(0)
  })

  it('merkt einen Missionsabschluss einmalig ohne Coins oder Orb-Drop', () => {
    const first = recordMissionCompletion(initialGamificationState, 'a')
    expect(recordMissionCompletion(first, 'a')).toBe(first)
    expect(first.coins).toBe(0)
    expect(first.ownedOrbIds).toEqual([])
  })

  it('erhält vorhandene Orbs und Coins auch über weitere Abschlüsse', () => {
    const old = { ...initialGamificationState, coins: 20, ownedOrbIds: ['orb-common'] }
    const next = recordMissionCompletion(recordMissionCompletion(old, 'a'), 'b')
    expect(next.coins).toBe(20)
    expect(next.ownedOrbIds).toEqual(['orb-common'])
  })

  it('weist transparente Seltenheitswahrscheinlichkeiten von insgesamt 100 Prozent aus', () => {
    expect(rarityProbabilities).toEqual({ common: 0.6, rare: 0.25, epic: 0.12, legendary: 0.03 })
    expect(Object.values(rarityProbabilities).reduce((sum, probability) => sum + probability, 0)).toBe(1)
    expect([
      rollOrb(0).rarity,
      rollOrb(0.6).rarity,
      rollOrb(0.85).rarity,
      rollOrb(0.97).rarity,
    ]).toEqual(['common', 'rare', 'epic', 'legendary'])
  })

  it('berechnet Level und Core-Größe anhand gesammelter Fokusminuten', () => {
    expect(getLevel(0)).toBe(1)
    expect(getLevel(30)).toBe(2)
    expect(getCoreSize(2)).toBeGreaterThan(getCoreSize(1))
  })

  it('archiviert XP und lädt Coins, Sammlung und Sperrlisten dauerhaft aus localStorage', () => {
    const savedState = {
      xp: 145,
      coins: 20,
      ownedOrbIds: ['orb-common', 'unbekannt', 'orb-common'],
      claimedStepRewardKeys: ['mission-a::step-a'],
      claimedMissionIds: ['mission-a'],
    }
    localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify(savedState))

    expect(loadGamificationState()).toEqual({
      ...initialGamificationState,
      coins: 20,
      legacyXp: 145,
      claimedStepRewardKeys: savedState.claimedStepRewardKeys,
      claimedMissionIds: savedState.claimedMissionIds,
      ownedOrbIds: ['orb-common'],
      equippedOrbId: null,
      ownedCosmeticIds: [],
      selectedBackgroundId: DEFAULT_BACKGROUND_ID,
      selectedCoreEffectId: DEFAULT_CORE_EFFECT_ID,
    })
  })

  it('rüstet nur eigene Orbs aus und erhält die Auswahl im gespeicherten Gamification-Zustand', () => {
    const earned = { ...initialGamificationState, ownedOrbIds: ['orb-common'] }
    const equipped = equipOrb(earned, 'orb-common')
    const rejected = equipOrb(equipped, 'orb-legendary')

    expect(equipped.equippedOrbId).toBe('orb-common')
    expect(rejected).toBe(equipped)
    localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify(equipped))
    expect(loadGamificationState().equippedOrbId).toBe('orb-common')
  })

  it('bestätigt Kosmetikkäufe, zieht Coins exakt einmal ab und kann niemals ins Minus gehen', () => {
    const item = cosmeticShopItems.find((candidate) => candidate.kind === 'background')!
    const poorState = { ...initialGamificationState, coins: item.cost - 1 }
    const denied = purchaseCosmetic(poorState, item.id)
    expect(denied.status).toBe('insufficient-funds')
    expect(denied.state.coins).toBe(item.cost - 1)

    const fundedState = { ...initialGamificationState, coins: item.cost }
    const purchased = purchaseCosmetic(fundedState, item.id)
    const duplicatePurchase = purchaseCosmetic(purchased.state, item.id)
    expect(purchased.status).toBe('purchased')
    expect(purchased.state.coins).toBe(0)
    expect(duplicatePurchase.status).toBe('already-owned')
    expect(duplicatePurchase.state.coins).toBe(0)
    expect(duplicatePurchase.state.coins).toBeGreaterThanOrEqual(0)
  })

  it('rüstet gekaufte Kosmetik aus und migriert sie beim Reload weiter', () => {
    const item = cosmeticShopItems.find((candidate) => candidate.kind === 'core-effect')!
    const purchased = purchaseCosmetic({ ...initialGamificationState, coins: 100 }, item.id).state
    const equipped = equipCosmetic(purchased, item.id)
    localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify(equipped))

    expect(equipped.selectedCoreEffectId).toBe(item.id)
    expect(loadGamificationState()).toEqual(equipped)
  })
})

describe('Fokusgrenzen und Migration', () => {
  it.each([[29, 1], [30, 2], [119, 2], [120, 3], [270, 4]])('nach %i Minuten: Level %i und genau ein Coin je Minute', (minutes, level) => {
    const state = addFocusTime(initialGamificationState, minutes * 60_000)
    expect(state.coins).toBe(minutes)
    expect(getLevel(state.totalFocusMilliseconds / 60_000)).toBe(level)
  })

  it('bewahrt Teilminuten über Sitzungen und Käufe', () => {
    const first = addFocusTime({ ...initialGamificationState, coins: 45 }, 59_999)
    expect(first.coins).toBe(45)
    const spent = purchaseCosmetic(first, 'background-violet-dusk').state
    const next = addFocusTime(spent, 1)
    expect(next.coins).toBe(1)
    expect(next.totalFocusMilliseconds).toBe(60_000)
    expect(addFocusTime(next, 60_000).coins).toBe(2)
  })

  it('vergibt beim wiederholten Laden keine Coins und archiviert XP nur einmal', () => {
    localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify({ xp: 500, coins: 75, ownedOrbIds: ['orb-rare'], equippedOrbId: 'orb-rare', ownedCosmeticIds: ['core-effect-prism'], selectedCoreEffectId: 'core-effect-prism' }))
    const migrated = loadGamificationState()
    expect(migrated.legacyXp).toBe(500)
    expect(migrated.totalFocusMilliseconds).toBe(0)
    expect(migrated.coins).toBe(75)
    expect(migrated.equippedOrbId).toBe('orb-rare')
    expect(migrated.selectedCoreEffectId).toBe('core-effect-prism')
    expect(migrated).not.toHaveProperty('xp')
    localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify(migrated))
    expect(loadGamificationState()).toEqual(migrated)
    expect(loadGamificationState()).toEqual(migrated)
  })

  it('verwirft bei beschädigter Fokuszeit keinen gültigen Besitz', () => {
    localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify({ ...initialGamificationState, totalFocusMilliseconds: -5, coins: 12, ownedOrbIds: ['orb-epic'] }))
    expect(loadGamificationState()).toMatchObject({ totalFocusMilliseconds: 0, coins: 12, ownedOrbIds: ['orb-epic'] })
    for (const invalid of [-1, NaN, Infinity, 0]) expect(addFocusTime(initialGamificationState, invalid)).toBe(initialGamificationState)
  })
})
