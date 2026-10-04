// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'
import SpotlightTour from './components/SpotlightTour'
import { ONBOARDING_KEY, shouldOfferTour, tourSteps } from './services/onboarding'
import { initialGamificationState } from './types/gamification'
import { GAMIFICATION_STORAGE_KEY } from './services/gamification'
import { createTestLocks } from './services/testLocks'
beforeEach(() => {
  localStorage.clear()
  Object.defineProperty(navigator, 'locks', { configurable: true, value: createTestLocks() })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })
it('bietet Erstbesuch freiwillig an und merkt sich Jetzt nicht nach Reload', () => {
  const first = render(<App />)
  expect(screen.getByText('Mission kurz kennenlernen?')).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(JSON.parse(localStorage.getItem(ONBOARDING_KEY)!).status).toBe('offered')
  fireEvent.click(screen.getByRole('button', { name: 'Jetzt nicht' }))
  expect(JSON.parse(localStorage.getItem(ONBOARDING_KEY)!).status).toBe('skipped')
  first.unmount(); render(<App />)
  expect(screen.queryByText('Mission kurz kennenlernen?')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Mission-Tour starten' }))
  expect(screen.getByRole('dialog')).toBeTruthy()
})
it('unterbricht bestehende Fortschrittsdaten nicht und behandelt beschädigte Tour-Einstellungen sicher', () => {
  localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify({ ...initialGamificationState, coins: 45 }))
  render(<App />)
  expect(screen.queryByText('Mission kurz kennenlernen?')).toBeNull()
  localStorage.setItem(ONBOARDING_KEY, 'broken')
  expect(shouldOfferTour()).toBe(false)
})
it('navigiert durch fünf Schritte, zurück und fertig ohne Mission oder Belohnungen zu ändern', () => {
  render(<App />)
  const timerStart = screen.getByRole('button', { name: /Start/ })
  const input = screen.getByLabelText('Was möchtest du lernen?')
  const game = localStorage.getItem(GAMIFICATION_STORAGE_KEY), mission = localStorage.getItem('mission.saved-mission.v1')
  fireEvent.click(screen.getByRole('button', { name: 'Tour starten' }))
  fireEvent.click(timerStart)
  fireEvent.change(input, { target: { value: 'Nicht ändern' } })
  expect(screen.queryByRole('main', { name: 'Fokusmodus' })).toBeNull()
  expect(localStorage.getItem('mission.saved-mission.v1')).toBe(mission)
  for (let i = 0; i < tourSteps.length; i++) {
    expect(screen.getByRole('heading', { name: tourSteps[i].title })).toBeTruthy()
    expect(screen.getByText(`Schritt ${i + 1} von 5`)).toBeTruthy()
    if (i === 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Zurück' }))
      expect(screen.getByText('Schritt 1 von 5')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Weiter' }))
    }
    fireEvent.click(screen.getByRole('button', { name: i === 4 ? 'Fertig' : 'Weiter' }))
  }
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(JSON.parse(localStorage.getItem(ONBOARDING_KEY)!).status).toBe('completed')
  expect(localStorage.getItem(GAMIFICATION_STORAGE_KEY)).toBe(game)
  expect(localStorage.getItem('mission.saved-mission.v1')).toBe(mission)
})
it('begrenzt Fokus, überspringt mit Escape und kehrt zum Hilfe-Icon zurück', async () => {
  render(<App />)
  const help = screen.getByRole('button', { name: 'Mission-Tour starten' })
  help.focus(); fireEvent.click(help)
  const user = userEvent.setup()
  const first = screen.getByRole('button', { name: 'Überspringen' })
  expect(document.activeElement).toBe(first)
  await user.tab({ shift: true })
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Weiter' }))
  await user.tab()
  expect(document.activeElement).toBe(first)
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(help)
  expect(JSON.parse(localStorage.getItem(ONBOARDING_KEY)!).status).toBe('skipped')
})
it('zeigt bei fehlenden Zielen den Fallback und aktualisiert Spotlight nach Scroll und Resize', () => {
  const target = document.createElement('div')
  document.body.appendChild(target)
  let left = 30
  vi.spyOn(target, 'getBoundingClientRect').mockImplementation(() => ({ left, top: 20, width: 200, height: 100, right: left + 200, bottom: 120 }) as DOMRect)
  const targets = [{ current: target }, { current: null }]
  const close = vi.fn()
  const first = render(<SpotlightTour targets={targets} onClose={close} />)
  expect((document.querySelector('.tour-spotlight') as HTMLElement).style.left).toBe('30px')
  left = 60; fireEvent(window, new Event('scroll'))
  expect((document.querySelector('.tour-spotlight') as HTMLElement).style.left).toBe('60px')
  left = 90; fireEvent(window, new Event('resize'))
  expect((document.querySelector('.tour-spotlight') as HTMLElement).style.left).toBe('90px')
  fireEvent.click(screen.getByRole('button', { name: 'Weiter' }))
  expect(screen.getByText(/Dieser Bereich ist gerade nicht sichtbar/)).toBeTruthy()
  first.unmount(); target.remove()
})
it('beendet per Überspringen ohne eine pausierte aktive Session zu beschädigen', () => {
  vi.spyOn(performance, 'now').mockReturnValue(0)
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: /Start/ }))
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Fokusmodus verlassen' }))
  const before = localStorage.getItem('mission.saved-mission.v1')
  fireEvent.click(screen.getByRole('button', { name: 'Mission-Tour starten' }))
  fireEvent.click(screen.getByRole('button', { name: 'Überspringen' }))
  expect(localStorage.getItem('mission.saved-mission.v1')).toBe(before)
  expect(JSON.parse(localStorage.getItem(ONBOARDING_KEY)!).status).toBe('skipped')
})
it('behandelt unsichtbare Ziele und hält die Textboxposition innerhalb mobiler Grenzen', async () => {
  const target = document.createElement('div')
  const scroll = vi.fn()
  target.scrollIntoView = scroll
  target.style.visibility = 'hidden'
  document.body.appendChild(target)
  vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({ left: 300, top: 700, width: 200, height: 200, right: 500, bottom: 900 } as DOMRect)
  const width = window.innerWidth, height = window.innerHeight
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 360 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 740 })
  const first = render(<SpotlightTour targets={[{ current: target }]} onClose={vi.fn()} />)
  try {
    expect(screen.getByText(/Dieser Bereich ist gerade nicht sichtbar/)).toBeTruthy()
    const box = screen.getByRole('dialog') as HTMLElement
    expect(parseFloat(box.style.left)).toBeGreaterThanOrEqual(16)
    expect(parseFloat(box.style.left)).toBeLessThanOrEqual(16)
    expect(parseFloat(box.style.top)).toBeLessThan(740 - 16)
    // Scrolling is instant even with reduced motion; no smooth automatic movement.
    expect(scroll).toHaveBeenCalledWith({ block: 'center', behavior: 'instant' })
    const { readFileSync } = await import(/* @vite-ignore */ 'node:' + 'fs')
    const css: string = readFileSync('src/index.css', 'utf8')
    expect(css).toMatch(/\.tour-dialog \{[^}]*width: min\(340px, calc\(100vw - 32px\)\)[^}]*max-height: calc\(100svh - 32px\)[^}]*overflow-y: auto/)
    expect(css).toMatch(/\.tour-overlay \{[^}]*pointer-events: auto/)
  } finally {
    first.unmount(); target.remove()
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
  }
})
