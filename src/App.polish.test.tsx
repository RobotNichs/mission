// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import App from './App'
import { initialGamificationState } from './types/gamification'
import { GAMIFICATION_STORAGE_KEY } from './services/gamification'
import { createTestLocks } from './services/testLocks'
beforeEach(() => {
  localStorage.clear()
  Object.defineProperty(navigator, 'locks', { configurable: true, value: createTestLocks() })
  localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify({ ...initialGamificationState, coins: 42 }))
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })
it('öffnet Sammlung per Tastatur mit Icon und bewahrt Guthaben und Kistenpreis', async () => {
  render(<App />)
  const buy = screen.getByRole('button', { name: 'Kiste kaufen · 30 Coins' })
  expect(buy.querySelector('.icon-coin')).toBeTruthy()
  expect(buy.textContent).toContain('30')
  const collection = screen.getByRole('button', { name: 'Sammlung' })
  expect(collection.querySelector('.icon-collection')).toBeTruthy()
  const before = localStorage.getItem(GAMIFICATION_STORAGE_KEY)
  collection.focus()
  const user = userEvent.setup()
  await user.keyboard('{Enter}')
  expect(screen.getByRole('dialog', { name: 'Deine Orb-Sammlung' })).toBeTruthy()
  await user.keyboard('{Escape}')
  expect(document.activeElement).toBe(collection)
  expect(localStorage.getItem(GAMIFICATION_STORAGE_KEY)).toBe(before)
})
it('verlässt mit zugänglichem X nur die Fokusansicht und behält die aktive Session', () => {
  vi.spyOn(performance, 'now').mockReturnValue(0)
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: /Start/ }))
  const saved = () => JSON.parse(localStorage.getItem('mission.saved-mission.v1')!)
  const sessionId = saved().activeSession.id
  const exit = screen.getByRole('button', { name: 'Fokusmodus verlassen' })
  expect(exit.querySelector('.icon-close')).toBeTruthy()
  expect(exit.textContent).toBe('')
  expect(exit.getAttribute('title')).toBe('Fokusmodus verlassen')
  fireEvent.click(exit)
  expect(screen.queryByRole('main', { name: 'Fokusmodus' })).toBeNull()
  expect(saved().activeSession.id).toBe(sessionId)
  expect(saved().remainingSeconds).toBe(1500)
  expect(saved().history).toEqual([])
  expect(document.activeElement).toBe(screen.getByRole('button', { name: /Start/ }))
})
it('enthält responsive Container- und Touch-Regeln für 360, 390, 768 und 1280 px', async () => {
  const { readFileSync } = await import(/* @vite-ignore */ 'node:' + 'fs')
  const css: string = readFileSync('src/index.css', 'utf8')
  // jsdom has no layout engine: check CSS contracts rather than claim pixel measurements.
  expect(css).toContain('.app-shell { width: min(1240px, calc(100% - 48px))')
  expect(css).toContain('.app-shell { width: calc(100% - 24px); }')
  expect(css).toMatch(/@media \(max-width: 520px\)[\s\S]*\.mission-core-panel\.gamification-panel \{ grid-template-columns: minmax\(0, 1fr\)/)
  expect(css).toMatch(/@media \(max-width: 900px\)[\s\S]*\.mission-support \{ grid-template-columns: minmax\(0, 1fr\)/)
  expect(css).toContain('button:not(.orb-card):not(.energy-option) { min-height: 44px; }')
  expect(css).toContain('button:not(:disabled):active')
  expect(css).toContain('button:focus-visible, summary:focus-visible')
})
