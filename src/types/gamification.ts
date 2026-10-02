export type OrbRarity = 'common' | 'rare' | 'epic' | 'legendary'

export type OrbDefinition = {
  id: string
  name: string
  rarity: OrbRarity
  description: string
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
  xp: number
  coins: number
  ownedOrbIds: string[]
  claimedStepRewardKeys: string[]
  claimedMissionIds: string[]
  equippedOrbId: string | null
  ownedCosmeticIds: string[]
  selectedBackgroundId: string
  selectedCoreEffectId: string
}

export const initialGamificationState: GamificationState = {
  xp: 0,
  coins: 0,
  ownedOrbIds: [],
  claimedStepRewardKeys: [],
  claimedMissionIds: [],
  equippedOrbId: null,
  ownedCosmeticIds: [],
  selectedBackgroundId: 'deep-space',
  selectedCoreEffectId: 'core-soft',
}
