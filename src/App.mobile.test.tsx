// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'
import { MOBILE_QUERY } from './services/useMobileLayout'
import { createTestLocks } from './services/testLocks'
import { initialGamificationState } from './types/gamification'
import { GAMIFICATION_STORAGE_KEY } from './services/gamification'
import { getOrbSize } from './services/orbSize'
const missionKey = 'mission.saved-mission.v1'
function viewport(width: number) {
  vi.stubGlobal('innerWidth', width)
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: query === MOBILE_QUERY && width <= 768, media: query,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })))
}
function seed() {
  localStorage.setItem(missionKey, JSON.stringify({ form: { goal: 'SQL lernen', timeBudgetMinutes: 20, energyLevel: 'medium', learningBlocker: null },
    mission: { id: 'mission-one', goal: 'SQL lernen', timeBudgetMinutes: 20, energyLevel: 'medium', learningBlocker: null,
      steps: [{ id: 'step-one', title: 'SQL ausprobieren', description: 'Eine Abfrage versuchen', minutes: 20, kind: 'practice', done: false }] }, remainingSeconds: 1200 }))
}
const navigation = () => within(screen.getByRole('navigation', { name: 'Mobile Hauptnavigation' }))
const stored = () => JSON.parse(localStorage.getItem(missionKey)!)
beforeEach(() => {
  localStorage.clear(); viewport(390)
  Object.defineProperty(navigator, 'locks', { configurable: true, value: createTestLocks() })
  localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify({ ...initialGamificationState, coins: 41, totalFocusMilliseconds: 1800000 }))
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers() })
it.each([320, 360, 390, 430, 768])('shows five mobile actions with Home active at %s px', width => {
  viewport(width); render(<App />)
  expect(navigation().getAllByRole('button')).toHaveLength(5)
  expect(navigation().getByRole('button', { name: 'Home' }).getAttribute('aria-current')).toBe('page')
  expect(screen.getByRole('region', { name: 'Heutige Mission' })).toBeTruthy()
  expect(screen.queryByRole('textbox', { name: 'Was möchtest du lernen?' })).toBeNull()
})
it.each([769, 1280])('preserves the complete desktop dashboard at %s px', width => {
  viewport(width); render(<App />)
  expect(screen.queryByRole('navigation', { name: 'Mobile Hauptnavigation' })).toBeNull()
  expect(screen.getByRole('textbox', { name: 'Was möchtest du lernen?' })).toBeTruthy()
  expect(screen.getByRole('region', { name: 'Lern-Timer' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Mission Core' })).toBeTruthy()
})
it.each(['Home', 'Plan', 'Bibliothek', 'Fortschritt'])('activates %s accessibly without changing any storage', label => {
  render(<App />)
  const snapshot = { ...localStorage }, write = vi.spyOn(Storage.prototype, 'setItem')
  fireEvent.click(navigation().getByRole('button', { name: label }))
  expect(navigation().getByRole('button', { name: label }).getAttribute('aria-current')).toBe('page')
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: label, level: 1 }))
  expect(write).not.toHaveBeenCalled(); expect({ ...localStorage }).toEqual(snapshot)
})
it('routes an orb without mission to planning without creating a session', () => {
  render(<App />); fireEvent.click(navigation().getByRole('button', { name: 'Mission erstellen' }))
  expect(screen.getByRole('textbox', { name: 'Was möchtest du lernen?' })).toBeTruthy()
  expect(stored().mission).toBeNull(); expect(stored().activeSession).toBeNull()
  expect(navigation().getByRole('button', { name: 'Plan' }).getAttribute('aria-current')).toBe('page')
})
it('opens a paused mission without starting a timer or session and returns to the previous tab', () => {
  seed(); render(<App />); fireEvent.click(navigation().getByRole('button', { name: 'Bibliothek' }))
  const original = { ...localStorage }, write = vi.spyOn(Storage.prototype, 'setItem')
  fireEvent.click(navigation().getByRole('button', { name: 'Fokusmodus öffnen' }))
  expect(screen.queryByRole('navigation')).toBeNull()
  expect(screen.getByRole('main', { name: 'Fokusmodus' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Fortsetzen' })).toBeTruthy()
  expect(stored().activeSession).toBeNull(); expect(write).not.toHaveBeenCalled()
  expect({ ...localStorage }).toEqual(original)
  fireEvent.click(screen.getByRole('button', { name: 'Fokusmodus verlassen' }))
  expect(navigation().getByRole('button', { name: 'Bibliothek' }).getAttribute('aria-current')).toBe('page')
  expect(document.activeElement).toBe(navigation().getByRole('button', { name: 'Fokusmodus öffnen' }))
})
it('keeps an existing running session identity when opening focus again', () => {
  seed(); vi.useFakeTimers(); let now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Start' }))
  act(() => { now = 60000; vi.advanceTimersByTime(250) })
  const id = stored().activeSession.id
  fireEvent.click(screen.getByRole('button', { name: 'Fokusmodus verlassen' }))
  const before = { ...localStorage }
  fireEvent.click(navigation().getByRole('button', { name: 'Fokusmodus öffnen' }))
  expect(stored().activeSession.id).toBe(id); expect({ ...localStorage }).toEqual(before)
  expect(screen.getByRole('button', { name: 'Fortsetzen' })).toBeTruthy()
  expect(JSON.parse(localStorage.getItem(GAMIFICATION_STORAGE_KEY)!).coins).toBe(42)
})
it('preserves timer remainder and step IDs across all tabs', () => {
  seed(); render(<App />)
  const before = { ...localStorage }
  for (const label of ['Plan', 'Bibliothek', 'Fortschritt', 'Home']) fireEvent.click(navigation().getByRole('button', { name: label }))
  expect({ ...localStorage }).toEqual(before)
  expect(stored().remainingSeconds).toBe(1200); expect(stored().mission.steps[0].id).toBe('step-one')
})
it('offers the real plan editor and context on Plan', () => {
  seed(); render(<App />); fireEvent.click(navigation().getByRole('button', { name: 'Plan' }))
  fireEvent.click(screen.getByRole('button', { name: 'Lernplan bearbeiten' }))
  expect(screen.getByRole('button', { name: 'Änderungen speichern' })).toBeTruthy()
  expect(screen.getAllByText('Mehr Kontext').length).toBeGreaterThan(0)
})
it('opens library filters without mounting a fresh library on tab switches', () => {
  render(<App />); fireEvent.click(navigation().getByRole('button', { name: 'Bibliothek' }))
  fireEvent.change(screen.getByLabelText('Suchen'), { target: { value: 'java' } })
  fireEvent.click(navigation().getByRole('button', { name: 'Home' }))
  fireEvent.click(navigation().getByRole('button', { name: 'Bibliothek' }))
  expect((screen.getByLabelText('Suchen') as HTMLInputElement).value).toBe('java')
})
it('shows statistics, goals, history and prestige in Progress', () => {
  render(<App />); fireEvent.click(navigation().getByRole('button', { name: 'Fortschritt' }))
  expect(screen.getByLabelText('Tagesziel aktivieren')).toBeTruthy()
  expect(screen.getByText('Deine letzten Missionen')).toBeTruthy()
  expect(document.querySelector('.prestige-panel')).toBeTruthy()
})
it('supports tutorial access while blocking navigation during the tour', () => {
  render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Mission-Tour starten' }))
  expect(screen.getByRole('dialog')).toBeTruthy()
  expect(document.querySelector('.setup-panel')?.hasAttribute('hidden')).toBe(false)
  expect(document.querySelector('.plan-panel')?.hasAttribute('hidden')).toBe(false)
  expect((document.querySelector('.mobile-navigation button') as HTMLButtonElement).disabled).toBe(true)
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(navigation().getByRole('button', { name: 'Home' }).getAttribute('aria-current')).toBe('page')
})
it('uses the equipped prestige orb and global development display level in the navigation', async () => {
  vi.stubEnv('DEV', true)
  localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify({ ...initialGamificationState, totalFocusMilliseconds: 500 * 3600000, equippedOrbId: 'orb-prestige-zenith' }))
  render(<App />); fireEvent.click(navigation().getByRole('button', { name: 'Fortschritt' }))
  fireEvent.click(await screen.findByText('Lokaler Gamification-Testmodus'))
  fireEvent.click(screen.getByLabelText('Globalen Test-Level verwenden'))
  fireEvent.change(screen.getByRole('slider'), { target: { value: '100' } })
  expect(document.querySelector('.mobile-navigation-orb .orb-art')?.getAttribute('data-orb-id')).toBe('orb-prestige-zenith')
  expect((document.querySelector('.mobile-navigation-orb') as HTMLElement).style.width).toBe(`${getOrbSize(100) * .52}px`)
  fireEvent.click(navigation().getByRole('button', { name: 'Home' }))
  expect(screen.getByRole('heading', { name: 'Level 100' })).toBeTruthy()
})
it('uses native keyboard-focusable navigation buttons with no positive tabindex', () => {
  render(<App />)
  for (const button of navigation().getAllByRole('button')) {
    expect(button.tabIndex).toBe(0); button.focus(); expect(document.activeElement).toBe(button)
  }
})
it('keeps navigation available in a read-only second tab without permitting focus rewards', () => {
  render(<App />); const second = render(<App />), ui = within(second.container)
  const nav = ui.getByRole('navigation', { name: 'Mobile Hauptnavigation' })
  fireEvent.click(within(nav).getByRole('button', { name: 'Plan' }))
  expect(second.container.querySelector('.setup-panel')?.hasAttribute('hidden')).toBe(false)
  expect(second.container.querySelector('textarea')?.matches(':disabled')).toBe(true)
  expect(second.container.querySelector('fieldset')?.disabled).toBe(true)
})
it.each([320, 360, 390, 430, 768, 1280])('keeps the navigation and content CSS contract bounded at %s px', async width => {
  const { readFileSync } = await import(/* @vite-ignore */ 'node:' + 'fs')
  const css = readFileSync('src/index.css', 'utf8')
  expect(css).toContain('@media (max-width: 768px)')
  expect(css).toContain('grid-template-columns: repeat(5, minmax(0, 1fr))')
  expect(css).toContain('calc(112px + env(safe-area-inset-bottom, 0px))')
  expect(css).toContain('min-height: 56px')
  expect(css).toContain('.mobile-navigation-orb .orb-art { width: 100%; height: 100%; }')
  viewport(width); render(<App />)
  if (width <= 768) {
    const orb = document.querySelector('.mobile-navigation-orb') as HTMLElement
    expect(parseFloat(orb.style.width)).toBeLessThanOrEqual(Math.min(64, width / 5))
  } else expect(screen.queryByRole('navigation')).toBeNull()
})
it('opens and closes collection on Home using the existing dialog', () => {
  render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Sammlung' }))
  expect(screen.getByRole('dialog')).toBeTruthy()
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(screen.queryByRole('dialog')).toBeNull()
})
it('preserves the same global test level when entering focus from navigation', async () => {
  seed(); vi.stubEnv('DEV', true); render(<App />)
  fireEvent.click(navigation().getByRole('button', { name: 'Fortschritt' }))
  fireEvent.click(await screen.findByText('Lokaler Gamification-Testmodus'))
  fireEvent.click(screen.getByLabelText('Globalen Test-Level verwenden'))
  fireEvent.change(screen.getByRole('slider'), { target: { value: '100' } })
  fireEvent.click(navigation().getByRole('button', { name: 'Fokusmodus öffnen' }))
  expect((document.querySelector('.focus-orb-stage') as HTMLElement).style.width).toBe(`min(${getOrbSize(100, 'focus')}px, 78vw, 100%)`)
  expect(stored().activeSession).toBeNull()
})
