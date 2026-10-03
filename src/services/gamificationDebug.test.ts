import { describe, expect, it } from 'vitest'
import { applyDebugAction } from './gamificationDebug'
import { isLocalDevelopment } from './developmentMode'
import { initialGamificationState } from '../types/gamification'

describe('Lokaler Entwicklungsmodus', () => {
  it.each(['localhost', '127.0.0.1', '[::1]', '::1'])('erlaubt Debug-Aktionen lokal auf %s ausschließlich in Entwicklung', (host) => {
    expect(isLocalDevelopment(true, host)).toBe(true)
    expect(isLocalDevelopment(false, host)).toBe(false)
    expect(applyDebugAction(initialGamificationState, { type: 'add-test-coins' }, false, host)).toBe(initialGamificationState)
    expect(applyDebugAction(initialGamificationState, { type: 'unlock-test-orb', orbId: 'orb-legendary' }, false, host)).toBe(initialGamificationState)
  })

  it.each(['mission.example', 'localhost.example', '192.168.1.2', ''])('sperrt Entwicklungsaktionen auf %s', (host) => {
    expect(isLocalDevelopment(true, host)).toBe(false)
    expect(applyDebugAction(initialGamificationState, { type: 'add-test-coins' }, true, host)).toBe(initialGamificationState)
  })

  it('ergänzt 300 Coins und erhält Fokuszeit, Besitz, Auswahl und Kaufhistorie exakt', () => {
    const state = { ...initialGamificationState, coins: 17, totalFocusMilliseconds: 59_500, ownedOrbIds: ['orb-rare'], equippedOrbId: 'orb-rare', ownedCosmeticIds: ['core-effect-prism'], completedCratePurchaseIds: ['purchase-a'] }
    expect(applyDebugAction(state, { type: 'add-test-coins' }, true, 'localhost')).toEqual({ ...state, coins: 317 })
    expect(state.coins).toBe(17)
    const capped = applyDebugAction({ ...state, coins: Number.MAX_SAFE_INTEGER - 10 }, { type: 'add-test-coins' }, true, 'localhost')
    expect(capped.coins).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('schaltet nur bekannte Orbs einmal frei, ohne Coins, Fokuszeit oder Ausrüstung zu verändern', () => {
    const state = { ...initialGamificationState, coins: 70, ownedOrbIds: ['orb-common'] }
    const next = applyDebugAction(state, { type: 'unlock-test-orb', orbId: 'orb-legendary' }, true, 'localhost')
    expect(next).toEqual({ ...state, ownedOrbIds: ['orb-common', 'orb-legendary'] })
    expect(applyDebugAction(next, { type: 'unlock-test-orb', orbId: 'orb-legendary' }, true, 'localhost')).toBe(next)
    expect(applyDebugAction(next, { type: 'unlock-test-orb', orbId: 'unknown' }, true, 'localhost')).toBe(next)
  })
})
