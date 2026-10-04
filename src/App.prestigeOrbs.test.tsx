// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'
import { initialGamificationState } from './types/gamification'
import { GAMIFICATION_STORAGE_KEY, getLevel } from './services/gamification'
import { getOrbSize } from './services/orbSize'
import { prestigeOrbs } from './services/prestigeOrbs'
import { createTestLocks } from './services/testLocks'
beforeEach(() => {
  localStorage.clear()
  Object.defineProperty(navigator, 'locks', { configurable: true, value: createTestLocks() })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })
it.each(prestigeOrbs)('rüstet $orb.name ohne Bonus aus und rendert denselben Orb im Fokusmodus', ({ orb, stage }) => {
  const state = { ...initialGamificationState, coins: 47, ownedOrbIds: ['orb-common'], totalFocusMilliseconds: stage.hours * 3_600_000 }
  localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify(state))
  const first = render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Sammlung' }))
  fireEvent.click(screen.getByRole('button', { name: `Ausrüsten: ${orb.name}` }))
  expect(JSON.parse(localStorage.getItem(GAMIFICATION_STORAGE_KEY)!)).toEqual({ ...state, equippedOrbId: orb.id })
  fireEvent.click(screen.getByRole('button', { name: 'Sammlung schließen' }))
  expect(document.querySelector('.core-orb-art')?.getAttribute('data-orb-id')).toBe(orb.id)
  first.unmount()
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: /Start/ }))
  expect(screen.getByRole('img', { name: orb.name }).getAttribute('data-orb-id')).toBe(orb.id)
  expect(document.querySelector<HTMLElement>('.focus-orb-stage')!.style.width).toContain('78vw')
  expect(document.querySelector<HTMLElement>('.focus-orb-stage')!.style.width).toContain('100%')
  expect(document.querySelector<HTMLElement>('.focus-orb-stage')!.style.width).toBe(`min(${getOrbSize(getLevel(state.totalFocusMilliseconds / 60000), 'focus')}px, 78vw, 100%)`)
})
it('verwendet den Prestige-Orb unverändert im FLIP-Übergang', () => {
  const orb = prestigeOrbs[4].orb
  localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify({ ...initialGamificationState,
    totalFocusMilliseconds: 1000 * 3_600_000, equippedOrbId: orb.id }))
  const animate = vi.fn(() => ({ cancel: vi.fn() }))
  Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: animate })
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return (this.classList.contains('mission-core') ? { left: 20, top: 500, width: 122, height: 122 }
      : { left: 300, top: 100, width: 420, height: 420 }) as DOMRect
  })
  try {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Start/ }))
    expect(animate).toHaveBeenCalled()
    expect(screen.getByRole('main').getAttribute('data-focus-entering')).toBe('true')
    const visual = screen.getByRole('img', { name: 'Singularity Prime' })
    expect(visual.getAttribute('data-orb-id')).toBe(orb.id)
    expect(visual.classList.contains('prestige-singularity')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Fokusmodus verlassen' }))
  } finally { delete (Element.prototype as unknown as { animate?: unknown }).animate }
})
it('behält statische Prestige-Optik bei reduzierter Bewegung und begrenzt mobile Darstellung', async () => {
  const { readFileSync } = await import(/* @vite-ignore */ 'node:' + 'fs')
  const styles: string = readFileSync('src/index.css', 'utf8')
  expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \.prestige-aura \{ animation: none !important/)
  expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.orb-art \*/)
  expect(styles).toContain('.prestige-singularity .prestige-aura')
  expect(styles).toMatch(/@media \(max-width: 520px\) \{ \.prestige-stages\.prestige-orb-path li/)
})
it('zeigt gesperrte Prestige-Orbs ohne Bonus und bewahrt den kostenlosen Standard', () => {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Sammlung' }))
  const before = localStorage.getItem(GAMIFICATION_STORAGE_KEY)
  for (const { orb } of prestigeOrbs) {
    const button = screen.getByRole('button', { name: `Gesperrt: ${orb.name}` }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
  }
  expect(localStorage.getItem(GAMIFICATION_STORAGE_KEY)).toBe(before)
  expect((screen.getByRole('button', { name: 'Ausrüsten: Standard-Orb' }) as HTMLButtonElement).disabled).toBe(false)
})
