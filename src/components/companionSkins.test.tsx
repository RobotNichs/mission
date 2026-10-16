// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, expectTypeOf, it, vi } from 'vitest'
import MissionCompanion, { type CompanionState } from './MissionCompanion'
import { companionSkins, type CompanionSkinId } from './companionSkins'
import CompanionPreview from './CompanionPreview'

const skins: CompanionSkinId[] = ['luna', 'milo', 'nova']
const states: CompanionState[] = ['idle', 'focus', 'pause', 'error', 'offline', 'success', 'levelUp']
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map(start => Number.parseInt(hex.slice(start, start + 2), 16) / 255)
      .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722
  }
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a)
  return (values[0] + .05) / (values[1] + .05)
}

it('has exactly three stable IDs and defaults compatibly to the original Luna palette', () => {
  expect(Object.keys(companionSkins)).toEqual(skins)
  expectTypeOf<'unknown'>().not.toMatchTypeOf<CompanionSkinId>()
  const ui = render(<MissionCompanion />)
  const original = ui.container.innerHTML
  ui.rerender(<MissionCompanion skin="luna" />)
  expect(ui.container.innerHTML).toBe(original)
  expect(companionSkins.luna.coat).toEqual(['#3D4B6B', '#2E3A56', '#1B2336'])
  expect(companionSkins.luna.eye).toBe('#F7E6D3')
  expect(companionSkins.luna.contour).toBe('#667397')
  expect(companionSkins.luna.surface).toBeUndefined()
  expect(ui.container.querySelector('.companion-eye-surface')?.hasAttribute('stroke')).toBe(false)
})

it.each(skins)('shares all state geometry, accessibility and animation switches for %s', skin => {
  const ui = render(<MissionCompanion />)
  for (const state of states) for (const size of [60, 120, 200]) {
    ui.rerender(<MissionCompanion state={state} size={size} skin="luna" animated={false} />)
    const geometry = [...ui.container.querySelectorAll('path')].map(node => [node.getAttribute('d'), node.getAttribute('transform')])
    ui.rerender(<MissionCompanion state={state} size={size} skin={skin} animated={false} label="Vorschau" />)
    expect([...ui.container.querySelectorAll('path')].map(node => [node.getAttribute('d'), node.getAttribute('transform')])).toEqual(geometry)
    expect(screen.getByRole('img', { name: 'Vorschau' }).getAttribute('data-skin')).toBe(skin)
    expect(screen.getByRole('img').getAttribute('data-animated')).toBe('false')
    expect(ui.container.querySelectorAll('.companion-mouth')).toHaveLength(1)
    expect(ui.container.querySelectorAll('.companion-eyes')).toHaveLength(1)
    ui.rerender(<MissionCompanion state={state} size={size} skin={skin} silhouette />)
    expect(ui.container.querySelector('.companion-contour')?.getAttribute('fill')).toBe('currentColor')
    expect(ui.container.querySelector('.companion-mouth, .companion-eyes')).toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
  }
})

it('differentiates coat, materials and facial contrast without relying on external glow', () => {
  expect(new Set(skins.map(id => companionSkins[id].coat.join())).size).toBe(3)
  for (const id of skins) {
    const palette = companionSkins[id]
    expect(contrast(palette.pupil, palette.eye)).toBeGreaterThan(7)
    expect(contrast(palette.closedEye, palette.coat[1])).toBeGreaterThan(4)
  }
  expect(contrast(companionSkins.milo.eyeOutline!, companionSkins.milo.coat[1])).toBeGreaterThan(3)
  const ui = render(<MissionCompanion skin="milo" />)
  expect(ui.container.querySelector('.companion-eye-surface')?.getAttribute('stroke')).toBe(companionSkins.milo.eyeOutline)
  expect(ui.container.querySelector('pattern')).toBeTruthy()
  expect(ui.container.querySelector('.companion-inner-ear')?.getAttribute('fill')).toBe(companionSkins.milo.ear)
})

it('omits Nova fine points at 60 px and keeps its painted material inside the shared head', () => {
  const ui = render(<MissionCompanion skin="nova" size={120} />)
  expect(ui.container.querySelector('pattern .companion-skin-points')).toBeTruthy()
  const paintId = ui.container.querySelector('pattern')!.id
  expect(ui.container.querySelector('.companion-contour')?.getAttribute('fill')).toBe(`url(#${paintId})`)
  ui.rerender(<MissionCompanion skin="nova" size={60} />)
  expect(ui.container.querySelector('.companion-skin-points')).toBeNull()
  expect(ui.container.querySelector('pattern')).toBeTruthy()
})

it('resolves all unique SVG paint IDs across mixed skins and states', () => {
  const ui = render(<>{skins.flatMap(skin => states.map(state => <MissionCompanion key={`${skin}-${state}`} skin={skin} state={state} />))}</>)
  const ids = [...ui.container.querySelectorAll('[id]')].map(node => node.id)
  expect(new Set(ids).size).toBe(ids.length)
  for (const node of ui.container.querySelectorAll('[fill^="url("]')) {
    const target = node.getAttribute('fill')!.slice(5, -1)
    expect(ids).toContain(target)
    expect(node.closest('svg')?.querySelector(`[id="${target}"]`)).toBeTruthy()
  }
})

it.each(skins)('retains visibility pauses and stable one-shot nodes for %s', skin => {
  let update: IntersectionObserverCallback
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { update = callback }
    observe() {} disconnect() {}
  })
  const ui = render(<MissionCompanion skin={skin} state="levelUp" />)
  const expression = ui.container.querySelector('.companion-expression')
  act(() => update([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver))
  expect(ui.container.firstElementChild?.getAttribute('data-motion')).toBe('paused')
  act(() => update([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver))
  expect(ui.container.firstElementChild?.getAttribute('data-motion')).toBe('running')
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
  fireEvent(document, new Event('visibilitychange'))
  expect(ui.container.firstElementChild?.getAttribute('data-motion')).toBe('paused')
  ui.rerender(<MissionCompanion skin={skin} state="levelUp" size={60} />)
  expect(ui.container.querySelector('.companion-expression')).toBe(expression)
})

it('changes all comparison skins together without changing the original preview or storage', () => {
  const write = vi.spyOn(Storage.prototype, 'setItem')
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
  render(<CompanionPreview />)
  for (const state of states) {
    fireEvent.change(screen.getByRole('combobox', { name: 'Zustand für alle Starter-Skins' }), { target: { value: state } })
    for (const skin of skins) for (const size of [120, 60]) {
      const node = screen.getByRole('img', { name: `${companionSkins[skin].name}, ${size} px` })
      expect(node.getAttribute('data-state')).toBe(state)
      expect(node.getAttribute('data-skin')).toBe(skin)
    }
    expect(screen.getByRole('img', { name: 'Companion: aufmerksam' }).getAttribute('data-state')).toBe('idle')
  }
  expect(write).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled()
})
