export type OrbRarity = 'common' | 'rare' | 'epic' | 'legendary'

export type OrbDefinition = {
  id: string
  name: string
  rarity: OrbRarity
  description: string
  visual: {
    prestigeStyle?: 'astral' | 'orbit' | 'pulsar' | 'zenith' | 'singularity'
    colors: [string, string, string]
    material: 'glass' | 'pearl' | 'metal' | 'crystal' | 'nebula'
    pattern: 'none' | 'bands' | 'facets' | 'stars' | 'vortex' | 'halo' | 'petals'
    ring: boolean
    animated: boolean
  }
}

export type CosmeticKind = 'background' | 'core-effect'

export type CosmeticItem = {
  id: string
  name: string
  kind: CosmeticKind
  cost: number
  description: string
}

export type GamificationState = {
  version: 2
  legacyXp: number
  totalFocusMilliseconds: number
  coins: number
  ownedOrbIds: string[]
  completedCratePurchaseIds: string[]
  claimedStepRewardKeys: string[]
  claimedMissionIds: string[]
  equippedOrbId: string | null
  ownedCosmeticIds: string[]
  selectedBackgroundId: string
  selectedCoreEffectId: string
}

export const initialGamificationState: GamificationState = {
  version: 2,
  legacyXp: 0,
  totalFocusMilliseconds: 0,
  coins: 0,
  ownedOrbIds: [],
  completedCratePurchaseIds: [],
  claimedStepRewardKeys: [],
  claimedMissionIds: [],
  equippedOrbId: null,
  ownedCosmeticIds: [],
  selectedBackgroundId: 'deep-space',
  selectedCoreEffectId: 'core-soft',
}
