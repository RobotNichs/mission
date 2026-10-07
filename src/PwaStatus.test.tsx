// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import PwaStatus, { usePwaStatus } from './components/PwaStatus'
import { initializePwa } from './services/pwa'
import App from './App'
import { createTestLocks } from './services/testLocks'
import { GAMIFICATION_STORAGE_KEY } from './services/gamification'
function Status() { return <PwaStatus status={usePwaStatus()} /> }
beforeEach(() => {
  localStorage.clear()
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  vi.stubGlobal('isSecureContext', true)
})
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers()
  delete (navigator as unknown as { serviceWorker?: unknown }).serviceWorker
})
function serviceWorker(value: unknown) { Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value }) }
it('shows a quiet offline status and removes it on reconnect', () => {
  render(<Status />)
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
  act(() => window.dispatchEvent(new Event('offline')))
  expect(screen.getByText('Offline · lokale Funktionen verfügbar')).toBeTruthy()
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  act(() => window.dispatchEvent(new Event('online')))
  expect(screen.queryByText('Offline · lokale Funktionen verfügbar')).toBeNull()
})
it('does not offer fake installation when the browser has no prompt', () => {
  render(<Status />)
  expect(screen.queryByRole('button', { name: 'App installieren' })).toBeNull()
  expect(screen.queryByRole('dialog')).toBeNull()
})
it('opens the native install prompt only after a deliberate click and only once', async () => {
  render(<Status />)
  const prompt = vi.fn(async () => {}), event = new Event('beforeinstallprompt', { cancelable: true })
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: 'dismissed' }) })
  act(() => window.dispatchEvent(event))
  expect(event.defaultPrevented).toBe(true); expect(prompt).not.toHaveBeenCalled()
  const button = screen.getByRole('button', { name: 'App installieren' })
  await act(async () => { fireEvent.click(button); fireEvent.click(button) })
  expect(prompt).toHaveBeenCalledOnce(); expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.queryByRole('button', { name: 'App installieren' })).toBeNull()
})
it('removes the install action after native installation', () => {
  render(<Status />)
  const event = new Event('beforeinstallprompt', { cancelable: true })
  Object.assign(event, { prompt: vi.fn(async () => {}), userChoice: Promise.resolve({ outcome: 'accepted' }) })
  act(() => window.dispatchEvent(event)); act(() => window.dispatchEvent(new Event('appinstalled')))
  expect(screen.queryByRole('button', { name: 'App installieren' })).toBeNull()
})
it('ignores install prompts while already standalone', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  render(<Status />)
  const event = new Event('beforeinstallprompt', { cancelable: true })
  Object.assign(event, { prompt: vi.fn(), userChoice: Promise.resolve({ outcome: 'accepted' }) })
  act(() => window.dispatchEvent(event))
  expect(screen.queryByRole('button', { name: 'App installieren' })).toBeNull()
})
it('registers the production worker using a fresh script check', async () => {
  const register = vi.fn(async () => ({ addEventListener: vi.fn(), waiting: null }))
  serviceWorker({ register }); await initializePwa(true)
  expect(register).toHaveBeenCalledExactlyOnceWith('/sw.js', { scope: '/', updateViaCache: 'none' })
})
it('skips registration on unsupported browsers or insecure origins', async () => {
  await expect(initializePwa(true)).resolves.toBeUndefined()
  const register = vi.fn(); serviceWorker({ register }); vi.stubGlobal('isSecureContext', false)
  await initializePwa(true); expect(register).not.toHaveBeenCalled()
})
it('cleans only Mission workers and caches in development, never local data', async () => {
  const own = vi.fn(async () => true), other = vi.fn(async () => true), register = vi.fn(), remove = vi.fn(async () => true)
  serviceWorker({ register, getRegistrations: async () => [
    { active: { scriptURL: `${location.origin}/sw.js` }, unregister: own },
    { active: { scriptURL: `${location.origin}/unrelated-sw.js` }, unregister: other },
  ] })
  vi.stubGlobal('caches', { keys: async () => ['mission-app-shell-old', 'other-app'], delete: remove })
  localStorage.setItem('mission.gamification.v1', '{"coins":99}')
  const write = vi.spyOn(Storage.prototype, 'setItem'), clear = vi.spyOn(Storage.prototype, 'clear')
  await initializePwa(false)
  expect(own).toHaveBeenCalledOnce(); expect(other).not.toHaveBeenCalled(); expect(register).not.toHaveBeenCalled()
  expect(remove).toHaveBeenCalledExactlyOnceWith('mission-app-shell-old')
  expect(write).not.toHaveBeenCalled(); expect(clear).not.toHaveBeenCalled()
  expect(localStorage.getItem('mission.gamification.v1')).toBe('{"coins":99}')
})
it('keeps normal operation if worker registration fails', async () => {
  serviceWorker({ register: vi.fn(async () => { throw new Error('not allowed') }) })
  await expect(initializePwa(true)).resolves.toBeUndefined()
})
it('restores a mobile mission offline with a paused timer and no closed-app reward', () => {
  vi.useFakeTimers(); let now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(max-width: 768px)', addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  Object.defineProperty(navigator, 'locks', { configurable: true, value: createTestLocks() })
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
  const key = 'mission.saved-mission.v1'
  localStorage.setItem(key, JSON.stringify({ form: { goal: 'SQL', timeBudgetMinutes: 20, energyLevel: 'medium', learningBlocker: null },
    mission: { id: 'mission', goal: 'SQL', timeBudgetMinutes: 20, energyLevel: 'medium', learningBlocker: null,
      steps: [{ id: 'step', title: 'SQL versuchen', description: 'Eine Abfrage', minutes: 20, kind: 'practice', done: false }] }, remainingSeconds: 1200 }))
  const view = render(<App />)
  expect(screen.getByRole('navigation')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Fokusmodus öffnen' }))
  expect(screen.queryByRole('navigation')).toBeNull()
  expect(screen.getByText('Offline · lokale Funktionen verfügbar')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Fortsetzen' }))
  act(() => { now += 60000; vi.advanceTimersByTime(250) })
  view.unmount(); const game = localStorage.getItem(GAMIFICATION_STORAGE_KEY)
  now += 3600000; render(<App />); act(() => vi.advanceTimersByTime(250))
  expect(localStorage.getItem(GAMIFICATION_STORAGE_KEY)).toBe(game)
  expect(screen.getByRole('navigation')).toBeTruthy()
  expect(JSON.parse(localStorage.getItem(key)!).remainingSeconds).toBe(1140)
})
it('reports a waiting update without reloading or touching an active session', async () => {
  render(<Status />)
  const waiting = { postMessage: vi.fn() }, reload = vi.fn()
  window.addEventListener('controllerchange', reload)
  serviceWorker({ register: vi.fn(async () => ({ waiting, addEventListener: vi.fn() })) })
  const clear = vi.spyOn(Storage.prototype, 'clear'), write = vi.spyOn(Storage.prototype, 'setItem')
  await act(async () => { await initializePwa(true) })
  expect(screen.getByText('Neue Version verfügbar · beim nächsten Start')).toBeTruthy()
  expect(waiting.postMessage).not.toHaveBeenCalled(); expect(reload).not.toHaveBeenCalled()
  expect(write).not.toHaveBeenCalled(); expect(clear).not.toHaveBeenCalled()
  window.removeEventListener('controllerchange', reload)
})
