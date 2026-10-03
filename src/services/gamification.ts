import {
  initialGamificationState,
  type CosmeticItem,
  type GamificationState,
  type OrbDefinition,
  type OrbRarity,
} from '../types/gamification'

import { orbCollection } from './orbCatalog'
export { orbCollection } from './orbCatalog'

export const GAMIFICATION_STORAGE_KEY = 'mission.gamification.v1'
export const DEFAULT_BACKGROUND_ID = 'deep-space'
export const DEFAULT_CORE_EFFECT_ID = 'core-soft'

export const rarityProbabilities: Record<OrbRarity, number> = {
  common: 0.6,
  rare: 0.25,
  epic: 0.12,
  legendary: 0.03,
}

export const cosmeticShopItems: CosmeticItem[] = [
  { id: 'background-violet-dusk', name: 'Violetter Abend', kind: 'background', cost: 45, description: 'Ein dunkler Verlauf mit sanftem Violett.' },
  { id: 'background-cyan-depth', name: 'Cyan-Tiefe', kind: 'background', cost: 60, description: 'Kühle Cyan-Akzente auf tiefem Blau.' },
  { id: 'core-effect-eclipse', name: 'Eklipsen-Ring', kind: 'core-effect', cost: 35, description: 'Ein feiner zusätzlicher Ring am Mission Core.' },
  { id: 'core-effect-prism', name: 'Prisma', kind: 'core-effect', cost: 55, description: 'Ein zurückhaltender violett-cyanfarbener Core-Schimmer.' },
]

export type CosmeticPurchaseResult = {
  state: GamificationState
  status: 'purchased' | 'already-owned' | 'insufficient-funds' | 'unknown-item'
}

export function getLevel(focusMinutes: number): number {
  const minutes = Number.isFinite(focusMinutes) ? Math.max(0, focusMinutes) : 0
  return Math.floor(Math.sqrt(minutes / 30)) + 1
}

export function getLevelStartMinutes(level: number): number {
  return 30 * (level - 1) ** 2
}

export function addFocusTime(state: GamificationState, elapsedMilliseconds: number): GamificationState {
  if (!Number.isFinite(elapsedMilliseconds) || elapsedMilliseconds <= 0) return state
  const total = Math.min(Number.MAX_SAFE_INTEGER, state.totalFocusMilliseconds + Math.floor(elapsedMilliseconds))
  const coinsAdded = Math.floor(total / 60_000) - Math.floor(state.totalFocusMilliseconds / 60_000)
  return { ...state, totalFocusMilliseconds: total, coins: Math.min(Number.MAX_SAFE_INTEGER, state.coins + coinsAdded) }
}

export function getCoreSize(level: number): number {
  return 76 + Math.min(Math.max(level - 1, 0), 8) * 5
}

// Stable history is retained for plan reconciliation, without awarding currency.
export function recordStepCompletion(state: GamificationState, missionId: string, stepId: string, stableSlot: string): GamificationState {
  return { ...state, claimedStepRewardKeys: [...new Set([
    ...state.claimedStepRewardKeys, missionId + '::' + stepId, missionId + '::slot:' + stableSlot,
  ])] }
}

export function recordMissionCompletion(state: GamificationState, missionId: string): GamificationState {
  if (state.claimedMissionIds.includes(missionId)) return state
  return { ...state, claimedMissionIds: [...state.claimedMissionIds, missionId] }
}

export function rollOrb(randomRoll: number, itemRoll = 0): OrbDefinition {
  const normalizeRoll = (value: number) => Number.isFinite(value) ? Math.min(Math.max(value, 0), 0.999999999999) : 0
  const roll = normalizeRoll(randomRoll)
  const rarity: OrbRarity = roll < rarityProbabilities.common
    ? 'common'
    : roll < rarityProbabilities.common + rarityProbabilities.rare
      ? 'rare'
      : roll < rarityProbabilities.common + rarityProbabilities.rare + rarityProbabilities.epic
        ? 'epic'
        : 'legendary'
  const pool = orbCollection.filter((orb) => orb.rarity === rarity)
  return pool[Math.floor(normalizeRoll(itemRoll) * pool.length)]
}

export function equipOrb(state: GamificationState, orbId: string | null): GamificationState {
  if (orbId !== null && (!state.ownedOrbIds.includes(orbId) || !orbCollection.some((orb) => orb.id === orbId))) {
    return state
  }
  return { ...state, equippedOrbId: orbId }
}

export const ORB_CRATE_COST = 30
export type CratePurchaseResult = {
  state: GamificationState
  status: 'purchased' | 'already-processed' | 'insufficient-funds' | 'invalid-purchase' | 'unavailable'
  orb: OrbDefinition | null
  duplicate: boolean
}

export function purchaseOrbCrate(
  state: GamificationState, purchaseId: string, rarityRoll: number, itemRoll: number,
): CratePurchaseResult {
  const rejected = (status: CratePurchaseResult['status']): CratePurchaseResult => ({ state, status, orb: null, duplicate: false })
  if (!purchaseId.trim() || purchaseId.length > 200) return rejected('invalid-purchase')
  if (state.completedCratePurchaseIds.includes(purchaseId)) return rejected('already-processed')
  if (!Number.isFinite(state.coins) || state.coins < ORB_CRATE_COST) return rejected('insufficient-funds')
  if (![rarityRoll, itemRoll].every((roll) => Number.isFinite(roll) && roll >= 0 && roll < 1)) return rejected('invalid-purchase')
  const orb = rollOrb(rarityRoll, itemRoll)
  const duplicate = state.ownedOrbIds.includes(orb.id)
  return {
    state: {
      ...state,
      coins: state.coins - ORB_CRATE_COST,
      ownedOrbIds: duplicate ? state.ownedOrbIds : [...state.ownedOrbIds, orb.id],
      completedCratePurchaseIds: [...state.completedCratePurchaseIds, purchaseId],
    },
    status: 'purchased', orb, duplicate,
  }
}

export function purchaseCosmetic(state: GamificationState, itemId: string): CosmeticPurchaseResult {
  const item = cosmeticShopItems.find((candidate) => candidate.id === itemId)
  if (!item) return { state, status: 'unknown-item' }
  if (state.ownedCosmeticIds.includes(item.id)) return { state, status: 'already-owned' }
  if (state.coins < item.cost) return { state, status: 'insufficient-funds' }

  return {
    state: {
      ...state,
      coins: state.coins - item.cost,
      ownedCosmeticIds: [...state.ownedCosmeticIds, item.id],
    },
    status: 'purchased',
  }
}

export function equipCosmetic(state: GamificationState, itemId: string): GamificationState {
  if (itemId === DEFAULT_BACKGROUND_ID) return { ...state, selectedBackgroundId: DEFAULT_BACKGROUND_ID }
  if (itemId === DEFAULT_CORE_EFFECT_ID) return { ...state, selectedCoreEffectId: DEFAULT_CORE_EFFECT_ID }

  const item = cosmeticShopItems.find((candidate) => candidate.id === itemId)
  if (!item || !state.ownedCosmeticIds.includes(item.id)) return state
  return item.kind === 'background'
    ? { ...state, selectedBackgroundId: item.id }
    : { ...state, selectedCoreEffectId: item.id }
}

export function loadGamificationState(strictStorage = false): GamificationState {
  try {
    const saved = localStorage.getItem(GAMIFICATION_STORAGE_KEY)
    if (!saved) return initialGamificationState
    const parsed: unknown = JSON.parse(saved)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return initialGamificationState
    const value = parsed as Partial<GamificationState> & { xp?: unknown }
    const nonnegative = (input: unknown): number => typeof input === 'number'
      && Number.isFinite(input) && input >= 0 && input <= Number.MAX_SAFE_INTEGER ? input : 0
    const strings = (input: unknown): string[] => Array.isArray(input)
      ? [...new Set(input.filter((item): item is string => typeof item === 'string'))] : []

    const validOrbIds = new Set(orbCollection.map((orb) => orb.id))
    const ownedOrbIds = strings(value.ownedOrbIds).filter((id) => validOrbIds.has(id))
    const validCosmeticIds = new Set(cosmeticShopItems.map((item) => item.id))
    const ownedCosmeticIds = Array.isArray(value.ownedCosmeticIds)
      ? [...new Set(value.ownedCosmeticIds.filter((id): id is string => typeof id === 'string' && validCosmeticIds.has(id)))]
      : []
    const selectedBackgroundId = value.selectedBackgroundId === DEFAULT_BACKGROUND_ID
      || (typeof value.selectedBackgroundId === 'string'
        && ownedCosmeticIds.includes(value.selectedBackgroundId)
        && cosmeticShopItems.find((item) => item.id === value.selectedBackgroundId)?.kind === 'background')
      ? value.selectedBackgroundId
      : DEFAULT_BACKGROUND_ID
    const selectedCoreEffectId = value.selectedCoreEffectId === DEFAULT_CORE_EFFECT_ID
      || (typeof value.selectedCoreEffectId === 'string'
        && ownedCosmeticIds.includes(value.selectedCoreEffectId)
        && cosmeticShopItems.find((item) => item.id === value.selectedCoreEffectId)?.kind === 'core-effect')
      ? value.selectedCoreEffectId
      : DEFAULT_CORE_EFFECT_ID
    return {
      version: 2,
      legacyXp: nonnegative(value.legacyXp ?? value.xp),
      totalFocusMilliseconds: Math.floor(nonnegative(value.totalFocusMilliseconds)),
      coins: nonnegative(value.coins),
      ownedOrbIds,
      completedCratePurchaseIds: strings(value.completedCratePurchaseIds),
      claimedStepRewardKeys: strings(value.claimedStepRewardKeys),
      claimedMissionIds: strings(value.claimedMissionIds),
      equippedOrbId: typeof value.equippedOrbId === 'string' && ownedOrbIds.includes(value.equippedOrbId)
        ? value.equippedOrbId
        : null,
      ownedCosmeticIds,
      selectedBackgroundId,
      selectedCoreEffectId,
    }
  } catch (error) {
    // A writer must not overwrite inaccessible data with an empty default state.
    if (strictStorage) throw error
    return initialGamificationState
  }
}
