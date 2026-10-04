// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FOCUS_ENVIRONMENT_KEY, focusEnvironments, loadFocusEnvironment, normalizeFocusEnvironment, saveFocusEnvironment } from './focusEnvironment'
beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())
describe('lokale Fokus-Umgebung', () => {
  it('verwendet Still für neue oder ungültige Einstellungen', () => {
    expect(loadFocusEnvironment()).toBe('still')
    for (const value of [null, {}, 42, 'unknown', '<script>']) expect(normalizeFocusEnvironment(value)).toBe('still')
    localStorage.setItem(FOCUS_ENVIRONMENT_KEY, 'unknown')
    expect(loadFocusEnvironment()).toBe('still')
  })
  it.each(focusEnvironments)('speichert und lädt $name ohne bestehende Daten zu verändern', ({ id }) => {
    localStorage.setItem('mission.saved-mission.v1', 'preserved-mission')
    localStorage.setItem('mission.gamification.v1', 'preserved-progress')
    expect(saveFocusEnvironment(id)).toBe(true)
    expect(loadFocusEnvironment()).toBe(id)
    expect(localStorage.getItem('mission.saved-mission.v1')).toBe('preserved-mission')
    expect(localStorage.getItem('mission.gamification.v1')).toBe('preserved-progress')
  })
  it('behandelt nicht verfügbaren Speicher sicher', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('unavailable') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('unavailable') })
    expect(loadFocusEnvironment()).toBe('still')
    expect(saveFocusEnvironment('nebula')).toBe(false)
  })
})
