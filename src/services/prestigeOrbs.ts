import type { GamificationState, OrbDefinition } from '../types/gamification'
import { defaultOrb, orbCollection } from './orbCatalog'
import { getPrestige, prestigeMilestones } from './prestige'

function makeOrb(id: string, name: string, colors: [string, string, string], style: NonNullable<OrbDefinition['visual']['prestigeStyle']>): OrbDefinition {
  return { id, name, rarity: 'legendary', description: 'Exklusiver Prestige-Orb aus kumulierter Fokuszeit.',
    visual: { colors, material: style === 'singularity' ? 'pearl' : 'glass', pattern: 'none', ring: false,
      animated: style !== 'astral', prestigeStyle: style } }
}
// Separate catalog: these definitions never join orbCollection or the crate pool.
export const prestigeOrbs = [
  { stage: prestigeMilestones[0], orb: makeOrb('orb-prestige-astral', 'Astral', ['#e4f2ff', '#779ab9', '#172c45'], 'astral') },
  { stage: prestigeMilestones[1], orb: makeOrb('orb-prestige-orbit', 'Orbit', ['#8bd7d5', '#326f79', '#392254'], 'orbit') },
  { stage: prestigeMilestones[2], orb: makeOrb('orb-prestige-pulsar', 'Pulsar', ['#b8a0e3', '#553684', '#180d30'], 'pulsar') },
  { stage: prestigeMilestones[3], orb: makeOrb('orb-prestige-zenith', 'Zenith', ['#ecd798', '#554c37', '#080f1b'], 'zenith') },
  { stage: prestigeMilestones[4], orb: makeOrb('orb-prestige-singularity-prime', 'Singularity Prime', ['#f7fbff', '#b3c4ef', '#37274e'], 'singularity') },
] as const
type OrbEligibility = Pick<GamificationState, 'totalFocusMilliseconds' | 'ownedOrbIds'>
export function isPrestigeOrbAvailable(focusMilliseconds: number, orbId: string): boolean {
  const definition = prestigeOrbs.find(item => item.orb.id === orbId)
  return !!definition && getPrestige(focusMilliseconds).rank >= definition.stage.rank
}
export function canEquipOrb(state: OrbEligibility, orbId: string | null): boolean {
  return orbId === null || isPrestigeOrbAvailable(state.totalFocusMilliseconds, orbId)
    || (state.ownedOrbIds.includes(orbId) && orbCollection.some(orb => orb.id === orbId))
}
export function getEquippedOrb(state: OrbEligibility & Pick<GamificationState, 'equippedOrbId'>): OrbDefinition {
  if (!canEquipOrb(state, state.equippedOrbId)) return defaultOrb
  return prestigeOrbs.find(item => item.orb.id === state.equippedOrbId)?.orb
    ?? orbCollection.find(orb => orb.id === state.equippedOrbId) ?? defaultOrb
}
