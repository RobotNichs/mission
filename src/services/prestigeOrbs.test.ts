// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { canEquipOrb, getEquippedOrb, isPrestigeOrbAvailable, prestigeOrbs } from './prestigeOrbs'
import { equipOrb, GAMIFICATION_STORAGE_KEY, loadGamificationState, rollOrb } from './gamification'
import { initialGamificationState } from '../types/gamification'
import { orbCollection } from './orbCatalog'
beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())
describe('exklusive Prestige-Orbs', () => {
  it.each(prestigeOrbs)('schaltet $orb.name exakt frei und erhält Auswahl nach Reload', ({ orb, stage }) => {
    const milliseconds = stage.hours * 3_600_000
    expect(isPrestigeOrbAvailable(milliseconds - 1, orb.id)).toBe(false)
    expect(isPrestigeOrbAvailable(milliseconds, orb.id)).toBe(true)
    const state = { ...initialGamificationState, totalFocusMilliseconds: milliseconds, coins: 81, ownedOrbIds: ['orb-common'] }
    expect(equipOrb({ ...state, totalFocusMilliseconds: milliseconds - 1 }, orb.id).equippedOrbId).toBeNull()
    const equipped = equipOrb(state, orb.id)
    expect(equipped).toEqual({ ...state, equippedOrbId: orb.id })
    localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify(equipped))
    for (let i = 0; i < 3; i++) expect(loadGamificationState()).toEqual(equipped)
    expect(getEquippedOrb(loadGamificationState()).id).toBe(orb.id)
    for (const previous of prestigeOrbs.filter(item => item.stage.rank <= stage.rank)) {
      expect(canEquipOrb(state, previous.orb.id)).toBe(true)
    }
    expect(equipOrb(equipped, null)).toEqual({ ...state, equippedOrbId: null })
  })
  it('ignoriert gefälschten Besitz und unterhalb der Schwelle gespeicherte Prestige-Auswahl', () => {
    const state = { ...initialGamificationState, coins: 55, ownedOrbIds: ['orb-common', 'orb-prestige-astral'], equippedOrbId: 'orb-prestige-astral' }
    expect(canEquipOrb(state, state.equippedOrbId)).toBe(false)
    localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify(state))
    expect(loadGamificationState()).toMatchObject({ coins: 55, ownedOrbIds: ['orb-common'], equippedOrbId: null })
  })
  it('hält alle fünf IDs und Designs separat vom unveränderten 40-Orb-Kistenpool', () => {
    expect(orbCollection).toHaveLength(40)
    expect(new Set(prestigeOrbs.map(item => item.orb.id)).size).toBe(5)
    expect(new Set(prestigeOrbs.map(item => item.orb.visual.prestigeStyle)).size).toBe(5)
    for (const item of prestigeOrbs) expect(orbCollection.some(orb => orb.id === item.orb.id)).toBe(false)
    for (const rarity of [0, .6, .85, .97, .999]) {
      for (let item = 0; item < 1; item += .025) expect(rollOrb(rarity, item).id).not.toContain('prestige')
    }
  })
})
