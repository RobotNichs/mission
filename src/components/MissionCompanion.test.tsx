// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import MissionCompanion from './MissionCompanion'
import CompanionPreview from './CompanionPreview'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
it.each(['idle', 'focus', 'success'] as const)('renders %s with accessible description', state => {
  render(<MissionCompanion state={state} label={`Katze ${state}`} />)
  expect(screen.getByRole('img', { name: `Katze ${state}` }).getAttribute('data-state')).toBe(state)
})
it.each([60, 120, 200])('bounds a %s px instance and hides decorative artwork', size => {
  const { container } = render(<MissionCompanion size={size} />)
  expect((container.firstChild as HTMLElement).style.width).toBe(`${size}px`)
  expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true')
  expect(screen.queryByRole('img')).toBeNull()
  expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 200 200')
})
it('explicitly disables animation and renders the actual head contour in silhouette', () => {
  const { container } = render(<MissionCompanion animated={false} silhouette />)
  expect(container.firstElementChild?.getAttribute('data-animated')).toBe('false')
  expect(container.querySelector('.companion-contour')?.getAttribute('fill')).toBe('currentColor')
  expect(container.querySelector('.companion-eyes')).toBeNull()
  expect(container.querySelector('ellipse')).toBeNull()
})
it.each(['idle', 'focus', 'success'] as const)('disables motion independently of silhouette in %s', state => {
  const { container } = render(<MissionCompanion state={state} animated={false} className="inspection" />)
  expect(container.firstElementChild?.getAttribute('data-animated')).toBe('false')
  expect(container.firstElementChild?.classList.contains('inspection')).toBe(true)
  expect(container.querySelector('.companion-eyes')).toBeTruthy()
})
it('gives every instance unique gradient IDs and resolving references', () => {
  const { container } = render(<><MissionCompanion /><MissionCompanion /></>)
  const ids = [...container.querySelectorAll('[id]')].map(el => el.id)
  expect(new Set(ids).size).toBe(ids.length)
  for (const el of container.querySelectorAll('[fill^="url("]')) {
    const id = el.getAttribute('fill')!.slice(5, -1)
    expect(ids).toContain(id)
  }
})
it('distinguishes idle and focus eyes while retaining the same head and silhouette', () => {
  const ui = render(<MissionCompanion state="idle" animated={false} />)
  const contour = ui.container.querySelector('.companion-contour')?.getAttribute('d')
  const idleEyes = [...ui.container.querySelectorAll('.companion-eyes path')].map(path => path.getAttribute('d'))
  ui.rerender(<MissionCompanion state="focus" animated={false} />)
  const focusEyes = [...ui.container.querySelectorAll('.companion-eyes path')].map(path => path.getAttribute('d'))
  expect(focusEyes).toHaveLength(2)
  expect(focusEyes).not.toEqual(idleEyes)
  expect(ui.container.querySelector('.companion-contour')?.getAttribute('d')).toBe(contour)
  ui.rerender(<MissionCompanion size={60} silhouette />)
  expect(ui.container.querySelector('.companion-contour')?.getAttribute('d')).toBe(contour)
  expect(ui.container.querySelector('.companion-eyes')).toBeNull()
})
it('does not restart success on parent rerenders; re-entry explicitly triggers a new expression', () => {
  const ui = render(<MissionCompanion state="success" />)
  const expression = ui.container.querySelector('.companion-expression')
  ui.rerender(<MissionCompanion state="success" size={200} />)
  expect(ui.container.querySelector('.companion-expression')).toBe(expression)
  ui.rerender(<MissionCompanion state="idle" />)
  ui.rerender(<MissionCompanion state="success" />)
  expect(ui.container.querySelector('.companion-expression')).not.toBe(expression)
})
it('keeps one common contour and equally colored inner ears through all expressions', () => {
  const ui = render(<MissionCompanion />)
  const contour = ui.container.querySelector('.companion-contour')?.getAttribute('d')
  for (const state of ['idle', 'focus', 'success', 'idle'] as const) {
    ui.rerender(<MissionCompanion state={state} />)
    expect(ui.container.querySelector('.companion-contour')?.getAttribute('d')).toBe(contour)
    const ears = [...ui.container.querySelectorAll('.companion-inner-ear')]
    expect(ears).toHaveLength(2)
    expect(ears.map(ear => [ear.getAttribute('fill'), ear.getAttribute('opacity')])).toEqual([
      ['#8A7BE0', '.32'], ['#8A7BE0', '.32'],
    ])
  }
})
it('retains a single mouth during success transitions and puts the diffuse pulse behind the opaque head', () => {
  const ui = render(<MissionCompanion />)
  let mouthShape: string | null | undefined
  for (const state of ['idle', 'success', 'success', 'focus', 'success', 'idle'] as const) {
    ui.rerender(<MissionCompanion state={state} />)
    const mouths = ui.container.querySelectorAll('.companion-mouth')
    expect(mouths).toHaveLength(1)
    mouthShape ??= mouths[0].getAttribute('d')
    expect(mouths[0].getAttribute('d')).toBe(mouthShape)
    const pulse = ui.container.querySelector('.companion-warmth')!
    const head = ui.container.querySelector('.companion-contour')!
    // The pulse cannot draw a second curved facial stroke, even at peak opacity.
    expect(pulse.tagName).toBe('ellipse')
    expect(pulse.hasAttribute('stroke')).toBe(false)
    expect(pulse.getAttribute('fill')).toMatch(/^url\(#/)
    expect(pulse.compareDocumentPosition(head) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(head.hasAttribute('opacity')).toBe(false)
  }
})
it('pauses offscreen and hidden-page animation and cleans observers', () => {
  let notify: IntersectionObserverCallback
  const disconnect = vi.fn()
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { notify = callback }
    observe() {} disconnect = disconnect
  })
  const ui = render(<MissionCompanion />)
  act(() => notify([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver))
  expect(ui.container.firstElementChild?.getAttribute('data-motion')).toBe('paused')
  act(() => notify([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver))
  expect(ui.container.firstElementChild?.getAttribute('data-motion')).toBe('running')
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
  fireEvent(document, new Event('visibilitychange'))
  expect(ui.container.firstElementChild?.getAttribute('data-motion')).toBe('paused')
  ui.unmount(); expect(disconnect).toHaveBeenCalledOnce()
})
it('offers all preview variants without storage writes or network requests', () => {
  const save = vi.spyOn(Storage.prototype, 'setItem')
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
  render(<CompanionPreview />)
  expect(screen.getAllByRole('img')).toHaveLength(6)
  fireEvent.click(screen.getByRole('button', { name: 'Erfolg auslösen' }))
  expect(screen.getByLabelText('Companion: Erfolg').getAttribute('data-state')).toBe('success')
  fireEvent.click(screen.getByRole('button', { name: 'Zurück zu Idle' }))
  expect(save).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled()
})
