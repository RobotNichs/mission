import { within } from './services/testNavigation'
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createTestLocks } from './services/testLocks'
import { GAMIFICATION_STORAGE_KEY } from './services/gamification'

let now = 0
const missionKey = 'mission.saved-mission.v1'
const saved = () => JSON.parse(localStorage.getItem(missionKey)!)
const game = () => JSON.parse(localStorage.getItem(GAMIFICATION_STORAGE_KEY)!)
function seed(mode = 'manual') {
  const mission = { id: 'preserved-id', goal: 'Statistik', timeBudgetMinutes: 25, energyLevel: 'medium', learningBlocker: null, timeMode: mode,
    steps: [{ id: 'one', title: 'Beispiel öffnen', description: 'Statistik-Beispiel ansehen.', minutes: 10, kind: 'learning', done: true },
      { id: 'two', title: 'Ersten Schritt üben', description: 'Einen Rechenschritt versuchen.', minutes: 15, kind: 'practice', done: false }] }
  localStorage.setItem(missionKey, JSON.stringify({ form: { ...mission, steps: undefined, id: undefined, timeMode: undefined }, mission, remainingSeconds: mode === 'stopwatch' ? 0 : 1500, elapsedSeconds: 0 }))
}
function tick(ms: number) { act(() => { now += ms; vi.advanceTimersByTime(250) }) }
beforeEach(() => {
  localStorage.clear(); now = 0; vi.useFakeTimers()
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  Object.defineProperty(navigator, 'locks', { configurable: true, value: createTestLocks() })
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

describe('eigene Pläne und flexible Lernzeit', () => {
  it('priorisiert Mission und Timer und verwirft Änderungen beim Schließen des Editors', () => {
    seed()
    const ui = within(render(<App />).container)
    const timer = ui.getByRole('region', { name: 'Lern-Timer' })
    const crates = ui.getByRole('region', { name: 'Orb-Kiste' })
    expect(timer.compareDocumentPosition(crates) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const before = localStorage.getItem(missionKey)
    fireEvent.click(ui.getByRole('button', { name: 'Lernplan bearbeiten' }))
    expect(ui.queryByRole('progressbar', { name: 'Lernfortschritt' })).toBeNull()
    fireEvent.click(ui.getByRole('button', { name: /Schritt 1 bearbeiten:/ }))
    fireEvent.change(ui.getByLabelText('Titel'), { target: { value: 'Nicht speichern' } })
    fireEvent.click(ui.getByRole('button', { name: 'Abbrechen' }))
    expect(ui.queryByRole('form', { name: 'Lernplan bearbeiten' })).toBeNull()
    expect(localStorage.getItem(missionKey)).toBe(before)
    expect(game().coins).toBe(0)
    fireEvent.click(ui.getByRole('button', { name: 'Lernplan bearbeiten' }))
    expect(ui.getByRole('button', { name: /Schritt 1 bearbeiten: Beispiel öffnen/ })).toBeTruthy()
  })
  it('bearbeitet einen Schritt automatisch und erhält IDs und Häkchen', () => {
    seed()
    const ui = within(render(<App />).container)
    fireEvent.click(ui.getByRole('button', { name: 'Lernplan bearbeiten' }))
    fireEvent.change(ui.getByLabelText('Zeitmodus'), { target: { value: 'automatic' } })
    fireEvent.click(ui.getByRole('button', { name: /Schritt 1 bearbeiten:/ }))
    fireEvent.change(ui.getByLabelText('Minuten'), { target: { value: '20' } })
    fireEvent.change(ui.getByLabelText('Titel'), { target: { value: 'Geänderter Titel' } })
    fireEvent.click(ui.getByRole('button', { name: 'Änderungen speichern' }))
    expect(saved().mission.id).toBe('preserved-id')
    expect(saved().mission.steps[0]).toMatchObject({ id: 'one', done: true, title: 'Geänderter Titel' })
    expect(saved().remainingSeconds).toBe(2100)
    expect(saved().mission.timeBudgetMinutes).toBe(35)
    expect(game().coins).toBe(0)
  })

  it('speichert manuell 90 Minuten ohne die Schritte zu überschreiben und lädt pausiert', () => {
    seed()
    const first = render(<App />); const ui = within(first.container)
    fireEvent.click(ui.getByRole('button', { name: 'Lernplan bearbeiten' }))
    fireEvent.change(ui.getByLabelText('Gesamtdauer in Minuten'), { target: { value: '90' } })
    expect(ui.getByText(/Gesamtdauer und Schrittsumme/)).toBeTruthy()
    fireEvent.click(ui.getByRole('button', { name: 'Änderungen speichern' }))
    expect(saved().mission.steps.map((s: { minutes: number }) => s.minutes)).toEqual([10, 15])
    first.unmount()
    const next = within(render(<App />).container)
    expect(next.getByLabelText('Verbleibende Zeit: 90:00')).toBeTruthy()
    expect(next.getByRole('button', { name: /Start/ })).toBeTruthy()
  })

  it('ordnet, ergänzt und löscht Schritte ohne Coins zu vergeben', () => {
    seed(); const ui = within(render(<App />).container)
    fireEvent.click(ui.getByRole('button', { name: 'Lernplan bearbeiten' }))
    fireEvent.click(ui.getByRole('button', { name: 'Schritt 2 nach oben' }))
    fireEvent.click(ui.getByRole('button', { name: 'Schritt 1 löschen' }))
    fireEvent.click(ui.getByRole('button', { name: 'Schritt hinzufügen' }))
    fireEvent.change(ui.getByLabelText('Titel'), { target: { value: 'Neuer Schritt' } })
    fireEvent.change(ui.getByLabelText('Beschreibung'), { target: { value: 'Eine Zahl notieren.' } })
    fireEvent.click(ui.getByRole('button', { name: 'Änderungen speichern' }))
    expect(saved().mission.steps[0]).toMatchObject({ id: 'one', done: true })
    expect(saved().mission.steps[1].title).toBe('Neuer Schritt')
    expect(game().coins).toBe(0)
  })

  it('erstellt einen vollständigen eigenen Plan ohne API-Aufruf', () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    const ui = within(render(<App />).container)
    fireEvent.change(ui.getByLabelText('Was möchtest du lernen?'), { target: { value: 'Eigener Plan' } })
    fireEvent.click(ui.getByRole('button', { name: 'Eigenen Plan erstellen' }))
    fireEvent.change(ui.getByLabelText('Titel'), { target: { value: 'Unterlagen öffnen' } })
    fireEvent.change(ui.getByLabelText('Beschreibung'), { target: { value: 'Eine vorhandene Aufgabe ansehen.' } })
    fireEvent.click(ui.getByRole('button', { name: 'Änderungen speichern' }))
    expect(saved().mission.timeMode).toBe('automatic')
    expect(saved().remainingSeconds).toBe(300)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('vergütet Stoppuhrzeit, pausiert bei Verlassen und lädt ohne geschlossene Zeit', () => {
    seed('stopwatch'); const first = render(<App />); const ui = within(first.container)
    fireEvent.click(ui.getByRole('button', { name: /Start/ }))
    tick(90_000)
    expect(ui.getByLabelText('Vergangene Zeit: 01:30')).toBeTruthy()
    expect(game().coins).toBe(1)
    fireEvent.click(ui.getByRole('button', { name: 'Fokusmodus verlassen' }))
    tick(900_000)
    expect(game().totalFocusMilliseconds).toBe(90_000)
    first.unmount(); now += 3_600_000
    const second = render(<App />); const next = within(second.container)
    expect(next.getByLabelText('Vergangene Zeit: 01:30')).toBeTruthy()
    fireEvent.click(next.getByRole('button', { name: /Fortsetzen/ }))
    tick(30_000)
    expect(game().coins).toBe(2)
    expect(game().totalFocusMilliseconds).toBe(120_000)
  })

  it('verlangt Bestätigung und erhält Fokuszeit bei laufender Bearbeitung', () => {
    seed(); const ui = within(render(<App />).container)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.click(ui.getByRole('button', { name: /Start/ })); tick(60_000)
    fireEvent.click(ui.getByRole('button', { name: 'Lernplan bearbeiten' }))
    fireEvent.change(ui.getByLabelText('Gesamtdauer in Minuten'), { target: { value: '90' } })
    fireEvent.click(ui.getByRole('button', { name: 'Änderungen speichern' }))
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(saved().mission.timeBudgetMinutes).toBe(25)
    expect(game().coins).toBe(1)
    confirm.mockReturnValue(true)
    fireEvent.click(ui.getByRole('button', { name: 'Änderungen speichern' }))
    expect(saved().remainingSeconds).toBe(5340)
    expect(game().totalFocusMilliseconds).toBe(60_000)
    tick(60_000)
    expect(game().coins).toBe(1)
    for (let i = 0; i < 3; i++) {
      fireEvent.click(ui.getByRole('button', { name: 'Lernplan bearbeiten' }))
      fireEvent.click(ui.getByRole('button', { name: 'Änderungen speichern' }))
    }
    expect(game().coins).toBe(1)
  })

  it('erhält bisherige Restzeit bei Migration ohne neue Felder', () => {
    seed(); const legacy = saved(); delete legacy.elapsedSeconds; delete legacy.mission.timeMode
    legacy.remainingSeconds = 900
    localStorage.setItem(missionKey, JSON.stringify(legacy))
    const ui = within(render(<App />).container)
    expect(ui.getByLabelText('Verbleibende Zeit: 15:00')).toBeTruthy()
    expect(saved().mission.id).toBe('preserved-id')
    expect(game().coins).toBe(0)
  })

  it('zeigt und speichert das begrenzte Sonstiges-Feld', () => {
    const ui = within(render(<App />).container)
    fireEvent.change(ui.getByLabelText('Was hindert dich gerade am Lernen?'), { target: { value: 'other' } })
    const field = ui.getByLabelText('Was erschwert dir das Lernen?')
    expect(field.getAttribute('maxlength')).toBe('240')
    fireEvent.change(field, { target: { value: 'Meine Unterlagen sind unsortiert.' } })
    expect(saved().form.learningBlockerDetails).toBe('Meine Unterlagen sind unsortiert.')
  })

  it('vergütet nur einen Stoppuhr-Tab und übergibt pausiert', () => {
    seed('stopwatch')
    const first = render(<App />); const second = render(<App />)
    const a = within(first.container); const b = within(second.container)
    fireEvent.click(a.getByRole('button', { name: /Start/ }))
    fireEvent.click(b.getByRole('button', { name: /Start/ }))
    tick(60_000)
    expect(game().coins).toBe(1)
    first.unmount()
    expect(b.getByLabelText('Vergangene Zeit: 01:00')).toBeTruthy()
    tick(60_000)
    expect(game().coins).toBe(1)
    fireEvent.click(b.getByRole('button', { name: /Fortsetzen/ }))
    tick(60_000)
    expect(game().coins).toBe(2)
  })

  it('erhält Teilminuten bei Stoppuhr-Reset und beim Wechsel zum Countdown', () => {
    seed('stopwatch'); const ui = within(render(<App />).container)
    fireEvent.click(ui.getByRole('button', { name: /Start/ })); tick(30_500)
    fireEvent.click(ui.getByRole('button', { name: 'Timer zurücksetzen' }))
    expect(game().totalFocusMilliseconds).toBe(30_500)
    fireEvent.click(ui.getByRole('button', { name: 'Fokusmodus verlassen' }))
    fireEvent.click(ui.getByRole('button', { name: 'Lernplan bearbeiten' }))
    fireEvent.change(ui.getByLabelText('Zeitmodus'), { target: { value: 'automatic' } })
    fireEvent.click(ui.getByRole('button', { name: 'Änderungen speichern' }))
    expect(saved().remainingSeconds).toBe(1500)
    fireEvent.click(ui.getByRole('button', { name: /Start/ })); tick(29_500)
    expect(game().coins).toBe(1)
    expect(game().totalFocusMilliseconds).toBe(60_000)
  })
})
