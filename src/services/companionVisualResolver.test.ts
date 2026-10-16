// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { companionSkins, type CompanionSkinId } from '../components/companionSkins'
import { initialGamificationState } from '../types/gamification'
import { orbCollection, defaultOrb } from './orbCatalog'
import { canEquipOrb, getEquippedOrb, prestigeOrbs } from './prestigeOrbs'
import { resolveCompanionVisual, type CompanionVisualSelection } from './companionVisualResolver'

afterEach(() => vi.unstubAllGlobals())

describe('isolierte Companion-Darstellung', () => {
  it.each(Object.keys(companionSkins) as CompanionSkinId[])('löst kostenlosen Starter %s ohne Fortschrittsdaten auf', skinId => {
    const selection: CompanionVisualSelection = Object.freeze({ kind: 'companion', skinId })
    expect(resolveCompanionVisual(selection)).toEqual(selection)
  })

  it.each([undefined, null, false, 42, 'milo', [], {}, { skinId: 'nova' },
    { kind: 'legacy-orb', skinId: 'milo' }, { kind: 'companion', skinId: 'unknown' },
    { kind: 'companion', skinId: 'toString' }, { kind: 'companion', skinId: '__proto__' },
    { kind: 'companion', skinId: 1 }, { kind: 'companion', skinId: 'Milo' },
  ])('verwendet für ungültige Auswahl %j nur den technischen Fallback', selection => {
    expect(resolveCompanionVisual(selection)).toEqual({ kind: 'companion', skinId: 'luna' })
  })

  it('bleibt deterministisch, verändert keine Eingaben und teilt kein veränderbares Ergebnis', () => {
    const selection = Object.freeze({ kind: 'companion', skinId: 'milo', ignored: Object.freeze({ coins: 0 }) })
    const first = resolveCompanionVisual(selection)
    for (let i = 0; i < 5; i++) expect(resolveCompanionVisual(selection)).toEqual(first)
    expect(resolveCompanionVisual(selection)).not.toBe(first)
    expect(selection).toEqual({ kind: 'companion', skinId: 'milo', ignored: { coins: 0 } })
  })

  it('benötigt weder Browser noch Storage, Netzwerk, Zufall oder Timer, auch beim Import', async () => {
    const forbidden = new Proxy({}, { get() { throw new Error('Unexpected browser access') } })
    vi.stubGlobal('window', forbidden)
    vi.stubGlobal('document', forbidden)
    vi.stubGlobal('localStorage', forbidden)
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network access') }))
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Unexpected random access') })
    const timer = vi.spyOn(globalThis, 'setTimeout').mockImplementation(() => { throw new Error('Unexpected timer') })
    try {
      vi.resetModules()
      const module = await import('./companionVisualResolver')
      expect(module.resolveCompanionVisual({ kind: 'companion', skinId: 'nova' }).skinId).toBe('nova')
      expect(module.resolveCompanionVisual().skinId).toBe('luna')
      expect(fetch).not.toHaveBeenCalled()
    } finally { random.mockRestore(); timer.mockRestore() }
  })
})

describe('bewusst getrennte Legacy-Berechtigungen', () => {
  it('erhält alle 40 normalen IDs und verlangt weiterhin Besitz', () => {
    expect(orbCollection).toHaveLength(40)
    for (const orb of orbCollection) {
      expect(canEquipOrb(initialGamificationState, orb.id)).toBe(false)
      const state = { ...initialGamificationState, ownedOrbIds: [orb.id], equippedOrbId: orb.id }
      expect(canEquipOrb(state, orb.id)).toBe(true)
      expect(getEquippedOrb(state).id).toBe(orb.id)
    }
  })

  it.each(prestigeOrbs)('prüft $orb.name anhand echter Fokuszeit statt Fake-Besitz oder Dev-Level', ({ orb, stage }) => {
    const state = { ...initialGamificationState, ownedOrbIds: [orb.id], effectiveDisplayLevel: 100,
      totalFocusMilliseconds: stage.hours * 3_600_000 - 1, equippedOrbId: orb.id }
    expect(canEquipOrb(state, orb.id)).toBe(false)
    expect(getEquippedOrb(state)).toBe(defaultOrb)
    expect(canEquipOrb({ ...state, totalFocusMilliseconds: stage.hours * 3_600_000 }, orb.id)).toBe(true)
  })

  it('unterscheidet gespeicherten Standard null von der Render-ID', () => {
    expect(canEquipOrb(initialGamificationState, null)).toBe(true)
    expect(getEquippedOrb(initialGamificationState)).toBe(defaultOrb)
    expect(canEquipOrb(initialGamificationState, defaultOrb.id)).toBe(false)
  })

  it.each([0, 30, 999])('lässt bei %i Coins Fortschritt, Auswahl, Journale und Historie unberührt', coins => {
    const data = { game: { ...initialGamificationState, coins, totalFocusMilliseconds: 123456,
      ownedOrbIds: ['orb-common'], equippedOrbId: 'orb-common', completedCratePurchaseIds: ['purchase-1'],
      claimedMissionIds: ['mission-1'], claimedStepRewardKeys: ['mission-1::step-1'] },
    history: [{ missionId: 'mission-1', focusMilliseconds: 123456 }] }
    const before = structuredClone(data)
    Object.freeze(data.game.ownedOrbIds)
    Object.freeze(data.game.completedCratePurchaseIds)
    Object.freeze(data.game)
    for (const skinId of Object.keys(companionSkins)) {
      expect(resolveCompanionVisual({ kind: 'companion', skinId }).skinId).toBe(skinId)
    }
    resolveCompanionVisual(data.game)
    expect(getEquippedOrb(data.game).id).toBe('orb-common')
    expect(data).toEqual(before)
  })
})
