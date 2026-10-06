// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'
import { createTestLocks } from './services/testLocks'
import { GAMIFICATION_STORAGE_KEY } from './services/gamification'
import { STATISTICS_STORAGE_KEY } from './services/learningStatistics'
const missionKey = 'mission.saved-mission.v1'
const read = (key: string) => JSON.parse(localStorage.getItem(key)!)
let monotonic = 0
function tick(ms: number) { act(() => { monotonic += ms; vi.setSystemTime(Date.now() + ms); vi.advanceTimersByTime(250) }) }
beforeEach(() => {
  localStorage.clear(); monotonic = 0; vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 4, 23, 50))
  vi.spyOn(performance, 'now').mockImplementation(() => monotonic)
  Object.defineProperty(navigator, 'locks', { configurable: true, value: createTestLocks() })
  localStorage.setItem(missionKey, JSON.stringify({ form: { goal: 'SQL', timeBudgetMinutes: 50, energyLevel: 'medium', learningBlocker: null },
    mission: { id: 'mission', goal: 'SQL', timeBudgetMinutes: 50, timeMode: 'manual', energyLevel: 'medium', learningBlocker: null, focusStrategy: { mode: 'pomodoro' },
      steps: [{ id: 'one', title: 'SQL üben', description: 'Eine kleine Abfrage versuchen.', minutes: 50, kind: 'practice', done: false }] }, remainingSeconds: 3000 }))
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })
it('splits real focus at local midnight, excludes breaks, and counts completion exactly once', () => {
  render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Fokusblock starten' })); tick(1500000)
  expect(read(STATISTICS_STORAGE_KEY).days).toEqual({ '2026-10-04': 600000, '2026-10-05': 900000 })
  const before = read(STATISTICS_STORAGE_KEY)
  fireEvent.click(screen.getByRole('button', { name: 'Pause starten' })); tick(300000)
  expect(read(STATISTICS_STORAGE_KEY)).toEqual(before)
  fireEvent.click(screen.getByRole('button', { name: 'Fokusblock starten' })); tick(1500000)
  const stats = read(STATISTICS_STORAGE_KEY)
  expect(stats.days['2026-10-05']).toBe(2400000); expect(stats.completedSessions).toBe(1)
  expect(read(GAMIFICATION_STORAGE_KEY).coins).toBe(50)
  tick(60000); expect(read(STATISTICS_STORAGE_KEY)).toEqual(stats)
  expect(read(missionKey).history[0].focusSeconds).toBe(3000)
})
it('reload pauses without counting offline time or creating a session count', () => {
  const view = render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Fokusblock starten' })); tick(60000)
  view.unmount(); const before = read(STATISTICS_STORAGE_KEY)
  tick(3600000); render(<App />); tick(60000)
  expect(read(STATISTICS_STORAGE_KEY)).toEqual(before)
  expect(read(missionKey).history).toEqual([])
})
it('ending early records a count but never rewards focus twice', () => {
  render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Fokusblock starten' })); tick(60000)
  const game = read(GAMIFICATION_STORAGE_KEY)
  fireEvent.click(screen.getByRole('button', { name: 'Session beenden' }))
  expect(read(STATISTICS_STORAGE_KEY).endedEarlySessions).toBe(1)
  expect(read(GAMIFICATION_STORAGE_KEY)).toEqual(game)
})
it('only opening statistics and editing goals preserves mission, history and all gamification', () => {
  render(<App />)
  const game = localStorage.getItem(GAMIFICATION_STORAGE_KEY), mission = localStorage.getItem(missionKey)
  expect(screen.queryByLabelText('Tagesziel in Minuten')).toBeNull()
  fireEvent.click(screen.getByText('Dein Lernfortschritt'))
  fireEvent.click(screen.getByLabelText('Tagesziel aktivieren'))
  fireEvent.change(screen.getByLabelText('Tagesziel in Minuten'), { target: { value: '90' } })
  fireEvent.click(screen.getByLabelText('Wochenziel aktivieren'))
  fireEvent.click(screen.getByRole('button', { name: 'Ziele speichern' }))
  expect(read(STATISTICS_STORAGE_KEY).goals).toEqual({ dailyMinutes: 90, weeklyMinutes: 300 })
  expect(localStorage.getItem(GAMIFICATION_STORAGE_KEY)).toBe(game)
  expect(localStorage.getItem(missionKey)).toBe(mission)
  expect(read(STATISTICS_STORAGE_KEY).days).toEqual({})
})
it('invalid goals show an accessible error without changing storage', () => {
  render(<App />); fireEvent.click(screen.getByText('Dein Lernfortschritt'))
  fireEvent.click(screen.getByLabelText('Tagesziel aktivieren'))
  fireEvent.change(screen.getByLabelText('Tagesziel in Minuten'), { target: { value: '1' } })
  const before = localStorage.getItem(STATISTICS_STORAGE_KEY)
  fireEvent.click(screen.getByRole('button', { name: 'Ziele speichern' }))
  expect(screen.getByRole('alert').textContent).toContain('10–720')
  expect(localStorage.getItem(STATISTICS_STORAGE_KEY)).toBe(before)
})
it('Web Lock prevents duplicate statistics and permits conservative writer handover', () => {
  const first = render(<App />), second = render(<App />)
  fireEvent.click(within(first.container).getByRole('button', { name: 'Fokusblock starten' })); tick(60000)
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: STATISTICS_STORAGE_KEY })))
  fireEvent.click(within(second.container).getByRole('button', { name: 'Fokusblock starten' })); tick(60000)
  expect(read(STATISTICS_STORAGE_KEY).days['2026-10-04']).toBe(120000)
  first.unmount(); tick(60000)
  expect(read(STATISTICS_STORAGE_KEY).days['2026-10-04']).toBe(120000)
  fireEvent.click(within(second.container).getByRole('button', { name: 'Fokusblock starten' })); tick(60000)
  expect(read(STATISTICS_STORAGE_KEY).days['2026-10-04']).toBe(180000)
})
it('failed journal write pauses before granting any reward', () => {
  render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Fokusblock starten' }))
  const original = Storage.prototype.setItem
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
    if (key === STATISTICS_STORAGE_KEY) throw new Error('quota')
    original.call(this, key, value)
  })
  tick(60000)
  expect(read(GAMIFICATION_STORAGE_KEY).totalFocusMilliseconds).toBe(0)
  expect(read(STATISTICS_STORAGE_KEY).days).toEqual({})
})
it('recovers the statistics journal after a failed final write without another reward on reload', () => {
  const view = render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Fokusblock starten' }))
  const original = Storage.prototype.setItem
  let writes = 0
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
    if (key === STATISTICS_STORAGE_KEY && ++writes === 2) throw new Error('interrupted')
    original.call(this, key, value)
  })
  tick(60000)
  expect(read(GAMIFICATION_STORAGE_KEY).coins).toBe(1)
  expect(read(STATISTICS_STORAGE_KEY).pending).toBeTruthy()
  spy.mockRestore(); view.unmount(); render(<App />); tick(3600000)
  expect(read(STATISTICS_STORAGE_KEY).days['2026-10-04']).toBe(60000)
  expect(read(STATISTICS_STORAGE_KEY).pending).toBeUndefined()
  expect(read(GAMIFICATION_STORAGE_KEY).coins).toBe(1)
})
it('restores optional goals after reload without backdating existing focus', () => {
  const view = render(<App />)
  fireEvent.click(screen.getByText('Dein Lernfortschritt'))
  fireEvent.click(screen.getByLabelText('Tagesziel aktivieren'))
  fireEvent.click(screen.getByRole('button', { name: 'Ziele speichern' }))
  view.unmount(); render(<App />)
  fireEvent.click(screen.getByText('Dein Lernfortschritt'))
  expect((screen.getByLabelText('Tagesziel in Minuten') as HTMLInputElement).value).toBe('60')
  expect(read(STATISTICS_STORAGE_KEY).days).toEqual({})
})
