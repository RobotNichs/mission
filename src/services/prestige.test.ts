import { describe, expect, it } from 'vitest'
import { getPrestige, prestigeMilestones } from './prestige'
import { getLevel } from './gamification'
import { initialGamificationState } from '../types/gamification'
import { orbCollection } from './orbCatalog'
describe('Prestige aus kumulierter Fokuszeit', () => {
  it.each(prestigeMilestones)('prüft die Millisekundengrenze von $label exakt', stage => {
    const threshold = stage.hours * 3_600_000
    expect(getPrestige(threshold - 1).rank).toBe(stage.rank - 1)
    expect(getPrestige(threshold).rank).toBe(stage.rank)
    expect(getPrestige(threshold + 1).rank).toBe(stage.rank)
  })
  it('zeigt nächsten Meilenstein und den Fortschritt zwischen kumulativen Grenzen', () => {
    expect(getPrestige(0)).toMatchObject({ rank: 0, progress: 0, nextThresholdMilliseconds: 90_000_000, remainingMilliseconds: 90_000_000 })
    expect(getPrestige(50 * 3_600_000)).toMatchObject({ rank: 1, progress: 50, remainingMilliseconds: 25 * 3_600_000 })
    expect(getPrestige(1000 * 3_600_000)).toMatchObject({ rank: 5, progress: 100, next: null, remainingMilliseconds: 0 })
    expect(getPrestige(2000 * 3_600_000).rank).toBe(5)
  })
  it.each([NaN, Infinity, -1, null, '3600000000', {}, undefined])('behandelt ungültige Werte %s konservativ', value => {
    expect(getPrestige(value).rank).toBe(0)
    expect(getPrestige(value).totalMilliseconds).toBe(0)
  })
  it('ändert weder Fortschrittsdaten noch Level und reserviert IDs außerhalb des Kistenpools', () => {
    const state = { ...initialGamificationState, coins: 50, totalFocusMilliseconds: 200 * 3_600_000 }
    const before = JSON.stringify(state)
    const level = getLevel(state.totalFocusMilliseconds / 60000)
    for (let i = 0; i < 10; i++) expect(getPrestige(state.totalFocusMilliseconds).rank).toBe(3)
    expect(JSON.stringify(state)).toBe(before)
    expect(getLevel(state.totalFocusMilliseconds / 60000)).toBe(level)
    expect(new Set(prestigeMilestones.map(stage => stage.id)).size).toBe(5)
    expect(new Set(prestigeMilestones.map(stage => stage.rewardSlotId)).size).toBe(5)
    expect(orbCollection).toHaveLength(40)
    for (const stage of prestigeMilestones) expect(orbCollection.some(orb => orb.id === stage.rewardSlotId)).toBe(false)
  })
})
