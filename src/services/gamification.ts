import {
  initialGamificationState,
  type CosmeticItem,
  type GamificationState,
  type OrbDefinition,
  type OrbRarity,
} from '../types/gamification'

export const GAMIFICATION_STORAGE_KEY = 'mission.gamification.v1'
export const XP_PER_STEP = 10
export const XP_PER_MISSION = 50
export const COINS_PER_MISSION = 20
export const XP_PER_LEVEL = 100
export const DEFAULT_BACKGROUND_ID = 'deep-space'
export const DEFAULT_CORE_EFFECT_ID = 'core-soft'

export const rarityProbabilities: Record<OrbRarity, number> = {
  common: 0.6,
  rare: 0.25,
  epic: 0.12,
  legendary: 0.03,
}

export const orbCollection: OrbDefinition[] = [
  { id: 'orb-common', name: 'Morgenlicht', rarity: 'common', description: 'Ein ruhiger, heller Kern.' },
  { id: 'orb-rare', name: 'Nordlicht', rarity: 'rare', description: 'Ein kühler, schimmernder Kern.' },
  { id: 'orb-epic', name: 'Nebelrose', rarity: 'epic', description: 'Ein lebendiger, violetter Kern.' },
  { id: 'orb-legendary', name: 'Sternenstaub', rarity: 'legendary', description: 'Ein seltener, goldener Kern.' },
]

export const cosmeticShopItems: CosmeticItem[] = [
  { id: 'background-violet-dusk', name: 'Violetter Abend', kind: 'background', cost: 45, description: 'Ein dunkler Verlauf mit sanftem Violett.' },
  { id: 'background-cyan-depth', name: 'Cyan-Tiefe', kind: 'background', cost: 60, description: 'Kühle Cyan-Akzente auf tiefem Blau.' },
  { id: 'core-effect-eclipse', name: 'Eklipsen-Ring', kind: 'core-effect', cost: 35, description: 'Ein feiner zusätzlicher Ring am Mission Core.' },
  { id: 'core-effect-prism', name: 'Prisma', kind: 'core-effect', cost: 55, description: 'Ein zurückhaltender violett-cyanfarbener Core-Schimmer.' },
]

export type StepRewardResult = { state: GamificationState; xpAdded: number }
export type MissionRewardResult = {
  state: GamificationState
  awarded: boolean
  xpAdded: number
  coinsAdded: number
  orb: OrbDefinition | null
  orbWasAlreadyOwned: boolean
}
export type CosmeticPurchaseResult = {
  state: GamificationState
  status: 'purchased' | 'already-owned' | 'insufficient-funds' | 'unknown-item'
}

export function getLevel(xp: number): number {
  return Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1
}

export function getXpWithinLevel(xp: number): number {
  return Math.max(0, xp) % XP_PER_LEVEL
}

export function getXpToNextLevel(xp: number): number {
  return XP_PER_LEVEL - getXpWithinLevel(xp)
}

export function getCoreSize(level: number): number {
  return 76 + Math.min(Math.max(level - 1, 0), 8) * 5
}

export function awardStepCompletion(
  state: GamificationState,
  missionId: string,
  stepId: string,
): StepRewardResult {
  const rewardKey = `${missionId}::${stepId}`
  if (state.claimedStepRewardKeys.includes(rewardKey)) return { state, xpAdded: 0 }

  return {
    state: {
      ...state,
      xp: state.xp + XP_PER_STEP,
      claimedStepRewardKeys: [...state.claimedStepRewardKeys, rewardKey],
    },
    xpAdded: XP_PER_STEP,
  }
}

export function awardMissionCompletion(
  state: GamificationState,
  missionId: string,
  randomRoll: number,
): MissionRewardResult {
  if (state.claimedMissionIds.includes(missionId)) {
    return {
      state,
      awarded: false,
      xpAdded: 0,
      coinsAdded: 0,
      orb: null,
      orbWasAlreadyOwned: false,
    }
  }

  const orb = rollOrb(randomRoll)
  const orbWasAlreadyOwned = state.ownedOrbIds.includes(orb.id)
  return {
    state: {
      ...state,
      xp: state.xp + XP_PER_MISSION,
      coins: state.coins + COINS_PER_MISSION,
      ownedOrbIds: orbWasAlreadyOwned ? state.ownedOrbIds : [...state.ownedOrbIds, orb.id],
      claimedMissionIds: [...state.claimedMissionIds, missionId],
    },
    awarded: true,
    xpAdded: XP_PER_MISSION,
    coinsAdded: COINS_PER_MISSION,
    orb,
    orbWasAlreadyOwned,
  }
}

export function rollOrb(randomRoll: number): OrbDefinition {
  const roll = Math.min(Math.max(randomRoll, 0), 0.999999999999)
  const rarity: OrbRarity = roll < rarityProbabilities.common
    ? 'common'
    : roll < rarityProbabilities.common + rarityProbabilities.rare
      ? 'rare'
      : roll < rarityProbabilities.common + rarityProbabilities.rare + rarityProbabilities.epic
        ? 'epic'
        : 'legendary'
  return orbCollection.find((orb) => orb.rarity === rarity)!
}

export function equipOrb(state: GamificationState, orbId: string | null): GamificationState {
  if (orbId !== null && (!state.ownedOrbIds.includes(orbId) || !orbCollection.some((orb) => orb.id === orbId))) {
    return state
  }
  return { ...state, equippedOrbId: orbId }
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

export function loadGamificationState(): GamificationState {
  try {
    const saved = localStorage.getItem(GAMIFICATION_STORAGE_KEY)
    if (!saved) return initialGamificationState
    const parsed: unknown = JSON.parse(saved)
    if (typeof parsed !== 'object' || parsed === null) return initialGamificationState
    const value = parsed as Partial<GamificationState>
    if (
      typeof value.xp !== 'number'
      || !Number.isFinite(value.xp)
      || value.xp < 0
      || typeof value.coins !== 'number'
      || !Number.isFinite(value.coins)
      || value.coins < 0
      || !Array.isArray(value.ownedOrbIds)
      || !Array.isArray(value.claimedStepRewardKeys)
      || !Array.isArray(value.claimedMissionIds)
    ) {
      return initialGamificationState
    }

    const validOrbIds = new Set(orbCollection.map((orb) => orb.id))
    const ownedOrbIds = [...new Set(value.ownedOrbIds.filter((id): id is string => typeof id === 'string' && validOrbIds.has(id)))]
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
      xp: value.xp,
      coins: value.coins,
      ownedOrbIds,
      claimedStepRewardKeys: [...new Set(value.claimedStepRewardKeys.filter((key): key is string => typeof key === 'string'))],
      claimedMissionIds: [...new Set(value.claimedMissionIds.filter((id): id is string => typeof id === 'string'))],
      equippedOrbId: typeof value.equippedOrbId === 'string' && ownedOrbIds.includes(value.equippedOrbId)
        ? value.equippedOrbId
        : null,
      ownedCosmeticIds,
      selectedBackgroundId,
      selectedCoreEffectId,
    }
  } catch {
    return initialGamificationState
  }
}
