// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import HomeMission from './HomeMission'
import { COMPANION_PREFERENCE_KEY } from '../services/companionPreference'
import type { LearningPlan } from '../types/learningPlan'

beforeEach(() => localStorage.clear())
afterEach(() => { cleanup(); vi.restoreAllMocks() })
const mission: LearningPlan = { id: 'mission-1', goal: 'Ein sehr langes Lernziel '.repeat(10), timeBudgetMinutes: 50, timeMode: 'manual', energyLevel: 'medium', learningBlocker: null,
  steps: [{ id: 'a', title: 'Schon erledigt', description: '', minutes: 25, kind: 'learning', done: true }, { id: 'b', title: 'Nächste Aufgabe', description: '', minutes: 25, kind: 'practice', done: false }] }
function props() { return { mission: null, hidden: false, status: 'Dein Timer ist bereit.', action: 'Mission erstellen', running: false, completed: 0, onAction: vi.fn(), onPlan: vi.fn(), onProjects: vi.fn() } }
it('uses decorative Luna without persisting default or producing any other writes', () => {
  const write = vi.spyOn(Storage.prototype, 'setItem')
  const { container } = render(<HomeMission {...props()} />)
  expect(container.querySelector('[data-skin="luna"]')?.getAttribute('aria-hidden')).toBe('true')
  expect(localStorage.getItem(COMPANION_PREFERENCE_KEY)).toBeNull()
  expect(write).not.toHaveBeenCalled()
})
it.each(['luna', 'milo', 'nova'])('reads explicit %s without changing preference or gamification', skinId => {
  localStorage.setItem(COMPANION_PREFERENCE_KEY, JSON.stringify({ version: 1, skinId }))
  localStorage.setItem('mission.gamification.v1', '{"coins":17,"totalFocusMilliseconds":123}')
  const before = { ...localStorage }; const write = vi.spyOn(Storage.prototype, 'setItem')
  const { container } = render(<HomeMission {...props()} />)
  expect(container.querySelector('.mission-companion')?.getAttribute('data-skin')).toBe(skinId)
  expect({ ...localStorage }).toEqual(before); expect(write).not.toHaveBeenCalled()
})
it.each(['{broken', '{"version":2,"skinId":"milo"}', '{"version":1,"skinId":"unknown"}'])('keeps invalid preference intact and uses Luna: %s', raw => {
  localStorage.setItem(COMPANION_PREFERENCE_KEY, raw)
  const { container } = render(<HomeMission {...props()} />)
  expect(container.querySelector('[data-skin="luna"]')).toBeTruthy()
  expect(localStorage.getItem(COMPANION_PREFERENCE_KEY)).toBe(raw)
})
it('handles inaccessible storage without claiming a saved preference', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  const { container } = render(<HomeMission {...props()} />)
  expect(container.querySelector('[data-skin="luna"]')).toBeTruthy()
  expect(screen.getByText(/Companion-Auswahl kann gerade nicht/)).toBeTruthy()
})
it('shows existing mission values, next step and projects without modifying input', () => {
  const before = structuredClone(mission)
  render(<HomeMission {...props()} mission={mission} completed={1} project="Java" activeProject="Statistik" />)
  expect(screen.getByRole('heading', { name: mission.goal.trim() }).textContent).toBe(mission.goal)
  expect(screen.getByText('50 Min geplant · 1/2 Schritte')).toBeTruthy()
  expect(screen.getByText('Nächste Aufgabe')).toBeTruthy()
  expect(screen.getByText('Projekt: Java')).toBeTruthy()
  expect(screen.getByText('Aktives Projekt: Statistik')).toBeTruthy()
  expect(mission).toEqual(before)
})
it.each(['Fokus beginnen', 'Session fortsetzen', 'Zur laufenden Fokusansicht', 'Weiter im Fokus'])('delegates %s only on an explicit click', action => {
  const p = props(); const ui = render(<HomeMission {...p} mission={mission} action={action} status="Session pausiert – dein Fortschritt bleibt erhalten." />)
  expect(p.onAction).not.toHaveBeenCalled()
  ui.rerender(<HomeMission {...p} mission={mission} action={action} status="Session pausiert – dein Fortschritt bleibt erhalten." />)
  expect(p.onAction).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: action })); expect(p.onAction).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Plan ansehen' })); expect(p.onPlan).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Projekte ansehen' })); expect(p.onProjects).toHaveBeenCalledTimes(1)
})
it('pauses companion animation while the mounted home is hidden', () => {
  const { container } = render(<HomeMission {...props()} hidden />)
  expect(container.querySelector('.mission-companion')?.getAttribute('data-animated')).toBe('false')
  expect(screen.queryByRole('region', { name: 'Heutige Mission' })).toBeNull()
})
it('keeps hero scenery decorative and inert without extra controls or side effects', () => {
  const p = props(); const write = vi.spyOn(Storage.prototype, 'setItem')
  const { container, rerender } = render(<HomeMission {...p} />)
  const scenery = container.querySelector('.companion-hero-scenery')!
  expect(scenery.getAttribute('aria-hidden')).toBe('true')
  expect(scenery.querySelector('button, a, input, [tabindex]')).toBeNull()
  expect(screen.getAllByRole('button')).toHaveLength(2)
  rerender(<HomeMission {...p} hidden />)
  expect(container.querySelector('.companion-hero-stage')?.getAttribute('data-motion')).toBe('paused')
  expect(write).not.toHaveBeenCalled(); expect(p.onAction).not.toHaveBeenCalled()
})
it('keeps hero motion CSS-only, click-through and disabled for reduced motion', async () => {
  const { readFileSync } = await import(/* @vite-ignore */ 'node:' + 'fs')
  const css: string = readFileSync('src/home.css', 'utf8')
  expect(css).toMatch(/\.companion-hero-scenery\s*\{[^}]*pointer-events: none/)
  expect(css).toMatch(/prefers-reduced-motion: reduce[^}]*\.companion-hero-scenery span\s*\{[^}]*animation: none/)
  expect(css).toContain('animation-play-state: paused')
  expect(css).not.toMatch(/filter:|url\(/)
})
