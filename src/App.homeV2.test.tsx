// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'
import { createTestLocks } from './services/testLocks'
import { initialGamificationState } from './types/gamification'
import { COMPANION_PREFERENCE_KEY } from './services/companionPreference'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('mission.onboarding.v1', '{"version":1,"status":"skipped"}')
  Object.defineProperty(navigator, 'locks', { configurable: true, value: createTestLocks() })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
function seed(active = false) {
  const mission = { id: 'plan-1', goal: 'SQL lernen', timeBudgetMinutes: 20, energyLevel: 'medium', learningBlocker: 'starting', timeMode: 'manual', steps: [{ id: 'step-1', title: 'JOIN nachvollziehen', description: 'SQL JOIN ansehen', minutes: 20, kind: 'learning', done: false }] }
  localStorage.setItem('mission.saved-mission.v1', JSON.stringify({ form: { goal: mission.goal, timeBudgetMinutes: 20, energyLevel: 'medium', learningBlocker: 'starting' }, mission, remainingSeconds: 900, elapsedSeconds: 0, history: [], activeSession: active ? { id: 'session-keep', missionId: mission.id, startedAt: '2026-10-16T12:00:00Z', goal: mission.goal, focusSeconds: 300, plannedSeconds: 1200, timeMode: 'manual', completedSteps: 0, totalSteps: 1 } : null }))
  localStorage.setItem('mission.gamification.v1', JSON.stringify({ ...initialGamificationState, coins: 17, totalFocusMilliseconds: 300000, ownedOrbIds: ['orb-common'], equippedOrbId: 'orb-common', completedCratePurchaseIds: ['paid-1'] }))
}
it('keeps paused progress, session ID and legacy rights on render, then resumes with the existing handler', () => {
  seed(true)
  const write = vi.spyOn(Storage.prototype, 'setItem')
  render(<App />)
  const home = within(screen.getByRole('region', { name: 'Heutige Mission' }))
  expect(home.getByText(/Session pausiert/)).toBeTruthy()
  expect(home.getByText('JOIN nachvollziehen')).toBeTruthy()
  const game = JSON.parse(localStorage.getItem('mission.gamification.v1')!)
  expect(game).toEqual({ ...initialGamificationState, coins: 17, totalFocusMilliseconds: 300000, ownedOrbIds: ['orb-common'], equippedOrbId: 'orb-common', completedCratePurchaseIds: ['paid-1'] })
  const saved = JSON.parse(localStorage.getItem('mission.saved-mission.v1')!)
  expect(saved.remainingSeconds).toBe(900); expect(saved.activeSession.id).toBe('session-keep'); expect(saved.activeSession.focusSeconds).toBe(300)
  expect(write.mock.calls.some(([key]) => key === COMPANION_PREFERENCE_KEY)).toBe(false)
  fireEvent.click(home.getByRole('button', { name: 'Session fortsetzen' }))
  expect(screen.getByRole('main', { name: 'Fokusmodus' })).toBeTruthy()
  expect(JSON.parse(localStorage.getItem('mission.saved-mission.v1')!).activeSession.id).toBe('session-keep')
})
it('keeps legacy collection available alongside prepared mission and navigation', () => {
  seed(); render(<App />)
  expect(screen.getByRole('button', { name: 'Fokus beginnen' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Level 1' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /Sammlung/ }))
  expect(screen.getByRole('dialog', { name: /Orb-Sammlung/ })).toBeTruthy()
})
it('directs an empty home to the existing plan form without creating a session', () => {
  render(<App />)
  fireEvent.click(within(screen.getByRole('region', { name: 'Heutige Mission' })).getByRole('button', { name: 'Mission erstellen' }))
  expect(screen.getByLabelText('Was möchtest du lernen?')).toBeTruthy()
  expect(JSON.parse(localStorage.getItem('mission.saved-mission.v1')!).activeSession).toBeNull()
})
it.each([375, 390, 430, 768, 1024])('retains responsive navigation and complete mission text at simulated %i px', width => {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: query.includes('768px') && width <= 768, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
  seed(); render(<App />)
  expect(screen.getByRole('navigation', { name: width <= 768 ? 'Mobile Hauptnavigation' : 'Desktop Hauptnavigation' })).toBeTruthy()
  expect(within(screen.getByRole('region', { name: 'Heutige Mission' })).getByRole('heading', { name: 'SQL lernen' })).toBeTruthy()
})
