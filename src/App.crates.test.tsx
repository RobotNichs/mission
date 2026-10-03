// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { initialGamificationState } from './types/gamification'
import { GAMIFICATION_STORAGE_KEY } from './services/gamification'
import { createTestLocks } from './services/testLocks'

const saved = () => JSON.parse(localStorage.getItem(GAMIFICATION_STORAGE_KEY)!)
beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify({ ...initialGamificationState, coins: 60 }))
  Object.defineProperty(navigator, 'locks', { configurable: true, value: createTestLocks() })
  vi.spyOn(Math, 'random').mockReturnValue(0)
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })

describe('Kisten und Sammlung in der App', () => {
  it('bestätigt vor dem Abzug, schützt vor Doppelbestätigung und speichert vor der Animation', () => {
    const first = render(<App />)
    const ui = within(first.container)
    fireEvent.click(ui.getByRole('button', { name: 'Kiste kaufen · 30 Coins' }))
    const confirm = ui.getByRole('button', { name: 'Für 30 Coins kaufen und öffnen' })
    expect(saved().coins).toBe(60)
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    expect(saved().coins).toBe(30)
    expect(saved().completedCratePurchaseIds).toHaveLength(1)
    expect(saved().ownedOrbIds).toEqual(['orb-common'])
    expect(ui.getByRole('button', { name: 'Animation überspringen' })).toBeTruthy()
    first.unmount()
    const reloaded = within(render(<App />).container)
    expect(saved().coins).toBe(30)
    expect(reloaded.queryByRole('dialog')).toBeNull()
    fireEvent.click(reloaded.getByRole('button', { name: 'Sammlung' }))
    fireEvent.click(within(document.body).getByRole('button', { name: 'Ausrüsten: Morgenlicht' }))
    expect(document.querySelector('.mission-core .orb-art')?.getAttribute('data-orb-id')).toBe('orb-common')
    fireEvent.click(within(document.body).getByRole('button', { name: 'Ausrüsten: Standard-Orb' }))
    expect(saved().equippedOrbId).toBeNull()
    expect(document.querySelector('.mission-core .orb-art')?.getAttribute('data-orb-id')).toBe('orb-default')
    cleanup()
    render(<App />)
    expect(saved().equippedOrbId).toBeNull()
  })

  it('zeigt Duplikate ohne Bonus und sperrt Käufe nach Verbrauch der Coins', () => {
    const ui = within(render(<App />).container)
    for (let index = 0; index < 2; index++) {
      fireEvent.click(ui.getByRole('button', { name: 'Kiste kaufen · 30 Coins' }))
      fireEvent.click(ui.getByRole('button', { name: 'Für 30 Coins kaufen und öffnen' }))
      fireEvent.click(ui.getByRole('button', { name: 'Animation überspringen' }))
      expect(ui.getByRole('dialog', { name: 'Morgenlicht' }).textContent).toContain(index === 0 ? 'Neu freigeschaltet' : 'Bereits in deiner Sammlung')
      fireEvent.click(ui.getByRole('button', { name: 'Schließen' }))
    }
    expect(saved().coins).toBe(0)
    expect(saved().ownedOrbIds).toEqual(['orb-common'])
    expect(saved().completedCratePurchaseIds).toHaveLength(2)
    expect(ui.getByRole('button', { name: 'Kiste kaufen · 30 Coins' }).matches(':disabled')).toBe(true)
  })

  it('erlaubt Abbrechen, Escape und fokussiert nach dem Dialog den Auslöser', () => {
    const ui = within(render(<App />).container)
    const trigger = ui.getByRole('button', { name: 'Kiste kaufen · 30 Coins' })
    fireEvent.click(trigger)
    const cancel = ui.getByRole('button', { name: 'Abbrechen' })
    expect(document.activeElement).toBe(cancel)
    fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(ui.getByRole('button', { name: 'Für 30 Coins kaufen und öffnen' }))
    fireEvent.keyDown(ui.getByRole('alertdialog'), { key: 'Escape' })
    expect(saved().coins).toBe(60)
    expect(saved().ownedOrbIds).toEqual([])
    expect(document.activeElement).toBe(trigger)
  })

  it('beendet die Öffnungsanimation automatisch ohne weitere Transaktion', () => {
    vi.useFakeTimers()
    const ui = within(render(<App />).container)
    fireEvent.click(ui.getByRole('button', { name: 'Kiste kaufen · 30 Coins' }))
    fireEvent.click(ui.getByRole('button', { name: 'Für 30 Coins kaufen und öffnen' }))
    act(() => { vi.advanceTimersByTime(900) })
    expect(ui.getByRole('dialog', { name: 'Morgenlicht' })).toBeTruthy()
    expect(ui.queryByRole('button', { name: 'Animation überspringen' })).toBeNull()
    expect(saved().coins).toBe(30)
  })

  it('zeigt bei reduzierter Bewegung sofort das Ergebnis und deaktiviert Orb-Animationen per CSS', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    vi.spyOn(Math, 'random').mockReturnValueOnce(.99).mockReturnValueOnce(0)
    const ui = within(render(<App />).container)
    fireEvent.click(ui.getByRole('button', { name: 'Kiste kaufen · 30 Coins' }))
    fireEvent.click(ui.getByRole('button', { name: 'Für 30 Coins kaufen und öffnen' }))
    expect(ui.getByRole('dialog', { name: 'Sternenstaub' })).toBeTruthy()
    expect(ui.queryByRole('button', { name: 'Animation überspringen' })).toBeNull()
    // Dynamic import keeps this test independent of optional Node type packages.
    const { readFileSync } = await import(/* @vite-ignore */ 'node:' + 'fs')
    const styles: string = readFileSync('src/index.css', 'utf8')
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.orb-art[^}]*animation: none !important/)
  })

  it('lässt andere Tabs keine Kiste kaufen oder neue Daten überschreiben', () => {
    const first = render(<App />)
    const second = render(<App />)
    const a = within(first.container), b = within(second.container)
    const inactiveBuy = b.getByRole('button', { name: 'Kiste kaufen · 30 Coins' })
    expect(inactiveBuy.matches(':disabled')).toBe(true)
    fireEvent.click(inactiveBuy)
    expect(b.queryByRole('alertdialog')).toBeNull()
    fireEvent.click(a.getByRole('button', { name: 'Kiste kaufen · 30 Coins' }))
    fireEvent.click(a.getByRole('button', { name: 'Für 30 Coins kaufen und öffnen' }))
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: GAMIFICATION_STORAGE_KEY })) })
    expect(saved().coins).toBe(30)
    first.unmount()
    expect(inactiveBuy.matches(':disabled')).toBe(false)
    expect(saved().completedCratePurchaseIds).toHaveLength(1)
    fireEvent.click(inactiveBuy)
    fireEvent.click(b.getByRole('button', { name: 'Für 30 Coins kaufen und öffnen' }))
    expect(saved().coins).toBe(0)
    expect(saved().completedCratePurchaseIds).toHaveLength(2)
  })
})
