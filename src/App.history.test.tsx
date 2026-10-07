import { within } from './services/testNavigation'
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createTestLocks } from './services/testLocks'
import { GAMIFICATION_STORAGE_KEY } from './services/gamification'

const key = 'mission.saved-mission.v1'
const stored = () => JSON.parse(localStorage.getItem(key)!)
const game = () => JSON.parse(localStorage.getItem(GAMIFICATION_STORAGE_KEY)!)
let now = 0
function tick(ms: number) { act(() => { now += ms; vi.advanceTimersByTime(250) }) }
function seed(mode = 'manual') {
  const mission = { id: 'mission-preserved', goal: 'Statistik', timeBudgetMinutes: 1, energyLevel: 'medium', learningBlocker: null, timeMode: mode,
    steps: [{ id: 'step-preserved', title: 'Mittelwert', description: 'Eine Zahl berechnen.', minutes: 1, kind: 'learning', done: true }] }
  localStorage.setItem(key, JSON.stringify({ form: { goal: mission.goal, timeBudgetMinutes: 5, energyLevel: 'medium', learningBlocker: null }, mission, remainingSeconds: mode === 'stopwatch' ? 0 : 60, elapsedSeconds: 0 }))
}
beforeEach(() => {
  localStorage.clear(); now = 0; vi.useFakeTimers()
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  Object.defineProperty(navigator, 'locks', { configurable: true, value: createTestLocks() })
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

describe('Historie im Session-Lebenszyklus', () => {
  it.each(['automatic', 'manual'])('speichert den regulären %s-Abschluss genau einmal', mode => {
    seed(mode); const first = render(<App />); const ui = within(first.container)
    fireEvent.click(ui.getByRole('button', { name: /Start/ })); tick(60_000)
    expect(stored().history).toHaveLength(1)
    expect(stored().history[0]).toMatchObject({ goal: 'Statistik', focusSeconds: 60, plannedSeconds: 60, timeMode: mode, status: 'completed', completedSteps: 1, totalSteps: 1 })
    expect(stored().activeSession).toBeNull()
    expect(game().coins).toBe(1)
    tick(60_000); first.unmount(); render(<App />)
    expect(stored().history).toHaveLength(1)
    expect(game().coins).toBe(1)
  })

  it.each([0, 30_500])('beendet vorzeitig nach %i ms ohne doppelte Vergütung', elapsed => {
    seed(); const ui = within(render(<App />).container)
    fireEvent.click(ui.getByRole('button', { name: /Start/ })); tick(elapsed)
    fireEvent.click(ui.getByRole('button', { name: 'Session beenden' }))
    expect(stored().history).toHaveLength(elapsed === 0 ? 0 : 1)
    if (elapsed) expect(stored().history[0]).toMatchObject({ focusSeconds: 30.5, status: 'ended_early' })
    expect(game().totalFocusMilliseconds).toBe(elapsed)
    expect(ui.queryByRole('button', { name: 'Session beenden' })).toBeNull()
    tick(60_000)
    expect(game().totalFocusMilliseconds).toBe(elapsed)
  })

  it('erhält die Session-ID bei Pause, Editor und Reload und zählt geschlossene Zeit nicht', () => {
    seed(); const first = render(<App />); const ui = within(first.container)
    fireEvent.click(ui.getByRole('button', { name: /Start/ })); tick(30_000)
    const id = stored().activeSession.id
    fireEvent.click(ui.getByRole('button', { name: 'Fokusmodus verlassen' }))
    expect(stored().history).toEqual([])
    fireEvent.click(ui.getByRole('button', { name: 'Lernplan bearbeiten' }))
    fireEvent.click(ui.getByRole('button', { name: 'Änderungen speichern' }))
    expect(stored().activeSession.id).toBe(id)
    expect(stored().history).toEqual([])
    first.unmount(); now += 3_600_000
    const second = within(render(<App />).container)
    expect(stored().activeSession.id).toBe(id)
    fireEvent.click(second.getByRole('button', { name: /Start/ })); tick(30_000)
    expect(stored().history[0]).toMatchObject({ id, focusSeconds: 60, status: 'completed' })
    expect(game().totalFocusMilliseconds).toBe(60_000)
  })

  it('schließt Stoppuhr bewusst ab und zählt Reset nicht als Ende', () => {
    seed('stopwatch'); const ui = within(render(<App />).container)
    fireEvent.click(ui.getByRole('button', { name: /Start/ })); tick(30_000)
    const id = stored().activeSession.id
    fireEvent.click(ui.getByRole('button', { name: 'Timer zurücksetzen' }))
    expect(stored().history).toEqual([])
    fireEvent.click(ui.getByRole('button', { name: /Fortsetzen/ })); tick(40_000)
    fireEvent.click(ui.getByRole('button', { name: 'Session abschließen' }))
    expect(stored().history[0]).toMatchObject({ id, focusSeconds: 70, plannedSeconds: null, timeMode: 'stopwatch', status: 'completed' })
    expect(game().coins).toBe(1)
    expect(game().totalFocusMilliseconds).toBe(70_000)
  })

  it('öffnet die eingeklappte Historie ohne Gamification-Schreibzugriff', () => {
    seed(); const ui = within(render(<App />).container)
    const summary = ui.getByText('Deine letzten Missionen')
    expect(summary.closest('details')?.open).toBe(false)
    const before = localStorage.getItem(GAMIFICATION_STORAGE_KEY)
    const write = vi.spyOn(Storage.prototype, 'setItem')
    fireEvent.click(summary)
    expect(ui.getByText(/Noch keine beendete Fokus-Session/)).toBeTruthy()
    expect(localStorage.getItem(GAMIFICATION_STORAGE_KEY)).toBe(before)
    expect(write).not.toHaveBeenCalled()
  })

  it('überträgt eine pausierte Session zwischen Tabs ohne zweiten Eintrag', () => {
    seed(); const first = render(<App />); const second = render(<App />)
    const a = within(first.container); const b = within(second.container)
    fireEvent.click(b.getByRole('button', { name: /Start/ }))
    expect(stored().activeSession ?? null).toBeNull()
    fireEvent.click(a.getByRole('button', { name: /Start/ })); tick(30_000)
    const id = stored().activeSession.id
    first.unmount()
    expect(stored().history).toEqual([])
    expect(stored().activeSession.id).toBe(id)
    fireEvent.click(b.getByRole('button', { name: /Start/ })); tick(30_000)
    expect(stored().history).toHaveLength(1)
    expect(stored().history[0].id).toBe(id)
    expect(game().coins).toBe(1)
  })

  it('erzeugt für einen weiteren Countdown eine neue Session-ID', () => {
    seed(); const ui = within(render(<App />).container)
    fireEvent.click(ui.getByRole('button', { name: /Start/ })); tick(60_000)
    const id = stored().history[0].id
    fireEvent.click(ui.getByRole('button', { name: /Weiter/ })); tick(60_000)
    expect(stored().history).toHaveLength(2)
    expect(new Set(stored().history.map((e: { id: string }) => e.id)).size).toBe(2)
    expect(stored().history.some((e: { id: string }) => e.id === id)).toBe(true)
    expect(game().coins).toBe(2)
    expect(game().totalFocusMilliseconds).toBe(120_000)
  })

  it('verhindert Sessionstart und Vergütung bei einem Speicherfehler', () => {
    seed(); const ui = within(render(<App />).container)
    const original = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, name, value) {
      if (name === key) throw new Error('quota')
      original.call(this, name, value)
    })
    fireEvent.click(ui.getByRole('button', { name: /Start/ })); tick(60_000)
    expect(game().coins).toBe(0)
    expect(stored().history).toEqual([])
    expect(ui.getByText(/Die lokale Speicherung ist nicht verfügbar/)).toBeTruthy()
  })

  it('lädt fehlerhafte Historie ohne aktive Mission oder Timer zu verwerfen', () => {
    seed(); const state = stored(); state.history = [null, { id: 'bad' }]; state.activeSession = { id: 'bad' }
    localStorage.setItem(key, JSON.stringify(state))
    const ui = within(render(<App />).container)
    expect(stored().mission.id).toBe('mission-preserved')
    expect(ui.getByLabelText('Verbleibende Zeit: 01:00')).toBeTruthy()
    expect(stored().history).toEqual([])
    expect(game().coins).toBe(0)
  })
})
