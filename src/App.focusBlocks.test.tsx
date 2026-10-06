// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'
import { createTestLocks } from './services/testLocks'
import { GAMIFICATION_STORAGE_KEY } from './services/gamification'
let now = 0
const key = 'mission.saved-mission.v1'
const stored = () => JSON.parse(localStorage.getItem(key)!)
const game = () => JSON.parse(localStorage.getItem(GAMIFICATION_STORAGE_KEY)!)
const tick = (ms: number) => act(() => { now += ms; vi.advanceTimersByTime(250) })
beforeEach(() => {
  localStorage.clear(); now = 0; vi.useFakeTimers(); vi.spyOn(performance, 'now').mockImplementation(() => now)
  Object.defineProperty(navigator, 'locks', { configurable: true, value: createTestLocks() })
  localStorage.setItem(key, JSON.stringify({ form: { goal: 'SQL', timeBudgetMinutes: 50, energyLevel: 'medium', learningBlocker: null },
    mission: { id: 'mission', goal: 'SQL', timeBudgetMinutes: 50, timeMode: 'manual', energyLevel: 'medium', learningBlocker: null, focusStrategy: { mode: 'pomodoro' },
      steps: [{ id: 'one', title: 'SQL üben', description: 'Versuche eine kleine Abfrage.', minutes: 50, kind: 'practice', done: false }] }, remainingSeconds: 3000 }))
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })
it('führt 25/5/25 mit bewusstem Start und genau einer korrekten Historie durch', () => {
  render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Fokusblock starten' })); tick(1500000)
  expect(game().coins).toBe(25); expect(stored().remainingSeconds).toBe(1500)
  expect(screen.getByRole('button', { name: 'Pause starten' })).toBeTruthy()
  tick(600000); expect(game().coins).toBe(25)
  fireEvent.click(screen.getByRole('button', { name: 'Pause starten' })); tick(300000)
  expect(game().totalFocusMilliseconds).toBe(1500000)
  expect(stored().activeSession.breakSeconds).toBe(300)
  expect(screen.getByRole('button', { name: 'Fokusblock starten' })).toBeTruthy()
  tick(60000); expect(game().coins).toBe(25)
  fireEvent.click(screen.getByRole('button', { name: 'Fokusblock starten' })); tick(1500000)
  expect(game().coins).toBe(50); expect(stored().history).toHaveLength(1)
  expect(stored().history[0]).toMatchObject({ focusSeconds: 3000, breakSeconds: 300, completedFocusBlocks: 2, status: 'completed' })
  tick(60000); expect(stored().history).toHaveLength(1); expect(game().coins).toBe(50)
})
it('überspringt die Pause ohne automatischen Fokusstart oder Belohnung', () => {
  render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Fokusblock starten' })); tick(1500000)
  fireEvent.click(screen.getByRole('button', { name: 'Pause überspringen' })); tick(300000)
  expect(game().coins).toBe(25); expect(stored().focusBlocks.phase).toBe('focus')
  expect(screen.getByRole('button', { name: 'Fokusblock starten' })).toBeTruthy()
})
it.each(['focus', 'break'] as const)('lädt die %s-Phase angehalten ohne Offline-Vergütung', phase => {
  const view = render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Fokusblock starten' })); tick(phase === 'break' ? 1500000 : 60000)
  if (phase === 'break') { fireEvent.click(screen.getByRole('button', { name: 'Pause starten' })); tick(60000) }
  view.unmount(); const before = game().totalFocusMilliseconds, blocks = stored().focusBlocks
  now += 3600000; render(<App />); tick(60000)
  expect(game().totalFocusMilliseconds).toBe(before); expect(stored().focusBlocks).toEqual(blocks)
  expect(stored().history).toEqual([])
})
it.each(['focus', 'break'] as const)('beendet vorzeitig in %s nur mit tatsächlich verdienter Fokuszeit', phase => {
  render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Fokusblock starten' })); tick(phase === 'break' ? 1500000 : 60000)
  if (phase === 'break') { fireEvent.click(screen.getByRole('button', { name: 'Pause starten' })); tick(60000) }
  const before = game().totalFocusMilliseconds
  fireEvent.click(screen.getByRole('button', { name: 'Session beenden' }))
  expect(game().totalFocusMilliseconds).toBe(before)
  expect(stored().history[0]).toMatchObject({ status: 'ended_early', focusSeconds: before / 1000 })
})
it('lässt Lernschritte unabhängig von Blöcken und Vergütung abhaken', () => {
  render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Fokusblock starten' }))
  fireEvent.click(screen.getByRole('checkbox', { name: /SQL üben/ }))
  expect(game().coins).toBe(0); expect(stored().focusBlocks.block).toBe(1)
})
it('behält die Blockanzahl auch mitten im ersten Block bei', () => {
  const data = stored(); data.mission.timeBudgetMinutes = 120; data.remainingSeconds = 7200; localStorage.setItem(key, JSON.stringify(data))
  render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Fokusblock starten' })); tick(1200000)
  expect(screen.getByText('Fokus · Block 1 von 5')).toBeTruthy()
})
it('setzt den Pausen-Timer sicher zurück und erhält bereits vergütete Fokuszeit', () => {
  render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Fokusblock starten' })); tick(1500000)
  fireEvent.click(screen.getByRole('button', { name: 'Pause starten' })); tick(60000)
  fireEvent.click(screen.getByRole('button', { name: 'Timer zurücksetzen' }))
  expect(stored().focusBlocks).toMatchObject({ phase: 'focus', remainingMilliseconds: 1500000 })
  expect(stored().remainingSeconds).toBe(3000); expect(game().coins).toBe(25)
  tick(60000); expect(game().coins).toBe(25)
})
it('fordert Bestätigung für Strategieänderungen während Fokuszeit und rechnet nichts rückwirkend um', () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Fokusblock starten' })); tick(60000)
  fireEvent.click(screen.getByRole('button', { name: 'Lernplan bearbeiten' }))
  fireEvent.change(screen.getByLabelText('Fokusstrategie'), { target: { value: '50-10' } })
  fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }))
  expect(confirm).toHaveBeenCalledOnce(); expect(stored().mission.focusStrategy.mode).toBe('pomodoro')
  confirm.mockReturnValue(true)
  fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }))
  expect(stored().mission.focusStrategy.mode).toBe('50-10')
  expect(stored().remainingSeconds).toBe(2940); expect(game().coins).toBe(1)
  tick(60000); expect(game().coins).toBe(1)
})
it('sperrt einen zweiten Tab auch für Block- und Pausenaktionen', () => {
  const first = render(<App />), second = render(<App />)
  const a = within(first.container), b = within(second.container)
  fireEvent.click(a.getByRole('button', { name: 'Fokusblock starten' })); tick(1500000)
  act(() => window.dispatchEvent(new StorageEvent('storage', { key })))
  expect(second.container.querySelector('fieldset')!.disabled).toBe(true)
  fireEvent.click(b.getByRole('button', { name: 'Pause starten' }))
  tick(300000); expect(game().coins).toBe(25)
  first.unmount()
  expect(second.container.querySelector('fieldset')!.disabled).toBe(false)
  fireEvent.click(b.getByRole('button', { name: 'Pause starten' })); tick(300000)
  expect(game().coins).toBe(25); expect(stored().focusBlocks.phase).toBe('focus')
})
