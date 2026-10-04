// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'
import GamificationDebug from './components/GamificationDebug'
import PrestigePanel from './components/PrestigePanel'
import { GAMIFICATION_STORAGE_KEY } from './services/gamification'
import { initialGamificationState } from './types/gamification'
import { createTestLocks } from './services/testLocks'
beforeEach(() => {
  localStorage.clear()
  Object.defineProperty(navigator, 'locks', { configurable: true, value: createTestLocks() })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllEnvs() })
it('zeigt bestehende Fokuszeit nach Reload und in parallelen Tabs ohne zusätzliche Belohnungen', () => {
  const state = { ...initialGamificationState, totalFocusMilliseconds: 75 * 3_600_000, coins: 37, ownedOrbIds: ['orb-rare'], equippedOrbId: 'orb-rare' }
  localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify(state))
  const first = render(<App />)
  const ui = within(first.container)
  expect(ui.getByText('Prestige II', { selector: 'summary' })).toBeTruthy()
  const panel = first.container.querySelector('.prestige-panel')!
  expect(panel.hasAttribute('open')).toBe(false)
  fireEvent.click(within(panel as HTMLElement).getByText(/Langfristiger Fortschritt/))
  expect(localStorage.getItem(GAMIFICATION_STORAGE_KEY)).toBe(JSON.stringify(state))
  const second = render(<App />)
  expect(within(second.container).getByText('Prestige II', { selector: 'summary' })).toBeTruthy()
  first.unmount(); second.unmount()
  render(<App />)
  expect(screen.getByText('Prestige II', { selector: 'summary' })).toBeTruthy()
  expect(JSON.parse(localStorage.getItem(GAMIFICATION_STORAGE_KEY)!)).toEqual(state)
})
it('zeigt nach V den maximalen Fortschritt und fünf erreichte Stufen', () => {
  render(<PrestigePanel focusMilliseconds={1000 * 3_600_000} />)
  fireEvent.click(screen.getByText(/Langfristiger Fortschritt/))
  expect(screen.getByText('Maximaler Prestige-Rang V erreicht.')).toBeTruthy()
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100')
  expect(screen.getAllByText('Erreicht')).toHaveLength(5)
  expect(screen.getAllByText('Kommt in Phase 7B')).toHaveLength(5)
})
it('behandelt beschädigte gespeicherte Fokuszeit ohne Prestige-Freischaltung', () => {
  localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify({ ...initialGamificationState, totalFocusMilliseconds: 'fake', coins: 23 }))
  render(<App />)
  expect(screen.getByText('Prestige 0', { selector: 'summary' })).toBeTruthy()
  expect(JSON.parse(localStorage.getItem(GAMIFICATION_STORAGE_KEY)!).coins).toBe(23)
})
it('hält die lokale Vorschau 0 bis V vollständig getrennt von echten Daten', () => {
  vi.stubEnv('DEV', true)
  const state = { ...initialGamificationState, coins: 42, totalFocusMilliseconds: 25 * 3_600_000 }
  localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify(state))
  const before = JSON.stringify(state), onChange = vi.fn()
  const write = vi.spyOn(Storage.prototype, 'setItem')
  render(<GamificationDebug state={state} enabled onChange={onChange} />)
  fireEvent.click(screen.getByText('Lokaler Gamification-Testmodus'))
  for (const [rank, label] of ['0', 'I', 'II', 'III', 'IV', 'V'].entries()) {
    fireEvent.change(screen.getByLabelText('Prestige-Vorschau'), { target: { value: rank } })
    expect(screen.getByText(`Vorschau: Prestige ${label}`)).toBeTruthy()
  }
  fireEvent.click(screen.getByRole('button', { name: 'Prestige-Vorschau zurücksetzen' }))
  expect(screen.getByText('Vorschau: Prestige 0')).toBeTruthy()
  expect(JSON.stringify(state)).toBe(before)
  expect(localStorage.getItem(GAMIFICATION_STORAGE_KEY)).toBe(before)
  expect(onChange).not.toHaveBeenCalled()
  expect(write).not.toHaveBeenCalled()
})
it('zeigt im Produktionsmodus keine Prestige-Vorschau', () => {
  vi.stubEnv('DEV', false)
  render(<App />)
  expect(screen.queryByLabelText('Prestige-Vorschau')).toBeNull()
  expect(screen.queryByText('Vorschau: Prestige 0')).toBeNull()
})
