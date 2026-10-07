// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'
import { createTestLocks } from './services/testLocks'
import { initialGamificationState } from './types/gamification'
import { GAMIFICATION_STORAGE_KEY } from './services/gamification'
import { getOrbSize } from './services/orbSize'

beforeEach(() => {
  localStorage.clear(); vi.stubEnv('DEV', true)
  Object.defineProperty(navigator, 'locks', { configurable: true, value: createTestLocks() })
  localStorage.setItem(GAMIFICATION_STORAGE_KEY, JSON.stringify({ ...initialGamificationState, coins: 41, totalFocusMilliseconds: 1800000 }))
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllEnvs() })
async function openDebug() {
  fireEvent.click(await screen.findByText('Lokaler Gamification-Testmodus'))
}
it.each([1, 50, 100])('uses global display level %s without any storage writes or real progress changes', async level => {
  const view = render(<App />); await openDebug()
  expect(screen.getByRole('heading', { name: 'Level 2' })).toBeTruthy()
  const before = { ...localStorage }
  const write = vi.spyOn(Storage.prototype, 'setItem')
  fireEvent.click(screen.getByLabelText('Globalen Test-Level verwenden'))
  fireEvent.change(screen.getByRole('slider'), { target: { value: String(level) } })
  expect(screen.getByRole('heading', { name: `Level ${level}` })).toBeTruthy()
  expect((screen.getByRole('img', { name: `Mission Core, Level ${level}` }) as HTMLElement).style.width).toBe(`min(${getOrbSize(level) * 1.8}px, 220px, 100%)`)
  fireEvent.change(screen.getByLabelText('Prestige-Orb-Vorschau'), { target: { value: 'orb-prestige-zenith' } })
  const preview = screen.getByRole('img', { name: `Orb-Vorschau, Level ${level}` }) as HTMLElement
  expect(preview.dataset.orbId).toBe('orb-prestige-zenith')
  expect(preview.style.width).toBe(`${getOrbSize(level, 'focus')}px`)
  expect(write).not.toHaveBeenCalled(); expect({ ...localStorage }).toEqual(before)
  fireEvent.click(screen.getByLabelText('Globalen Test-Level verwenden'))
  expect(screen.getByRole('heading', { name: 'Level 2' })).toBeTruthy()
  expect(write).not.toHaveBeenCalled()
  fireEvent.click(screen.getByLabelText('Globalen Test-Level verwenden'))
  fireEvent.click(screen.getByRole('button', { name: 'Test-Level zurücksetzen' }))
  expect(screen.getByRole('heading', { name: 'Level 2' })).toBeTruthy()
  view.unmount(); render(<App />)
  expect(screen.getByRole('heading', { name: 'Level 2' })).toBeTruthy()
  expect((await screen.findByLabelText('Globalen Test-Level verwenden') as HTMLInputElement).checked).toBe(false)
})
it('transitions the same orb from the measured test size to the test-sized focus stage', async () => {
  const animate = vi.fn((_frames: Keyframe[] | PropertyIndexedKeyframes, _options?: number | KeyframeAnimationOptions) => ({ cancel: vi.fn() }))
  Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: animate })
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const size = this.classList.contains('mission-core') ? getOrbSize(100) * 1.8 : getOrbSize(100, 'focus')
    return { x: 10, y: 20, left: 10, top: 20, right: 10 + size, bottom: 20 + size, width: size, height: size, toJSON: () => ({}) }
  })
  try {
    render(<App />); await openDebug()
    fireEvent.click(screen.getByLabelText('Globalen Test-Level verwenden'))
    fireEvent.change(screen.getByRole('slider'), { target: { value: '100' } })
    const orbId = document.querySelector('.core-orb-art')?.getAttribute('data-orb-id')
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    const stage = document.querySelector('.focus-orb-stage') as HTMLElement
    expect(stage.style.width).toBe(`min(${getOrbSize(100, 'focus')}px, 78vw, 100%)`)
    expect(document.querySelector('.focus-orb')?.getAttribute('data-orb-id')).toBe(orbId)
    expect((animate.mock.calls[0][0] as Keyframe[])[0].transform).toContain(`scale(${getOrbSize(100) * 1.8 / getOrbSize(100, 'focus')}`)
    fireEvent.click(screen.getByRole('button', { name: 'Fokusmodus verlassen' }))
    expect(screen.getByRole('heading', { name: 'Level 100' })).toBeTruthy()
  } finally { delete (Element.prototype as unknown as { animate?: unknown }).animate }
})
it('offers no override in production', () => {
  vi.stubEnv('DEV', false); render(<App />)
  expect(screen.queryByLabelText('Globalen Test-Level verwenden')).toBeNull()
  expect(screen.getByRole('heading', { name: 'Level 2' })).toBeTruthy()
})
