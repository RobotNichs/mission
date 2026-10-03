// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import GamificationDebug from './components/GamificationDebug'
import { createTestLocks } from './services/testLocks'
import { GAMIFICATION_STORAGE_KEY } from './services/gamification'
import { initialGamificationState } from './types/gamification'
import { getOrbSize } from './services/orbSize'

const saved = () => JSON.parse(localStorage.getItem(GAMIFICATION_STORAGE_KEY)!)
beforeEach(() => {
  localStorage.clear()
  Object.defineProperty(navigator, 'locks', { configurable: true, value: createTestLocks() })
  vi.stubEnv('DEV', true)
})
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('Entwicklungsbereich für Gamification', () => {
  it('zeigt Level 1 bis 100 rein visuell, nutzt Orb-Größe und schreibt keine Fortschrittsdaten', () => {
    const state = { ...initialGamificationState, coins: 45, totalFocusMilliseconds: 1800000, ownedOrbIds: ['orb-rare'], equippedOrbId: 'orb-rare' }
    const original = JSON.stringify(state)
    localStorage.setItem(GAMIFICATION_STORAGE_KEY, original)
    localStorage.setItem('mission.saved-mission.v1', '{"unchanged":true}')
    const onChange = vi.fn()
    const write = vi.spyOn(Storage.prototype, 'setItem')
    const first = render(<GamificationDebug state={state} enabled onChange={onChange} />)
    fireEvent.click(screen.getByText('Lokaler Gamification-Testmodus'))
    const slider = screen.getByRole('slider')
    expect(slider.getAttribute('min')).toBe('1')
    expect(slider.getAttribute('max')).toBe('100')
    for (const level of [1, 2, 10, 100]) {
      fireEvent.change(slider, { target: { value: String(level) } })
      const orb = screen.getByRole('img', { name: `Orb-Vorschau, Level ${level}` })
      expect((orb as HTMLElement).style.width).toBe(`min(${getOrbSize(level, 'focus')}px, 100%)`)
      expect(orb.getAttribute('data-orb-id')).toBe('orb-rare')
    }
    fireEvent.click(screen.getByRole('button', { name: 'Level-Vorschau zurücksetzen' }))
    expect(screen.getByRole('img', { name: 'Orb-Vorschau, Level 1' })).toBeTruthy()
    expect(JSON.stringify(state)).toBe(original)
    expect(localStorage.getItem(GAMIFICATION_STORAGE_KEY)).toBe(original)
    expect(localStorage.getItem('mission.saved-mission.v1')).toBe('{"unchanged":true}')
    expect(onChange).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
    fireEvent.change(slider, { target: { value: '100' } })
    first.unmount()
    render(<GamificationDebug state={state} enabled onChange={onChange} />)
    expect(screen.getByRole('img', { name: 'Orb-Vorschau, Level 1' })).toBeTruthy()
  })
  it('speichert Testwerte ohne Fokuszeit oder Änderungen an bestehendem Plan und Timer', async () => {
    localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify({ ...initialGamificationState, coins: 20, totalFocusMilliseconds: 60_000, ownedOrbIds: ['orb-rare'], equippedOrbId: 'orb-rare' }))
    const first = render(<App />)
    await screen.findByText('Lokaler Gamification-Testmodus')
    const timerBefore = screen.getByLabelText(/Verbleibende Zeit:/).textContent
    const missionBefore = localStorage.getItem('mission.saved-mission.v1')
    fireEvent.click(screen.getByText('Lokaler Gamification-Testmodus'))
    fireEvent.click(screen.getByRole('button', { name: '300 Test-Coins hinzufügen' }))
    expect(saved()).toMatchObject({ coins: 320, totalFocusMilliseconds: 60_000, ownedOrbIds: ['orb-rare'], equippedOrbId: 'orb-rare' })
    expect(screen.getByRole('heading', { name: 'Level 1' })).toBeTruthy()
    expect(screen.getByLabelText(/Verbleibende Zeit:/).textContent).toBe(timerBefore)
    expect(localStorage.getItem('mission.saved-mission.v1')).toBe(missionBefore)
    fireEvent.change(screen.getByLabelText('Orb zu Testzwecken freischalten'), { target: { value: 'orb-legendary' } })
    fireEvent.click(screen.getByRole('button', { name: 'Test-Orb freischalten' }))
    expect(saved()).toMatchObject({ coins: 320, totalFocusMilliseconds: 60_000, ownedOrbIds: ['orb-rare', 'orb-legendary'], equippedOrbId: 'orb-rare' })
    first.unmount()
    render(<App />)
    expect(saved().coins).toBe(320)
    expect(saved().ownedOrbIds).toEqual(['orb-rare', 'orb-legendary'])
  })

  it('zeigt im Produktionsmodus weder Bereich noch Debug-Aktionen', () => {
    vi.stubEnv('DEV', false)
    const app = render(<App />)
    expect(screen.queryByText('Lokaler Gamification-Testmodus')).toBeNull()
    expect(app.container.textContent).not.toContain('Test-Coins')
    const onChange = vi.fn()
    const direct = render(<GamificationDebug state={initialGamificationState} enabled onChange={onChange} />)
    expect(direct.container.innerHTML).toBe('')
    expect(screen.queryByRole('slider')).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('sperrt Debug-Aktionen im zweiten Tab', async () => {
    render(<App />)
    const second = render(<App />)
    const ui = within(second.container)
    fireEvent.click(await ui.findByText('Lokaler Gamification-Testmodus'))
    const add = ui.getByRole('button', { name: '300 Test-Coins hinzufügen' })
    expect(add.matches(':disabled')).toBe(true)
    fireEvent.click(add)
    expect(saved().coins).toBe(0)
  })
})
