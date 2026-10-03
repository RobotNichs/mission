// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import App from './App'
import { createTestLocks } from './services/testLocks'
import { GAMIFICATION_STORAGE_KEY } from './services/gamification'
import { initialGamificationState } from './types/gamification'

beforeEach(() => {
  localStorage.clear()
  Object.defineProperty(navigator, 'locks', { configurable: true, value: createTestLocks() })
  localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify({ ...initialGamificationState, coins: 42, ownedOrbIds: ['orb-common'], totalFocusMilliseconds: 1800000 }))
})
afterEach(cleanup)

it('öffnet alle 40 Orbs und Standard direkt beim Kistenbereich ohne Spielwerte zu ändern', () => {
  render(<App />)
  expect(screen.queryByRole('button', { name: 'Ausrüsten: Morgenlicht' })).toBeNull()
  const trigger = screen.getByRole('button', { name: 'Sammlung' })
  expect(trigger.closest('.crate-shop')).toBeTruthy()
  const before = localStorage.getItem(GAMIFICATION_STORAGE_KEY)
  trigger.focus(); fireEvent.click(trigger)
  const dialog = screen.getByRole('dialog', { name: 'Deine Orb-Sammlung' })
  expect(screen.getAllByRole('heading', { name: 'Deine Orb-Sammlung' })).toHaveLength(1)
  expect(dialog.querySelector('.collection-dialog-header')?.contains(screen.getByRole('button', { name: 'Sammlung schließen' }))).toBe(true)
  expect(dialog.querySelector('.collection-dialog-scroll')?.contains(dialog.querySelector('.orb-collection'))).toBe(true)
  expect(dialog.querySelectorAll('.orb-card')).toHaveLength(41)
  expect(screen.getAllByRole('button', { name: /Gesperrt:/ }).every(button => (button as HTMLButtonElement).disabled)).toBe(true)
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Sammlung schließen' }))
  expect(localStorage.getItem(GAMIFICATION_STORAGE_KEY)).toBe(before)
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(trigger)
  expect(localStorage.getItem(GAMIFICATION_STORAGE_KEY)).toBe(before)
})

it('rüstet Besitz und kostenlosen Standard aus und erhält Fortschritt nach Reload', () => {
  const first = render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Sammlung' }))
  fireEvent.click(screen.getByRole('button', { name: 'Ausrüsten: Morgenlicht' }))
  let state = JSON.parse(localStorage.getItem(GAMIFICATION_STORAGE_KEY)!)
  expect(state.equippedOrbId).toBe('orb-common')
  expect(state.coins).toBe(42)
  expect(state.totalFocusMilliseconds).toBe(1800000)
  first.unmount(); render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Sammlung' }))
  expect(screen.getByRole('button', { name: 'Ausrüsten: Morgenlicht' }).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'Ausrüsten: Standard-Orb' }))
  state = JSON.parse(localStorage.getItem(GAMIFICATION_STORAGE_KEY)!)
  expect(state.equippedOrbId).toBeNull()
  expect(state.ownedOrbIds).toEqual(['orb-common'])
  expect(state.coins).toBe(42)
})

it('begrenzt Tastaturfokus und schließt über Button und Hintergrund', () => {
  render(<App />)
  const trigger = screen.getByRole('button', { name: 'Sammlung' })
  trigger.focus(); fireEvent.click(trigger)
  const close = screen.getByRole('button', { name: 'Sammlung schließen' })
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ausrüsten: Morgenlicht' }))
  fireEvent.keyDown(document.activeElement!, { key: 'Tab' })
  expect(document.activeElement).toBe(close)
  fireEvent.click(close)
  expect(document.activeElement).toBe(trigger)
  fireEvent.click(trigger)
  fireEvent.mouseDown(document.querySelector('.collection-backdrop')!)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(trigger)
})

it('verwendet begrenzte responsive Größen auch im Fokusmodus', () => {
  render(<App />)
  const core = document.querySelector<HTMLElement>('.mission-core')!
  expect(core.style.width).toContain('min(')
  expect(core.style.width).toContain('100%')
  fireEvent.click(screen.getByRole('button', { name: /Start/ }))
  const stage = document.querySelector<HTMLElement>('.focus-orb-stage')!
  expect(stage.style.width).toContain('78vw')
  expect(stage.style.width).toContain('100%')
  expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy()
  expect(screen.getByLabelText('Verbleibende Zeit: 25:00')).toBeTruthy()
})
