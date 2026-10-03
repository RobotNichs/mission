// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createTestLocks } from './services/testLocks'
import { GAMIFICATION_STORAGE_KEY } from './services/gamification'

let now = 0
const stored = () => JSON.parse(localStorage.getItem(GAMIFICATION_STORAGE_KEY)!)

beforeEach(() => {
  localStorage.clear()
  now = 0
  vi.useFakeTimers()
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  Object.defineProperty(navigator, 'locks', { configurable: true, value: createTestLocks() })
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

function tick(milliseconds: number) {
  act(() => { now += milliseconds; vi.advanceTimersByTime(250) })
}

describe('Fokuszeit im Timer', () => {
  it('sammelt Teilminuten über Pause und Reset ohne Pausenzeit', () => {
    const ui = within(render(<App />).container)
    fireEvent.click(ui.getByRole('button', { name: /Start/ }))
    tick(30_500)
    fireEvent.click(ui.getByRole('button', { name: /Pause/ }))
    tick(600_000)
    expect(stored().totalFocusMilliseconds).toBe(30_500)
    expect(stored().coins).toBe(0)
    fireEvent.click(ui.getByRole('button', { name: /Start/ }))
    now += 29_500 // Reset must settle the time since the last interval callback.
    fireEvent.click(ui.getByRole('button', { name: 'Timer zurücksetzen' }))
    expect(stored().totalFocusMilliseconds).toBe(60_000)
    expect(stored().coins).toBe(1)
    expect(ui.getByLabelText(/Verbleibende Zeit:/).textContent).toContain('25:00')
    tick(60_000)
    expect(stored().coins).toBe(1)
  })

  it('lädt pausiert und vergütet weder geschlossene Zeit noch dieselben Daten erneut', () => {
    const first = render(<App />)
    fireEvent.click(within(first.container).getByRole('button', { name: /Start/ }))
    tick(59_500)
    first.unmount()
    now += 3_600_000
    const second = render(<App />)
    const ui = within(second.container)
    expect(ui.getByRole('button', { name: /Start/ })).toBeTruthy()
    expect(stored().totalFocusMilliseconds).toBe(59_500)
    expect(ui.getByLabelText(/Verbleibende Zeit:/).textContent).toContain('24:01')
    tick(600_000)
    expect(stored().coins).toBe(0)
    fireEvent.click(ui.getByRole('button', { name: /Start/ }))
    tick(500)
    expect(stored().coins).toBe(1)
    second.unmount()
    render(<App />).unmount()
    expect(stored().coins).toBe(1)
  })

  it('begrenzt Hintergrundzeit auf das Timer-Ende und verhindert Doppelklick-Gutschriften', () => {
    const ui = within(render(<StrictMode><App /></StrictMode>).container)
    fireEvent.click(ui.getByRole('button', { name: /Start/ }))
    fireEvent.click(ui.getByRole('button', { name: /Pause/ }))
    expect(stored().coins).toBe(0)
    fireEvent.click(ui.getByRole('button', { name: /Start/ }))
    tick(3_600_000)
    expect(stored().coins).toBe(25)
    expect(stored().totalFocusMilliseconds).toBe(1_500_000)
    expect(ui.getByRole('button', { name: /Weiter/ })).toBeTruthy()
    tick(60_000)
    expect(stored().coins).toBe(25)
  })

  it('verhindert parallele Timer und veraltete Speicherung und übernimmt pausiert', () => {
    const first = render(<App />)
    const second = render(<App />)
    const a = within(first.container)
    const b = within(second.container)
    fireEvent.click(a.getByRole('button', { name: /Start/ }))
    expect((b.getByRole('button', { name: /Start/ }) as HTMLButtonElement).matches(':disabled')).toBe(true)
    fireEvent.click(b.getByRole('button', { name: /Start/ }))
    tick(60_000)
    expect(stored().coins).toBe(1)
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: GAMIFICATION_STORAGE_KEY })) })
    expect(b.getByLabelText('1 Coins')).toBeTruthy()
    first.unmount()
    expect(b.getByRole('button', { name: /Start/ }).matches(':disabled')).toBe(false)
    tick(60_000)
    expect(stored().coins).toBe(1)
    fireEvent.click(b.getByRole('button', { name: /Start/ }))
    tick(60_000)
    expect(stored().coins).toBe(2)
  })

  it('sperrt Gutschriften sicher, wenn Web Locks fehlen', () => {
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined })
    const ui = within(render(<App />).container)
    expect(ui.getByRole('status').textContent).toContain('sichere Tab-Sperre')
    fireEvent.click(ui.getByRole('button', { name: /Start/ }))
    tick(60_000)
    expect(localStorage.getItem(GAMIFICATION_STORAGE_KEY)).toBeNull()
  })

  it('rechnet bei Missionswechsel den letzten Zeitabschnitt ab und erhält die Sammlung', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    const ui = within(render(<App />).container)
    fireEvent.change(ui.getByRole('textbox', { name: 'Was möchtest du lernen?' }), { target: { value: 'SQL lernen' } })
    await act(async () => { fireEvent.click(ui.getByRole('button', { name: /Mission planen/ })) })
    const oldId = JSON.parse(localStorage.getItem('mission.saved-mission.v1')!).mission.id
    fireEvent.click(ui.getByRole('button', { name: /Start/ }))
    tick(59_500)
    now += 500
    fireEvent.change(ui.getByRole('textbox', { name: 'Was möchtest du lernen?' }), { target: { value: 'Python lernen' } })
    await act(async () => { fireEvent.click(ui.getByRole('button', { name: /Mission aktualisieren/ })) })
    expect(stored().totalFocusMilliseconds).toBe(60_000)
    expect(stored().coins).toBe(1)
    expect(JSON.parse(localStorage.getItem('mission.saved-mission.v1')!).mission.id).not.toBe(oldId)
    expect(ui.getByRole('button', { name: /Start/ })).toBeTruthy()
    tick(60_000)
    expect(stored().coins).toBe(1)
  })

  it('speichert beim Verlassen nur bis zum Schließen und gibt die Tab-Sperre frei', () => {
    const first = render(<App />)
    fireEvent.click(within(first.container).getByRole('button', { name: /Start/ }))
    now = 60_000
    act(() => { window.dispatchEvent(new PageTransitionEvent('pagehide')) })
    expect(stored().coins).toBe(1)
    tick(3_600_000)
    expect(stored().coins).toBe(1)
    first.unmount()
    const second = within(render(<App />).container)
    expect(second.getByRole('button', { name: /Start/ }).matches(':disabled')).toBe(false)
    expect(stored().coins).toBe(1)
  })

  it('pausiert bei Speicherfehlern ohne unbestätigte Zeit erneut gutzuschreiben', () => {
    const ui = within(render(<App />).container)
    fireEvent.click(ui.getByRole('button', { name: /Start/ }))
    tick(59_000)
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    tick(1_000)
    expect(ui.getByRole('status').textContent).toContain('Speicherung')
    expect(stored().totalFocusMilliseconds).toBe(59_000)
    write.mockRestore()
    tick(60_000)
    expect(stored().coins).toBe(0)
  })

  it('überschreibt bei fehlendem Lesezugriff keine vorhandenen Daten', () => {
    localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify({ xp: 200, coins: 40, ownedOrbIds: ['orb-rare'] }))
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    const write = vi.spyOn(Storage.prototype, 'setItem')
    const ui = within(render(<App />).container)
    expect(ui.getByRole('status').textContent).toContain('Speicherung')
    expect(write).not.toHaveBeenCalled()
    read.mockRestore()
    expect(stored().coins).toBe(40)
  })
})
