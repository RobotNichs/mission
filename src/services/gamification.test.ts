// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  awardMissionCompletion,
  awardStepCompletion,
  COINS_PER_MISSION,
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
  XP_PER_MISSION,
  XP_PER_STEP,
} from './gamification'
import { initialGamificationState } from '../types/gamification'

beforeEach(() => localStorage.clear())

describe('XP, Mission-Belohnungen und Sammlung', () => {
  it('vergibt XP für einen Schritt nur einmal, auch wenn er erneut abgehakt wird', () => {
    const firstAward = awardStepCompletion(initialGamificationState, 'mission-a', 'step-a')
    const repeatedAward = awardStepCompletion(firstAward.state, 'mission-a', 'step-a')

    expect(firstAward.xpAdded).toBe(XP_PER_STEP)
    expect(repeatedAward.xpAdded).toBe(0)
    expect(repeatedAward.state.xp).toBe(XP_PER_STEP)
  })

  it('sperrt erneut generierte Schritt-IDs über einen stabilen Missions-Slot', () => {
    const firstPlan = awardStepCompletion(initialGamificationState, 'mission-a', 'server-step-1', 'learning:1')
    const regeneratedPlan = awardStepCompletion(firstPlan.state, 'mission-a', 'different-server-step-id', 'learning:1')

    expect(firstPlan.xpAdded).toBe(XP_PER_STEP)
    expect(regeneratedPlan.xpAdded).toBe(0)
    expect(regeneratedPlan.state.xp).toBe(XP_PER_STEP)
  })

  it('vergibt Mission-XP und Coins nur einmal und rollt genau ein Orb-Design', () => {
    const firstAward = awardMissionCompletion(initialGamificationState, 'mission-a', 0.99)
    const repeatedAward = awardMissionCompletion(firstAward.state, 'mission-a', 0)

    expect(firstAward.awarded).toBe(true)
    expect(firstAward.xpAdded).toBe(XP_PER_MISSION)
    expect(firstAward.coinsAdded).toBe(COINS_PER_MISSION)
    expect(firstAward.orb?.rarity).toBe('legendary')
    expect(firstAward.state.ownedOrbIds).toEqual(['orb-legendary'])
    expect(repeatedAward.awarded).toBe(false)
    expect(repeatedAward.state.xp).toBe(XP_PER_MISSION)
    expect(repeatedAward.state.coins).toBe(COINS_PER_MISSION)
  })

  it('gibt bei einem bereits gesammelten Orb keine zusätzliche Orb- oder XP-Erstattung', () => {
    const firstMission = awardMissionCompletion(initialGamificationState, 'mission-a', 0)
    const secondMission = awardMissionCompletion(firstMission.state, 'mission-b', 0)

    expect(secondMission.awarded).toBe(true)
    expect(secondMission.orbWasAlreadyOwned).toBe(true)
    expect(secondMission.state.ownedOrbIds).toEqual(['orb-common'])
    expect(secondMission.xpAdded).toBe(XP_PER_MISSION)
    expect(secondMission.coinsAdded).toBe(COINS_PER_MISSION)
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

  it('berechnet Level und Core-Größe anhand gesammelter XP', () => {
    expect(getLevel(0)).toBe(1)
    expect(getLevel(100)).toBe(2)
    expect(getCoreSize(2)).toBeGreaterThan(getCoreSize(1))
  })

  it('lädt XP, Coins, Sammlung und Sperrlisten dauerhaft aus localStorage', () => {
    const savedState = {
      xp: 145,
      coins: 20,
      ownedOrbIds: ['orb-common', 'unbekannt', 'orb-common'],
      claimedStepRewardKeys: ['mission-a::step-a'],
      claimedMissionIds: ['mission-a'],
    }
    localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify(savedState))

    expect(loadGamificationState()).toEqual({
      ...savedState,
      ownedOrbIds: ['orb-common'],
      equippedOrbId: null,
      ownedCosmeticIds: [],
      selectedBackgroundId: DEFAULT_BACKGROUND_ID,
      selectedCoreEffectId: DEFAULT_CORE_EFFECT_ID,
    })
  })

  it('rüstet nur eigene Orbs aus und erhält die Auswahl im gespeicherten Gamification-Zustand', () => {
    const earned = awardMissionCompletion(initialGamificationState, 'mission-a', 0).state
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
